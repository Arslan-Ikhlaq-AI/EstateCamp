<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ReadsUnitHoldings;
use App\Http\Requests\BillingPaymentRequest;
use App\Models\Cheque;
use App\Models\Contract;
use App\Models\ExtraIncome;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\RentalPayment;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A property's payments over a period, both ways.
 *
 * Money in, in three parts, each with its own figures: the cheques of the
 * contracts renting here, which an admin follows until they are cashed,
 * with the extra income the property earned besides rent, such as an
 * internet or washing machine provider's share; what short-term rentals
 * paid into the bank (transfers, and cheques once
 * submitted); and what they still owe, paid in cash, by transfer or by
 * cheque. Cash is collected on site by the camp boss and handed over to
 * the company, confirmed by an admin.
 *
 * Money out, the same way round: the cheques the company pays under the
 * landlord's head lease and the maintenance contracts (drainage, fire
 * safety and the rest); the maintenance bills and one-off payments, such
 * as a permit fee, paid by cheque or bank transfer; and those still to
 * pay or paid in cash. Cash paid out at the property is paid by the camp
 * boss out of the cash collected, so it comes off what is handed over.
 *
 * Under both, the period in short: the camp boss's cash, and what came in,
 * went out and was left over.
 */
class PropertyPaymentController extends Controller
{
    use FiltersByPeriod, ReadsUnitHoldings;

    /**
     * Cheques waiting to be cashed: expected, in the company's hands or at
     * the bank.
     */
    private const CHEQUES_WAITING = ['pending', 'received', 'deposited'];

    /**
     * Cheques that will not be cashed as they are: bounced, handed back or
     * cancelled.
     */
    private const CHEQUES_FAILED = ['bounced', 'returned', 'cancelled'];

    /**
     * How short-term tenants pay into the company's bank, besides cheques.
     */
    private const BANK_METHODS = ['bank_transfer', 'card'];

