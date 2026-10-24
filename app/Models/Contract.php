<?php

namespace App\Models;

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
 * deposit; clearing a cheque settles that period's invoice. Gas is either
 * included in the rent (`gas_included`) or charged on top: then each
 * month's gas at a property is a GasBill with its own invoice.
 *
 * Lifecycle: draft → active → ended (its end date passed) or terminated
 * (stopped early). Status changes go through activate(), markEnded() and
 * terminate(), which also check occupants out and keep apartment and shop
 * statuses in step.
 */
#[Fillable([
    'ejari_number',
    'start_date',
    'end_date',
    'billing_cycle',
    'payment_terms_days',
    'security_deposit',
    'gas_included',
    'signed_on',
    'notes',
])]
class Contract extends Model
{
    /** @use HasFactory<ContractFactory> */
    use HasCheques, HasDocumentNumber, HasFactory, SoftDeletes;

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
            'gas_included' => 'boolean',
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
     * Put a draft into force.
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

        $missing = $this->chequesMissingForThisYear();

        if ($missing > 0) {
            throw ValidationException::withMessages(['cheques' => "Collect this year's cheques before activating: {$missing} still need their number, bank and a photo of the front."]);
        }

        $this->forceFill(['status' => 'active', 'signed_on' => $this->signed_on ?? $signedOn ?? today()])->save();
        $this->syncUnitStatuses();
    }

    /**
     * How many cheques dated up to the end of the current contract year are
     * not in hand yet, or have no photo of the front.
     */
    public function chequesMissingForThisYear(): int
    {
        [, $yearEnd] = $this->currentChequeYear();

        return $this->cheques()
            ->whereIn('status', ['pending', 'received'])
            ->whereDate('cheque_date', '<=', $yearEnd)
            ->where(fn ($query) => $query->where('status', 'pending')->orWhereNull('front_image_path'))
            ->count();
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
     * once the whole term is invoiced. Gas invoices are not billing periods.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function nextBillingPeriod(): ?array
    {
        $lastEnd = $this->invoices()->where('kind', 'rent')->whereNot('status', 'void')->max('period_end');
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
                'kind' => 'rent',
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

            return $invoice;
        });
    }

    /**
     * Set each apartment and shop on the contract to what the contract means
     * for it today: occupied while a running line covers today, reserved for a
     * draft or a line that starts later, vacant once the contract is over and
     * no other live contract holds it. Units under maintenance or inactive are
     * left alone.
     */
    public function syncUnitStatuses(): void
    {
        $today = today();

        foreach ($this->lines()->with(['apartment', 'shop'])->get() as $line) {
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
     * The client's monthly gas bills, when gas is not included in the rent.
     *
     * @return HasMany<GasBill, $this>
     */
    public function gasBills(): HasMany
    {
        return $this->hasMany(GasBill::class);
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
