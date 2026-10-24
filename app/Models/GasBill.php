<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * A month's gas at one property, charged to a client whose contract does
 * not include gas. The client is charged on the bill's own invoice (of
 * kind `gas`), which is paid like any other invoice; the bill stands where
 * its invoice stands (issued, partly paid, paid or void).
 *
 * Gas is either metered, with two readings and a rate per unit (the amount
 * is the units used at that rate), or charged as a fixed amount. Bills are
 * made with record() and changed with revise(), which keep the invoice in
 * step; once anything has been paid towards the invoice the bill is fixed.
 */
#[Fillable(['previous_reading', 'current_reading', 'unit_rate', 'amount', 'vat_rate', 'supplier_reference', 'notes'])]
class GasBill extends Model
{
    public const DOCUMENT_DISK = 'local';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'previous_reading' => 'decimal:2',
            'current_reading' => 'decimal:2',
            'unit_rate' => 'decimal:2',
            'amount' => 'decimal:2',
            'vat_rate' => 'decimal:2',
        ];
    }

    /**
     * The days of `$month` that `$contract` runs, from its start to its last
     * day (the termination date for one stopped early). Null when the
     * contract does not run in that month.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public static function periodFor(Contract $contract, CarbonInterface $month): ?array
    {
        $month = CarbonImmutable::parse($month)->startOfMonth();
        $start = $contract->start_date->toImmutable();
        $last = ($contract->terminated_on ?? $contract->end_date)->toImmutable();

        $from = $month->lt($start) ? $start : $month;
        $to = $month->endOfMonth()->startOfDay();
        $to = $to->gt($last) ? $last : $to;

        return $from->lte($to) ? [$from, $to] : null;
    }

    /**
     * Bill `$contract`'s client for the gas used at `$property` over
     * `$period`, on an invoice issued on `$issuedOn` and due after the
     * contract's payment terms.
     *
     * @param  array{0: CarbonInterface, 1: CarbonInterface}  $period
     * @param  array<string, mixed>  $attributes  The bill's own fields.
     */
    public static function record(Contract $contract, Property $property, array $period, array $attributes, CarbonInterface $issuedOn, ?User $by = null): self
    {
        return DB::transaction(function () use ($contract, $property, $period, $attributes, $issuedOn, $by) {
            $bill = new self($attributes);
            $bill->forceFill([
                'company_id' => $contract->company_id,
                'contract_id' => $contract->id,
                'property_id' => $property->id,
                'period_start' => $period[0],
                'period_end' => $period[1],
                'recorded_by' => $by?->id,
            ]);
            $bill->setRelation('contract', $contract);
            $bill->setRelation('property', $property);

            $invoice = $bill->writeInvoice(new Invoice, $issuedOn);
            $bill->forceFill(['invoice_id' => $invoice->id])->save();

            return $bill->setRelation('invoice', $invoice);
        });
    }

    /**
     * Change what the bill charges, and its invoice with it.
     *
     * @param  array<string, mixed>  $attributes  The bill's own fields.
     *
     * @throws ValidationException When the invoice was voided or something has been paid towards it.
     */
    public function revise(array $attributes, CarbonInterface $issuedOn): void
    {
        if (! $this->isEditable()) {
            throw ValidationException::withMessages(['bill' => "Gas bill {$this->invoice->invoice_number} can no longer be changed: it has been paid towards or voided."]);
        }

        DB::transaction(function () use ($attributes, $issuedOn) {
            $this->fill($attributes);
            $this->writeInvoice($this->invoice, $issuedOn);
            $this->save();
        });
    }

    /**
     * Whether the bill can still be changed: its invoice is open and nothing
     * has been paid or allocated towards it.
     */
    public function isEditable(): bool
    {
        $invoice = $this->invoice;

        return $invoice->status === 'issued' && (int) ($invoice->allocations_count ?? $invoice->allocations()->count()) === 0;
    }

    /**
     * Gas used between the two readings, or null when the gas is not metered.
     */
    public function units(): ?float
    {
        if ($this->previous_reading === null || $this->current_reading === null) {
            return null;
        }

        return round((float) $this->current_reading - (float) $this->previous_reading, 2);
    }

    /**
     * Whether the amount is the units used at a rate, rather than a fixed charge.
     */
    public function isMetered(): bool
    {
        return $this->units() !== null && $this->unit_rate !== null;
    }

    /**
     * The bill as its invoice line reads: "Gas · Al Quoz Camp · 1 Oct 2026 – 31 Oct 2026 · meter 1,200 → 1,350".
     */
    public function describe(): string
    {
        $parts = ['Gas', $this->property->name, $this->period_start->format('j M Y').' – '.$this->period_end->format('j M Y')];

        if ($this->isMetered()) {
            $parts[] = 'meter '.self::reading($this->previous_reading).' → '.self::reading($this->current_reading);
        }

        return implode(' · ', $parts);
    }

    /**
     * Keep a photo or PDF of the supplier's bill or the meter, replacing any kept before.
     */
    public function storeDocument(UploadedFile $file): void
    {
        $this->removeDocument();

        $path = $file->storeAs(
            "gas-bills/{$this->company_id}/{$this->id}",
            'bill-'.Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::DOCUMENT_DISK,
        );

        $this->forceFill(['document_path' => $path, 'document_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeDocument(): void
    {
        if ($this->document_path) {
            Storage::disk(self::DOCUMENT_DISK)->delete($this->document_path);
            $this->forceFill(['document_path' => null, 'document_name' => null])->save();
        }
    }

    /**
     * Fill `$invoice` from the bill (a new one is numbered on the day it is
     * issued) and replace its single gas line.
     */
    private function writeInvoice(Invoice $invoice, CarbonInterface $issuedOn): Invoice
    {
        $issued = CarbonImmutable::parse($issuedOn);
        $amount = round((float) $this->amount, 2);
        $vat = round($amount * (float) $this->vat_rate / 100, 2);
        $isMetered = $this->isMetered();

        $invoice->fill([
            'issue_date' => $issued,
            'due_date' => $issued->addDays($this->contract->payment_terms_days),
            'period_start' => $this->period_start,
            'period_end' => $this->period_end,
        ]);
        $invoice->forceFill([
            'company_id' => $this->company_id,
            'contract_id' => $this->contract_id,
            'client_id' => $this->contract->client_id,
            'kind' => 'gas',
            'invoice_number' => $invoice->invoice_number ?? Invoice::nextNumber($this->company_id, $issued),
            'subtotal' => $amount,
            'vat_amount' => $vat,
            'total' => round($amount + $vat, 2),
            'status' => 'issued',
        ])->save();

        $invoice->items()->delete();
        $invoice->items()->create([
            'contract_line_id' => null,
            'item_type' => 'gas',
            'description' => $this->describe(),
            'quantity' => $isMetered ? $this->units() : 1,
            'unit_price' => $isMetered ? $this->unit_rate : $amount,
            'vat_rate' => $this->vat_rate,
            'amount' => $amount,
            'vat_amount' => $vat,
        ]);

        return $invoice;
    }

    /**
     * A meter reading without trailing zeros: 1,200 or 1,200.5.
     */
    private static function reading(string|float $value): string
    {
        return rtrim(rtrim(number_format((float) $value, 2), '0'), '.');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Contract, $this>
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * The invoice the client is charged on.
     *
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
