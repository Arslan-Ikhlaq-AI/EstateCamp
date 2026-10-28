<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ReadsUnitHoldings;
use App\Http\Requests\BillingPaymentRequest;
use App\Models\Cheque;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
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
 * Money in: every cheque its clients and short-term tenants give the
 * company, then each company's bill for the units it holds here, the same
 * bill as on the room allocation page, paid by typing the amount.
 *
 * Money out: the landlord's head lease and the maintenance contracts
 * (drainage, fire safety and the rest) the company pays by cheque, the
 * maintenance work done here, paid as each bill comes in, and one-off
 * payments such as a permit fee.
 */
class PropertyPaymentController extends Controller
{
    use FiltersByPeriod, ReadsUnitHoldings;

    /**
     * Show the payments for the chosen period (`?period=`, this month by
     * default; any month or range of days, past or future). Cheques dated
     * in it are listed, and so are earlier ones still to deal with, as an
     * unpaid bill is brought forward. Unpaid maintenance bills stay listed
     * until they are paid, and so do one-off payments still to pay.
     * `?tab=out` opens on the payments out.
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
        $accounts = $this->billingAccounts($property, $this->unitHoldings($property, $from, $to), $from, $to);
        $cheques = $this->clientCheques($property, $from, $to);
        $agreements = $this->agreementsToPay($property, $from, $to);
        $bills = $this->maintenanceBills($property, $from, $to);
        $others = $this->otherPayments($property, $from, $to);
        $inHand = $cheques->whereIn('status', ['received', 'deposited']);
        $unpaidBills = $bills->filter(fn (MaintenanceJob $job) => ! $job->isPaid() && $job->isBill());
        $billsPaid = $bills->filter(fn (MaintenanceJob $job) => $job->isPaid());
        $othersToPay = $others->filter(fn (OtherPayment $payment) => $payment->status === 'pending' && $payment->payment_date->lte($to));
        $othersPaid = $others->filter(fn (OtherPayment $payment) => $payment->isPaid());

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
                'cheques' => $cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque))->values()->all(),
                'accounts' => $accounts,
            ],
            'outgoing' => [
                'agreements' => $agreements,
                'bills' => $bills->map(fn (MaintenanceJob $job) => MaintenanceBillController::details($job))->values()->all(),
                'others' => $others->map(fn (OtherPayment $payment) => OtherPaymentController::details($payment))->values()->all(),
            ],
            'summary' => [
                'received' => round(collect($accounts)->sum('statement.received'), 2),
                'toCollect' => round(collect($accounts)->sum('statement.toPay'), 2),
                'owing' => collect($accounts)->where('statement.toPay', '>', 0)->count(),
                'chequesInHand' => ['count' => $inHand->count(), 'amount' => round((float) $inHand->sum('amount'), 2)],
                'toPay' => round(collect($agreements)->sum('due') + (float) $unpaidBills->sum('amount') + (float) $othersToPay->sum('amount'), 2),
                'paidOut' => round(collect($agreements)->sum('paidInPeriod') + (float) $billsPaid->sum('amount') + (float) $othersPaid->sum('amount'), 2),
                'unpaidBills' => $unpaidBills->count(),
            ],
            'chequeStatuses' => ChequeController::statusOptions(),
            'banks' => ChequeController::knownBanks($property->company),
            'collectionMethods' => BillingPaymentRequest::METHODS,
            'billPaymentMethods' => MaintenanceJob::PAYMENT_METHODS,
            'otherPaymentMethods' => OtherPayment::METHODS,
        ]);
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
     * and work finished in the period whose cost is not recorded yet, which
     * can be costed and paid in one go. Unpaid ones first, then the latest.
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
                ->orWhere(fn (Builder $toCost) => $toCost
                    ->where(fn (Builder $noCost) => $noCost->whereNull('amount')->orWhere('amount', 0))
                    ->whereNull('paid_on')
                    ->inStage('completed')
                    ->whereDate('completed_on', '>=', $from)
                    ->whereDate('completed_on', '<=', $to)))
            ->with([...MaintenanceJobController::listRelations(), 'paidBy:id,name'])
            ->orderByRaw('case when paid_on is null then 0 else 1 end')
            ->orderByDesc(DB::raw('coalesce(maintenance_jobs.paid_on, maintenance_jobs.completed_on, maintenance_jobs.reported_on)'))
            ->orderByDesc('id')
            ->get();
    }

    /**
     * The one-off payments for the property dated in the period, and those
     * from before it still to pay: still to pay first, then the latest.
     *
     * @return Collection<int, OtherPayment>
     */
    private function otherPayments(Property $property, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return OtherPayment::query()
            ->where('property_id', $property->id)
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $inPeriod) => $inPeriod->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to))
                ->orWhere(fn (Builder $earlier) => $earlier->where('status', 'pending')->whereDate('payment_date', '<', $from)))
            ->orderByRaw("case status when 'pending' then 0 when 'paid' then 1 else 2 end")
            ->orderByDesc('payment_date')
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
