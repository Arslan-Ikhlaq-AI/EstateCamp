<?php

namespace App\Models;

use App\Models\Concerns\HasBillingStatement;
use App\Models\Concerns\HasCheques;
use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ContractFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A client renting from the operator. What is rented, and at what rate,
 * lives in its ContractLines. The client pays by cheques, one per billing
 * period (four a year on a quarterly cycle), plus one for the security
 * deposit; clearing a cheque settles that period's invoice.
 *
 * Lifecycle: active from the moment it is saved → ended (its end date
 * passed) or terminated (stopped early). A renewal waits as a draft until
 * its form is saved. Its units are taken for the term whether or not anyone
 * checks in. Status changes go through activate(), markEnded() and
 * terminate(), which also check occupants out and keep apartment and shop
 * statuses and room counts in step.
 */
#[Fillable([
    'ejari_number',
    'start_date',
    'end_date',
    'billing_cycle',
    'payment_terms_days',
    'security_deposit',
    'signed_on',
    'notes',
])]
class Contract extends Model
{
    /** @use HasFactory<ContractFactory> */
    use HasBillingStatement, HasCheques, HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'CTR';

    public const NUMBER_COLUMN = 'contract_number';

    public const STATUSES = ['draft', 'active', 'ended', 'terminated'];

    /**
     * Each billing cycle and how many months one invoice covers.
     */
    public const BILLING_CYCLES = ['monthly' => 1, 'quarterly' => 3, 'semi_annual' => 6, 'annual' => 12];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'signed_on' => 'date',
            'terminated_on' => 'date',
            'payment_terms_days' => 'integer',
            'security_deposit' => 'decimal:2',
        ];
    }

    /**
     * Drafts and running contracts can still change; ended and terminated ones are history.
     */
    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'active'], true);
    }

    /**
     * The monthly rent of the lines running today, or on the nearest day of
     * the term for a contract that has not started or has finished.
     */
    public function monthlyValue(): float
    {
        $day = today();

        if ($day->lt($this->start_date)) {
            $day = $this->start_date;
        } elseif ($day->gt($this->end_date)) {
            $day = $this->end_date;
        }

        return round($this->lines
            ->filter(fn (ContractLine $line) => $line->covers($day))
            ->sum(fn (ContractLine $line) => (float) $line->monthly_rate * $line->quantity), 2);
    }

    /**
     * The client's cheques come to the company.
     */
    public function chequeDirection(): string
    {
        return 'received';
    }

    /**
     * One cheque per billing period.
     */
    public function monthsPerCheque(): int
    {
        return self::BILLING_CYCLES[$this->billing_cycle];
    }

    /**
     * What the period's invoice should come to: each line running in it,
     * pro-rated by month at its rate, with its VAT. Bed lines billed on
     * actual use are estimated at their contracted beds.
     */
    public function plannedChequeAmount(CarbonImmutable $from, CarbonImmutable $to): float
    {
        $total = 0.0;

        foreach ($this->lines as $line) {
            $lineFrom = $line->start_date->gt($from) ? $line->start_date->toImmutable() : $from;
            $lineTo = $line->end_date->lt($to) ? $line->end_date->toImmutable() : $to;

            if ($lineFrom->gt($lineTo)) {
                continue;
            }

            $amount = round((float) $line->monthly_rate * $lineFrom->floatDiffInMonths($lineTo->addDay()), 2) * $line->quantity;
            $total += $amount + round($amount * (float) $line->vat_rate / 100, 2);
        }

        return round($total, 2);
    }

    /**
     * A saved contract plans from its stored lines; an unsaved one (checking
     * a form before it is saved) from the lines set on it.
     */
    protected function refreshChequeTerms(): void
    {
        if ($this->exists) {
            $this->load('lines');
        }
    }

    /**
     * Issue every invoice whose period starts on or before `$date`, so a
     * cheque for that period has an invoice to settle. Only a running
     * contract is invoiced.
     */
    public function invoiceThrough(CarbonInterface $date): void
    {
        if ($this->status !== 'active') {
            return;
        }

        for ($guard = 0; $guard < 600; $guard++) {
            $period = $this->nextBillingPeriod();

            if ($period === null || $period[0]->gt($date)) {
                return;
            }

            $this->generateNextInvoice();
        }
    }

    /**
     * Put a draft into force. Cheques can be collected afterwards.
     *
     * @throws ValidationException When the contract is not a draft or has no lines.
     */
    public function activate(?CarbonInterface $signedOn = null): void
    {
        if ($this->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only a draft contract can be activated.']);
        }

        if (! $this->lines()->exists()) {
            throw ValidationException::withMessages(['lines' => 'Add at least one line before activating the contract.']);
        }

        $this->forceFill(['status' => 'active', 'signed_on' => $this->signed_on ?? $signedOn ?? today()])->save();
        $this->syncUnitStatuses();
    }

    /**
     * Stop the contract early: everyone staying under it checks out on `$on`.
     * A draft can be terminated too, which cancels it.
     *
     * @throws ValidationException When the contract has already ended.
     */
    public function terminate(CarbonInterface $on, ?string $reason = null): void
    {
        if (! $this->isEditable()) {
            throw ValidationException::withMessages(['status' => 'This contract has already ended.']);
        }

        DB::transaction(function () use ($on, $reason) {
            $this->closeOpenStays($on);
            $this->forceFill(['status' => 'terminated', 'terminated_on' => $on, 'termination_reason' => $reason])->save();
            $this->syncUnitStatuses();

            // Cheques still expected for the time after the contract stops are no longer due.
            $this->cheques()->where('status', 'pending')->whereDate('cheque_date', '>', $on)->update(['status' => 'cancelled', 'cheque_status_id' => ChequeStatus::firstIn('cancelled')?->id]);
        });
    }

    /**
     * Close a running contract whose end date has passed; occupants still in
     * check out the day after the last day of the term.
     */
    public function markEnded(): void
    {
        if ($this->status !== 'active') {
            return;
        }

        DB::transaction(function () {
            $this->closeOpenStays($this->end_date->copy()->addDay());
            $this->forceFill(['status' => 'ended'])->save();
            $this->syncUnitStatuses();
        });
    }

    /**
     * A new draft for the following term with the same client, terms and lines.
     */
    public function startRenewal(): Contract
    {
        $termMonths = max(1, (int) round($this->start_date->floatDiffInMonths($this->end_date->copy()->addDay())));
        $start = $this->end_date->toImmutable()->addDay();
        $end = $start->addMonthsNoOverflow($termMonths)->subDay();

        return DB::transaction(function () use ($start, $end) {
            $renewal = $this->replicate(['contract_number', 'ejari_number', 'status', 'signed_on', 'terminated_on', 'termination_reason']);
            $renewal->forceFill([
                'contract_number' => self::nextNumber($this->company_id),
                'status' => 'draft',
                'start_date' => $start,
                'end_date' => $end,
                'renewed_from_id' => $this->id,
            ])->save();

            foreach ($this->lines as $line) {
                $line->replicate()->forceFill(['contract_id' => $renewal->id, 'start_date' => $start, 'end_date' => $end])->save();
            }

            return $renewal;
        });
    }

    /**
     * The next period to invoice, from the day after the last invoiced period
     * (or the start date) for one billing cycle, capped at the end date. Null
     * once the whole term is invoiced.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function nextBillingPeriod(): ?array
    {
        $lastEnd = $this->invoices()->whereNot('status', 'void')->max('period_end');
        $start = $lastEnd ? CarbonImmutable::parse($lastEnd)->addDay() : $this->start_date->toImmutable();

        if ($start->gt($this->end_date)) {
            return null;
        }

        $end = $start->addMonthsNoOverflow(self::BILLING_CYCLES[$this->billing_cycle])->subDay();

        return [$start, $end->gt($this->end_date) ? $this->end_date->toImmutable() : $end];
    }

    /**
     * Invoice the next billing period. Each line is charged for the part of the
     * period it runs, pro-rated by month, at its own rate and VAT; the first
     * invoice also collects the security deposit. Returns null when the whole
     * term is already invoiced.
     *
     * @throws ValidationException When the contract is not active.
     */
    public function generateNextInvoice(?CarbonInterface $issueDate = null): ?Invoice
    {
        if ($this->status !== 'active') {
            throw ValidationException::withMessages(['invoice' => 'Only an active contract can be invoiced.']);
        }

        $period = $this->nextBillingPeriod();

        if ($period === null) {
            return null;
        }

        [$periodStart, $periodEnd] = $period;
        $issued = CarbonImmutable::parse($issueDate ?? today());
        $isFirstInvoice = $periodStart->equalTo($this->start_date);

        $this->loadMissing(['lines.property', 'lines.room', 'lines.apartment', 'lines.shop']);

        return DB::transaction(function () use ($periodStart, $periodEnd, $issued, $isFirstInvoice) {
            $items = [];

            foreach ($this->lines as $line) {
                $from = $line->start_date->gt($periodStart) ? $line->start_date->toImmutable() : $periodStart;
                $to = $line->end_date->lt($periodEnd) ? $line->end_date->toImmutable() : $periodEnd;

                if ($from->gt($to)) {
                    continue;
                }

                $quantity = $line->billedQuantity($from, $to);

                if ($quantity === 0) {
                    continue;
                }

                $unitPrice = round((float) $line->monthly_rate * $from->floatDiffInMonths($to->addDay()), 2);
                $amount = round($unitPrice * $quantity, 2);

                $items[] = [
                    'contract_line_id' => $line->id,
                    'item_type' => 'rent',
                    'description' => $line->describe().' · '.$from->format('j M Y').' – '.$to->format('j M Y'),
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'vat_rate' => $line->vat_rate,
                    'amount' => $amount,
                    'vat_amount' => round($amount * (float) $line->vat_rate / 100, 2),
                ];
            }

            if ($isFirstInvoice && (float) $this->security_deposit > 0) {
                $items[] = [
                    'contract_line_id' => null,
                    'item_type' => 'deposit',
                    'description' => 'Security deposit (refundable)',
                    'quantity' => 1,
                    'unit_price' => $this->security_deposit,
                    'vat_rate' => 0,
                    'amount' => $this->security_deposit,
                    'vat_amount' => 0,
                ];
            }

            $subtotal = round(array_sum(array_map(fn (array $item) => (float) $item['amount'], $items)), 2);
            $vatAmount = round(array_sum(array_column($items, 'vat_amount')), 2);
            $total = round($subtotal + $vatAmount, 2);

            $invoice = new Invoice([
                'issue_date' => $issued,
                'due_date' => $issued->addDays($this->payment_terms_days),
                'period_start' => $periodStart,
                'period_end' => $periodEnd,
            ]);
            $invoice->forceFill([
                'company_id' => $this->company_id,
                'contract_id' => $this->id,
                'client_id' => $this->client_id,
                'invoice_number' => Invoice::nextNumber($this->company_id, $issued),
                'subtotal' => $subtotal,
                'vat_amount' => $vatAmount,
                'total' => $total,
                // A new invoice has no payments yet; one for nothing is settled already.
                'status' => $total > 0 ? 'issued' : 'paid',
            ])->save();

            $now = now();
            InvoiceItem::query()->insert(array_map(
                fn (array $item) => [...$item, 'invoice_id' => $invoice->id, 'created_at' => $now, 'updated_at' => $now],
                $items,
            ));

            $this->applyCredit($invoice);

            return $invoice->refresh();
        });
    }

    /**
     * Settle a new invoice from money the client paid ahead on this
     * contract: the credit left on payments collected towards it, oldest
     * first.
     */
    private function applyCredit(Invoice $invoice): void
    {
        $due = $invoice->balance();

        if ($due <= 0) {
            return;
        }

        $payments = $this->payments()
            ->where('status', 'cleared')
            ->withSum('allocations as allocated', 'amount')
            ->orderBy('received_on')
            ->orderBy('id')
            ->get();

        foreach ($payments as $payment) {
            $share = min($payment->unallocatedAmount(), $due);

            if ($share > 0) {
                $payment->allocate([$invoice->id => $share]);
                $due = round($due - $share, 2);
            }

            if ($due <= 0) {
                break;
            }
        }
    }

    /**
     * The client's bill: every invoice not voided, on the first day of its
     * period, then, while the contract runs, each billing period begun by `$through` that is not
     * invoiced yet, at what its invoice is planned to come to (the first
     * also collects the deposit). Uses loaded `invoices` when present.
     *
     * @return list<array{key: string, type: string, id: ?int, number: ?string, start: CarbonImmutable, end: CarbonImmutable, chargedOn: CarbonImmutable, amount: float, isPlanned: bool}>
     */
    public function billingCharges(CarbonInterface $through): array
    {
        $through = CarbonImmutable::parse($through)->startOfDay();
        $invoices = ($this->relationLoaded('invoices') ? $this->invoices : $this->invoices()->get())->reject(fn (Invoice $invoice) => $invoice->status === 'void');
        $charges = $invoices
            ->map(fn (Invoice $invoice) => [
                'key' => "invoice-{$invoice->id}",
                'type' => 'rent',
                'id' => $invoice->id,
                'number' => $invoice->invoice_number,
                'start' => $invoice->period_start->toImmutable(),
                'end' => $invoice->period_end->toImmutable(),
                'chargedOn' => $invoice->period_start->toImmutable(),
                'amount' => (float) $invoice->total,
                'isPlanned' => false,
            ])
            ->filter(fn (array $charge) => $charge['chargedOn']->lte($through))
            ->values();

        if ($this->status === 'active') {
            $lastEnd = $invoices->max('period_end');
            $start = $lastEnd ? $lastEnd->toImmutable()->addDay() : $this->start_date->toImmutable();
            $months = self::BILLING_CYCLES[$this->billing_cycle];

            for ($guard = 0; $guard < 600 && $start->lte($this->end_date) && $start->lte($through); $guard++) {
                $end = $start->addMonthsNoOverflow($months)->subDay();
                $end = $end->gt($this->end_date) ? $this->end_date->toImmutable() : $end;
                $planned = ['id' => null, 'number' => null, 'start' => $start, 'end' => $end, 'chargedOn' => $start, 'isPlanned' => true];

                if ($start->equalTo($this->start_date) && (float) $this->security_deposit > 0) {
                    $charges->push([...$planned, 'key' => 'planned-deposit', 'type' => 'deposit', 'amount' => round((float) $this->security_deposit, 2)]);
                }

                $charges->push([...$planned, 'key' => "planned-{$start->toDateString()}", 'type' => 'rent', 'amount' => $this->plannedChequeAmount($start, $end)]);
                $start = $end->addDay();
            }
        }

        return $charges->sortBy([['chargedOn', 'asc'], ['start', 'asc']])->values()->all();
    }

    /**
     * Cleared payments towards the contract, each counting what it put
     * towards the contract's invoices plus, when it was collected towards
     * this contract, the credit it still holds for the next ones. Uses
     * loaded `invoices.allocations.payment` and `payments` (with an
     * `allocated` sum) when present.
     *
     * @return list<array{key: string, id: int, number: string, paidOn: CarbonImmutable, method: string, amount: float}>
     */
    public function billingPayments(): array
    {
        $allocations = $this->relationLoaded('invoices')
            ? $this->invoices->flatMap(fn (Invoice $invoice) => $invoice->allocations)
            : PaymentAllocation::query()->whereIn('invoice_id', $this->invoices()->select('id'))->with('payment')->get();
        $credits = ($this->relationLoaded('payments') ? $this->payments : $this->payments()->withSum('allocations as allocated', 'amount')->get())
            ->filter(fn (Payment $payment) => $payment->status === 'cleared');
        $entry = fn (Payment $payment, float $amount) => [
            'key' => "payment-{$payment->id}",
            'id' => $payment->id,
            'number' => $payment->payment_number,
            'paidOn' => $payment->received_on->toImmutable(),
            'method' => $payment->method,
            'amount' => $amount,
        ];

        $entries = $allocations
            ->filter(fn (PaymentAllocation $allocation) => $allocation->payment->status === 'cleared')
            ->groupBy('payment_id')
            ->map(fn ($shares) => $entry($shares->first()->payment, round($shares->sum(fn (PaymentAllocation $share) => (float) $share->amount), 2)));

        foreach ($credits as $payment) {
            $credit = $payment->unallocatedAmount();

            if ($credit > 0) {
                $entries->put($payment->id, $entry($payment, round(($entries->get($payment->id)['amount'] ?? 0) + $credit, 2)));
            }
        }

        return $entries->sortBy([['paidOn', 'asc'], ['id', 'asc']])->values()->all();
    }

    /**
     * Bills run to the contract's end date.
     */
    protected function lastBillingDay(): ?CarbonInterface
    {
        return $this->end_date;
    }

    /**
     * Issue the invoices of every billing period begun by `$through`, so
     * the money has an invoice to settle.
     */
    protected function prepareCollection(CarbonInterface $through): void
    {
        $this->invoiceThrough($through);
        $this->unsetRelation('invoices');
        $this->unsetRelation('payments');
    }

    /**
     * A payment from the client towards this contract, spread over its open
     * invoices oldest first. What is left over stays on the payment as
     * credit, which settles the contract's next invoices as they are issued.
     */
    protected function recordCollection(float $amount, CarbonInterface $through, string $method, ?User $by): Payment
    {
        $receivedOn = today();
        $payment = new Payment(['received_on' => $receivedOn, 'amount' => $amount, 'method' => $method, 'status' => 'cleared', 'reference' => $this->contract_number]);
        $payment->forceFill([
            'company_id' => $this->company_id,
            'client_id' => $this->client_id,
            'contract_id' => $this->id,
            'payment_number' => Payment::nextNumber($this->company_id, $receivedOn),
        ])->save();

        $remaining = $amount;
        $amounts = [];

        foreach ($this->invoices()->whereIn('status', ['issued', 'partially_paid'])->orderBy('period_start')->orderBy('id')->get() as $invoice) {
            if ($remaining <= 0) {
                break;
            }

            $share = min($remaining, $invoice->balance());
            $amounts[$invoice->id] = $share;
            $remaining = round($remaining - $share, 2);
        }

        $payment->allocate($amounts);

        return $payment;
    }

    /**
     * Set each apartment and shop on the contract to what the contract means
     * for it today: occupied while a running line covers today, reserved for a
     * draft or a line that starts later, vacant once the contract is over and
     * no other live contract holds it. Units under maintenance or inactive are
     * left alone. Its rooms recount the beds taken in them.
     */
    public function syncUnitStatuses(): void
    {
        $today = today();
        $lines = $this->lines()->with(['apartment', 'shop'])->get();

        foreach ($lines as $line) {
            $unit = $line->apartment ?? $line->shop;

            if ($unit === null || ! in_array($unit->status, ['vacant', 'occupied', 'reserved'], true)) {
                continue;
            }

            $status = match (true) {
                $this->status === 'active' && $line->covers($today) => 'occupied',
                $this->status === 'draft', $this->status === 'active' && $line->start_date->gt($today) => 'reserved',
                default => 'vacant',
            };

            if ($status === 'vacant' && $line->unitHeldByAnotherContract()) {
                continue;
            }

            $unit->update(['status' => $status]);
        }

        Room::query()->whereKey($lines->pluck('room_id')->filter()->unique())->get()->each->recalculateOccupancy();
    }

    /**
     * Check out everyone still staying under this contract on `$on` (at the
     * earliest the day after they arrived) and refresh their rooms' counts.
     */
    private function closeOpenStays(CarbonInterface $on): void
    {
        $roomIds = [];

        Occupancy::query()
            ->whereIn('contract_line_id', $this->lines()->select('id'))
            ->whereNull('check_out_date')
            ->with('bed')
            ->get()
            ->each(function (Occupancy $stay) use ($on, &$roomIds) {
                $earliest = $stay->check_in_date->copy()->addDay();
                $stay->update(['check_out_date' => $on->lt($earliest) ? $earliest : $on]);
                $roomIds[] = $stay->bed->room_id;
            });

        Room::query()->whereKey(array_unique($roomIds))->get()->each->recalculateOccupancy();
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return HasMany<ContractDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(ContractDocument::class);
    }

    /**
     * @return HasMany<ContractLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(ContractLine::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * Payments collected towards this contract's bill. Payments made
     * against the client's invoices in general are not among them.
     *
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * @return HasManyThrough<Occupancy, ContractLine, $this>
     */
    public function occupancies(): HasManyThrough
    {
        return $this->hasManyThrough(Occupancy::class, ContractLine::class);
    }

    /**
     * @return BelongsTo<Contract, $this>
     */
    public function renewedFrom(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'renewed_from_id');
    }

    /**
     * @return HasOne<Contract, $this>
     */
    public function renewal(): HasOne
    {
        return $this->hasOne(Contract::class, 'renewed_from_id');
    }
}