    /**
     * Show the payments for the chosen period (`?period=`, this month by
     * default; any month or range of days, past or future). Cheques dated
     * in it are listed, and so are earlier ones still to deal with, as an
     * unpaid bill is brought forward. Cash from before it still with the
     * camp boss stays listed until an admin confirms receiving it, and so
     * do bills from before it the camp boss paid in cash. Unpaid
     * maintenance bills stay listed until they are paid, and so do one-off
     * payments still to pay. Extra income received in the period is
     * listed, and counted unless cancelled. `?tab=out` opens on the
     * payments out.
     */
    public function show(Request $request, Property $property): Response
    {
        $this->ensureSameCompany($request, $property);

        $period = $this->periodFilter($request, 'this_month');

        if ($period['kind'] === 'all') {
            $period = [...$this->resolvePeriod('this_month'), 'value' => '', 'default' => 'this_month'];
        }

        $from = CarbonImmutable::parse($period['from']);
        $to = CarbonImmutable::parse($period['to']);

        $property->load(['company:id,default_currency', 'propertyType:id,name,slug']);
        $rentals = collect($this->billingAccounts($property, $this->unitHoldings($property, $from, $to), $from, $to))->where('kind', 'rental')->values();
        [$contractCheques, $rentalCheques] = $this->clientCheques($property, $from, $to)->partition(fn (Cheque $cheque) => $cheque->chequeable instanceof Contract);
        [$cashReceipts, $bankReceipts] = $this->rentalReceipts($property, $from, $to)->partition(fn (RentalPayment $receipt) => $receipt->method === 'cash');
        $extraIncome = $this->extraIncome($property, $from, $to);
        $extraReceived = $extraIncome->where('status', 'received');
        $agreements = collect($this->agreementsToPay($property, $from, $to));
        [$billsPaid, $billsToPay] = $this->maintenanceBills($property, $from, $to)->partition(fn (MaintenanceJob $job) => $job->isPaid());
        [$othersPaid, $othersToPay] = $this->otherPayments($property, $from, $to)->partition(fn (OtherPayment $payment) => $payment->isPaid());
        [$cashBills, $bankBills] = $billsPaid->partition(fn (MaintenanceJob $job) => $job->payment_method === 'cash');
        [$cashOthers, $bankOthers] = $othersPaid->partition(fn (OtherPayment $payment) => $payment->method === 'cash');
        $unpaidBills = $billsToPay->filter(fn (MaintenanceJob $job) => $job->isBill());
        $othersPending = $othersToPay->where('status', 'pending');
        $billsPaidInPeriod = $billsPaid->filter(fn (MaintenanceJob $job) => $job->paid_on->gte($from));
        $othersPaidInPeriod = $othersPaid->filter(fn (OtherPayment $payment) => $payment->payment_date->gte($from));
        $cashInPeriod = $cashReceipts->filter(fn (RentalPayment $receipt) => $receipt->paid_on->gte($from));
        $cashSpent = $cashBills->concat($cashOthers);
        $cashSpentInPeriod = $cashSpent->filter(fn (MaintenanceJob|OtherPayment $bill) => self::paidOn($bill)->gte($from));
        $chequesCashed = $rentalCheques->where('status', 'cleared');
        $bankPaid = $bankBills->concat($bankOthers);
        $income = [
            'cheques' => round((float) $contractCheques->where('status', 'cleared')->sum('amount') + (float) $chequesCashed->sum('amount'), 2),
            'transfers' => round((float) $bankReceipts->sum('amount'), 2),
            'cash' => round((float) $cashInPeriod->sum('amount'), 2),
            'extra' => round((float) $extraReceived->sum('amount'), 2),
        ];
        $expenses = [
            'landlord' => round((float) $agreements->where('kind', 'head_lease')->sum('paidInPeriod'), 2),
            'contracts' => round((float) $agreements->where('kind', 'maintenance_contract')->sum('paidInPeriod'), 2),
            'bills' => round((float) $billsPaidInPeriod->sum('amount'), 2),
            'others' => round((float) $othersPaidInPeriod->sum('amount'), 2),
        ];

        return Inertia::render('Properties/Payments', [
            'currency' => $property->company->default_currency,
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'code' => $property->code,
                'type' => $property->propertyType?->name,
                'typeSlug' => $property->propertyType?->slug,
                'area' => $property->area,
                'city' => $property->city,
            ],
            'period' => $period,
            'tab' => $request->query('tab') === 'out' ? 'out' : 'in',
            'incoming' => [
                'contractCheques' => $contractCheques->map(fn (Cheque $cheque) => ChequeController::details($cheque))->values()->all(),
                'extraIncome' => $extraIncome->map(fn (ExtraIncome $income) => ExtraIncomeController::details($income))->values()->all(),
                'rentalCheques' => $rentalCheques->map(fn (Cheque $cheque) => ChequeController::details($cheque))->values()->all(),
                'rentals' => $rentals->all(),
                'bankReceipts' => $bankReceipts->map(fn (RentalPayment $receipt) => RentalPaymentController::details($receipt))->values()->all(),
                'cashReceipts' => $cashReceipts->map(fn (RentalPayment $receipt) => RentalPaymentController::details($receipt))->values()->all(),
            ],
            'outgoing' => [
                'agreements' => $agreements->all(),
                'bankBills' => $this->billDetails($bankBills),
                'bankOthers' => $this->otherDetails($bankOthers),
                'billsToPay' => $this->billDetails($billsToPay),
                'othersToPay' => $this->otherDetails($othersToPay),
                'cashBills' => $this->billDetails($cashBills),
                'cashOthers' => $this->otherDetails($cashOthers),
            ],
            'summary' => [
                'cheques' => [
                    'expected' => $this->figure($contractCheques),
                    'received' => $this->figure($contractCheques->where('status', 'cleared')),
                    'waiting' => $this->figure($contractCheques->whereIn('status', self::CHEQUES_WAITING)),
                    'inHand' => $this->figure($contractCheques->whereIn('status', ['received', 'deposited'])),
                    'failed' => $this->figure($contractCheques->whereIn('status', self::CHEQUES_FAILED)),
                ],
                'extraIncome' => $this->figure($extraReceived),
                'bank' => [
                    'received' => round((float) $bankReceipts->sum('amount') + (float) $chequesCashed->sum('amount'), 2),
                    'transfers' => $this->figure($bankReceipts),
                    'chequesCashed' => $this->figure($chequesCashed),
                    'chequesWaiting' => $this->figure($rentalCheques->whereIn('status', self::CHEQUES_WAITING)),
                    'chequesFailed' => $this->figure($rentalCheques->whereIn('status', self::CHEQUES_FAILED)),
                ],
                'cash' => [
                    'collected' => $this->figure($cashInPeriod),
                    'handedOver' => $this->figure($cashInPeriod->filter(fn (RentalPayment $receipt) => ! $receipt->awaitsHandover())),
                    'withCampBoss' => $this->figure($cashReceipts->filter(fn (RentalPayment $receipt) => $receipt->awaitsHandover())),
                    'toCollect' => round((float) $rentals->sum('statement.toPay'), 2),
                    'owing' => $rentals->where('statement.toPay', '>', 0)->count(),
                ],
                'agreements' => [
                    'due' => round((float) $agreements->sum('due'), 2),
                    'paid' => round((float) $agreements->sum('paidInPeriod'), 2),
                    'left' => round((float) $agreements->sum('left'), 2),
                ],
                'outBank' => [
                    'paid' => $this->figure($bankPaid),
                    'bills' => $this->figure($bankBills),
                    'others' => $this->figure($bankOthers),
                    'byCheque' => $this->figure($bankBills->where('payment_method', 'cheque')->concat($bankOthers->where('method', 'cheque'))),
                ],
                'outCash' => [
                    'toPay' => $this->figure($unpaidBills->concat($othersPending)),
                    'toCost' => $billsToPay->count() - $unpaidBills->count(),
                    'spent' => $this->figure($cashSpentInPeriod),
                    'toSettle' => $this->figure($cashSpent->filter(fn (MaintenanceJob|OtherPayment $bill) => $bill->awaitsHandover())),
                ],
                'campBoss' => $this->campBossCash($cashReceipts, $cashSpent, $from),
                'income' => [...$income, 'total' => round(array_sum($income), 2)],
                'expenses' => [...$expenses, 'total' => round(array_sum($expenses), 2)],
                'profit' => round(array_sum($income) - array_sum($expenses), 2),
                'toPay' => round($agreements->sum('due') + (float) $unpaidBills->sum('amount') + (float) $othersPending->sum('amount'), 2),
                'paidOut' => round(array_sum($expenses), 2),
            ],
            'can' => ['confirmCash' => $request->user()->can('confirm-cash-handover')],
            'chequeStatuses' => ChequeController::statusOptions(),
            'banks' => ChequeController::knownBanks($property->company),
            'collectionMethods' => BillingPaymentRequest::RENTAL_METHODS,
            'billPaymentMethods' => MaintenanceJob::PAYMENT_METHODS,
            'otherPaymentMethods' => OtherPayment::METHODS,
        ]);
    }

    /**
     * How many items there are and what they come to.
     *
     * @param  Collection<int, Model>  $items
     * @return array{count: int, amount: float}
     */
    private function figure(Collection $items): array
    {
        return ['count' => $items->count(), 'amount' => round((float) $items->sum('amount'), 2)];
    }

    /**
     * The camp boss's cash over the period: what was collected and what was
     * paid out of it, what was already settled with an admin, and what is
     * brought forward from before, still to settle. What is left to hand
     * over is everything not settled yet, less what was spent; below
     * nothing, the company owes the camp boss.
     *
     * @param  Collection<int, RentalPayment>  $receipts
     * @param  Collection<int, MaintenanceJob|OtherPayment>  $spent
     * @return array{received: float, spent: float, settled: float, broughtForward: float, toHandOver: float}
     */
    private function campBossCash(Collection $receipts, Collection $spent, CarbonImmutable $from): array
    {
        $isEarlier = fn (RentalPayment|MaintenanceJob|OtherPayment $item) => self::paidOn($item)->lt($from);
        $total = fn (Collection $items) => (float) $items->sum('amount');
        [$receiptsBefore, $receiptsInPeriod] = $receipts->partition($isEarlier);
        [$spentBefore, $spentInPeriod] = $spent->partition($isEarlier);
        $waiting = fn (RentalPayment|MaintenanceJob|OtherPayment $item) => $item->awaitsHandover();

        return [
            'received' => round($total($receiptsInPeriod), 2),
            'spent' => round($total($spentInPeriod), 2),
            'settled' => round($total($receiptsInPeriod->reject($waiting)) - $total($spentInPeriod->reject($waiting)), 2),
            'broughtForward' => round($total($receiptsBefore) - $total($spentBefore), 2),
            'toHandOver' => round($total($receipts->filter($waiting)) - $total($spent->filter($waiting)), 2),
        ];
    }

    /**
     * The day money changed hands: a receipt or bill was paid, or a one-off
     * payment made.
     */
    private static function paidOn(RentalPayment|MaintenanceJob|OtherPayment $item): CarbonInterface
    {
        return $item instanceof OtherPayment ? $item->payment_date : $item->paid_on;
    }

    /**
     * @param  Collection<int, MaintenanceJob>  $bills
     * @return list<array<string, mixed>>
     */
    private function billDetails(Collection $bills): array
    {
        return $bills->map(fn (MaintenanceJob $job) => MaintenanceBillController::details($job))->values()->all();
    }

    /**
     * @param  Collection<int, OtherPayment>  $payments
     * @return list<array<string, mixed>>
     */
    private function otherDetails(Collection $payments): array
    {
        return $payments->map(fn (OtherPayment $payment) => OtherPaymentController::details($payment))->values()->all();
    }

    /**
     * What the short-term rentals here paid by cash, bank transfer or card
     * in the period, latest first, with the cash from before it still with
     * the camp boss. Voided receipts are left out, and so are those of
     * cheques, which are listed as cheques.
     *
     * @return Collection<int, RentalPayment>
     */
    private function rentalReceipts(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return RentalPayment::query()
            ->where('company_id', $property->company_id)
            ->whereHas('rental', fn (Builder $rental) => $rental->where('property_id', $property->id))
            ->where('status', 'cleared')
            ->whereIn('method', ['cash', ...self::BANK_METHODS])
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $inPeriod) => $inPeriod->whereDate('paid_on', '>=', $from)->whereDate('paid_on', '<=', $to))
                ->orWhere(fn (Builder $withCampBoss) => $withCampBoss->where('method', 'cash')->whereNull('handed_over_at')->whereDate('paid_on', '<', $from)))
            ->with(['rental:id,rental_number,client_id,property_id', 'rental.client:id,name', 'rental.rooms:rooms.id,rooms.room_number', 'receivedBy:id,name', 'handedOverTo:id,name'])
            ->orderByDesc('paid_on')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * The cheques clients give for renting here, under a contract with
     * units in the property or a short-term rental of its rooms. A
     * contract's cheques cover the whole contract, also where it rents in
     * other properties.
     *
     * @return Collection<int, Cheque>
     */
    private function clientCheques(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return $this->listedIn(Cheque::query(), $from, $to)
            ->where('company_id', $property->company_id)
            ->where('direction', 'received')
            ->whereHasMorph('chequeable', [Contract::class, RoomRental::class], fn (Builder $agreement, string $type) => $type === Contract::class
                ? $agreement->whereHas('lines', fn (Builder $lines) => $lines->where('property_id', $property->id))
                : $agreement->where('property_id', $property->id))
            ->with([...ChequeController::detailRelations(), ...ChequeController::historyRelations()])
            ->orderBy('cheque_date')
            ->orderBy('id')
            ->get();
    }

    /**
     * What the company pays for the property by cheque: its head leases and
     * its maintenance contracts that run during the period or have cheques
     * listed in it, the lease first. Each has its listed cheques and how
     * much is due by the end of the period, was paid in it, has been paid
     * so far and is left to pay.
     *
     * @return list<array<string, mixed>>
     */
    private function agreementsToPay(Property $property, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $runsInPeriod = fn (Builder|HasMany $query) => $query->whereDate('start_date', '<=', $to)->whereDate('end_date', '>=', $from);
        $listed = fn (Builder $cheques) => $this->listedIn($cheques, $from, $to);
        $cheques = fn (MorphMany $cheques) => $this->listedIn($cheques, $from, $to)
            ->with([
                'chequeStatus:id,name,slug,color,stage',
                'replacement:id,replaces_id',
                'payment:id,cheque_id,payment_number',
                'rentalPayment:id,cheque_id,receipt_number,status',
                ...ChequeController::historyRelations(),
            ])
            ->orderBy('cheque_date')
            ->orderBy('id');
        $cleared = fn (Builder $cheques) => $cheques->where('status', 'cleared');
        $figures = fn (Builder|HasMany $query) => $query
            ->withSum(['cheques as due_total' => fn (Builder $open) => $open->open()->whereDate('cheque_date', '<=', $to)], 'amount')
            ->withSum(['cheques as paid_in_period' => fn (Builder $paid) => $cleared($paid)->whereDate('cleared_on', '>=', $from)->whereDate('cleared_on', '<=', $to)], 'amount')
            ->withSum(['cheques as paid_total' => $cleared], 'amount')
            ->withSum(['cheques as open_total' => fn (Builder $open) => $open->open()], 'amount')
            ->withMin(['cheques as next_cheque_on' => fn (Builder $open) => $open->open()], 'cheque_date');

        $leases = $figures($property->headLeases())
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $running) => $runsInPeriod($running->where('status', '!=', 'draft')))
                ->orWhereHas('cheques', $listed))
            ->with(['landlord:id,name', 'cheques' => $cheques])
            ->orderBy('start_date')
            ->get();

        $contracts = $figures(MaintenanceContract::query()->where('property_id', $property->id))
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $running) => $runsInPeriod($running->where('status', 'active')))
                ->orWhereHas('cheques', $listed))
            ->with(['cheques' => $cheques])
            ->orderBy('start_date')
            ->get()
            ->sortBy(fn (MaintenanceContract $contract) => array_search($contract->service, MaintenanceContract::SERVICES, true));

        return $leases->concat($contracts)
            ->map(fn (HeadLease|MaintenanceContract $agreement) => $this->agreementDetails($agreement, $property))
            ->values()
            ->all();
    }

    /**
     * One agreement the company pays under, as the money out tab shows it.
     *
     * @return array<string, mixed>
     */
    private function agreementDetails(HeadLease|MaintenanceContract $agreement, Property $property): array
    {
        $isLease = $agreement instanceof HeadLease;
        $agreement->setRelation('property', $property);
        $agreement->cheques->each(fn (Cheque $cheque) => $cheque->setRelation('chequeable', $agreement));
        $kind = $isLease ? 'head_lease' : 'maintenance_contract';

        return [
            'key' => "{$kind}:{$agreement->id}",
            'kind' => $kind,
            'id' => $agreement->id,
            'number' => $isLease ? $agreement->lease_number : $agreement->contract_number,
            'service' => $isLease ? null : $agreement->service,
            'party' => $isLease ? $agreement->landlord?->only(['id', 'name']) : ['id' => null, 'name' => $agreement->vendor_name],
            'state' => $isLease ? $agreement->status : $agreement->state(),
            'startsOn' => $agreement->start_date->toDateString(),
            'endsOn' => $agreement->end_date->toDateString(),
            'value' => round((float) ($isLease ? $agreement->annual_rent : $agreement->contract_value), 2),
            'paymentTerms' => $isLease ? null : $agreement->payment_terms,
            'paymentsPerYear' => $isLease ? $agreement->payments_per_year : null,
            'paidPerVisit' => ! $isLease && $agreement->payment_terms === 'per_visit',
            'due' => round((float) $agreement->due_total, 2),
            'paidInPeriod' => round((float) $agreement->paid_in_period, 2),
            'paid' => round((float) $agreement->paid_total, 2),
            'left' => round((float) $agreement->open_total, 2),
            'nextChequeOn' => $agreement->next_cheque_on === null ? null : CarbonImmutable::parse($agreement->next_cheque_on)->toDateString(),
            'cheques' => $agreement->cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque))->all(),
        ];
    }

    /**
     * The maintenance work done here that the company pays for: every bill
     * still unpaid from the period or before, the bills paid in the period,
     * those paid in cash before it not yet settled with an admin, and work
     * finished in the period whose cost is not recorded yet, which can be
     * costed and paid in one go. Unpaid ones first, then the latest.
     *
     * @return Collection<int, MaintenanceJob>
     */
    private function maintenanceBills(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        $billDate = DB::raw('coalesce(maintenance_jobs.completed_on, maintenance_jobs.reported_on)');

        return MaintenanceJob::query()
            ->where('property_id', $property->id)
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $unpaid) => $unpaid->where('amount', '>', 0)->whereNull('paid_on')->whereDate($billDate, '<=', $to))
                ->orWhere(fn (Builder $paid) => $paid->where('amount', '>', 0)->whereDate('paid_on', '>=', $from)->whereDate('paid_on', '<=', $to))
                ->orWhere(fn (Builder $cashToSettle) => $cashToSettle
                    ->where('amount', '>', 0)
                    ->where('payment_method', 'cash')
                    ->whereNull('handed_over_at')
                    ->whereDate('paid_on', '<', $from))
                ->orWhere(fn (Builder $toCost) => $toCost
                    ->where(fn (Builder $noCost) => $noCost->whereNull('amount')->orWhere('amount', 0))
                    ->whereNull('paid_on')
                    ->inStage('completed')
                    ->whereDate('completed_on', '>=', $from)
                    ->whereDate('completed_on', '<=', $to)))
            ->with([...MaintenanceJobController::listRelations(), 'paidBy:id,name', 'handedOverTo:id,name'])
            ->orderByRaw('case when paid_on is null then 0 else 1 end')
            ->orderByDesc(DB::raw('coalesce(maintenance_jobs.paid_on, maintenance_jobs.completed_on, maintenance_jobs.reported_on)'))
            ->orderByDesc('id')
            ->get();
    }

    /**
     * The one-off payments for the property dated in the period, and those
     * from before it still to pay or paid in cash and not yet settled with
     * an admin: still to pay first, then the latest.
     *
     * @return Collection<int, OtherPayment>
     */
    private function otherPayments(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return OtherPayment::query()
            ->where('property_id', $property->id)
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $inPeriod) => $inPeriod->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to))
                ->orWhere(fn (Builder $earlier) => $earlier->whereDate('payment_date', '<', $from)->where(fn (Builder $open) => $open
                    ->where('status', 'pending')
                    ->orWhere(fn (Builder $cashToSettle) => $cashToSettle->where('status', 'paid')->where('method', 'cash')->whereNull('handed_over_at')))))
            ->with('handedOverTo:id,name')
            ->orderByRaw("case status when 'pending' then 0 when 'paid' then 1 else 2 end")
            ->orderByDesc('payment_date')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * The extra income the property received in the period, latest first,
     * cancelled ones last.
     *
     * @return Collection<int, ExtraIncome>
     */
    private function extraIncome(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return ExtraIncome::query()
            ->where('property_id', $property->id)
            ->whereDate('received_on', '>=', $from)
            ->whereDate('received_on', '<=', $to)
            ->orderByRaw("case status when 'received' then 0 else 1 end")
            ->orderByDesc('received_on')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Keep the cheques dated in the period, and those dated before it that
     * are still to deal with: not yet cleared or cancelled, or bounced and
     * not replaced.
     *
     * @template TQuery of Builder|MorphMany
     *
     * @param  TQuery  $cheques
     * @return TQuery
     */
    private function listedIn(Builder|MorphMany $cheques, CarbonImmutable $from, CarbonImmutable $to): Builder|MorphMany
    {
        return $cheques->where(fn (Builder $query) => $query
            ->where(fn (Builder $inPeriod) => $inPeriod->whereDate('cheque_date', '>=', $from)->whereDate('cheque_date', '<=', $to))
            ->orWhere(fn (Builder $earlier) => $earlier
                ->whereDate('cheque_date', '<', $from)
                ->where(fn (Builder $toDealWith) => $toDealWith
                    ->open()
                    ->orWhere(fn (Builder $bounced) => $bounced->where('status', 'bounced')->whereDoesntHave('replacement')))));
    }
}
