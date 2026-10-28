<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

/**
 * What a contract's client is charged for one billing period of rent,
 * created by Contract::generateNextInvoice(). `amount_paid` and `status`
 * follow from the cleared payments allocated to it
 * (recalculatePaid()).
 */
#[Fillable(['issue_date', 'due_date', 'period_start', 'period_end', 'notes'])]
class Invoice extends Model
{
    use HasDocumentNumber;

    public const NUMBER_PREFIX = 'INV';

    public const NUMBER_COLUMN = 'invoice_number';

    public const STATUSES = ['issued', 'partially_paid', 'paid', 'void'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'subtotal' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'amount_paid' => 'decimal:2',
        ];
    }

    /**
     * What is still owed on the invoice.
     */
    public function balance(): float
    {
        return $this->status === 'void' ? 0.0 : round((float) $this->total - (float) $this->amount_paid, 2);
    }

    /**
     * Unpaid money past its due date.
     */
    public function isOverdue(): bool
    {
        return $this->balance() > 0 && $this->due_date->lt(today());
    }

    /**
     * Refresh `amount_paid` and `status` from the allocations of cleared
     * payments. Pending cheques and bounced payments do not count.
     */
    public function recalculatePaid(): void
    {
        if ($this->status === 'void') {
            return;
        }

        $paid = round((float) $this->allocations()
            ->whereHas('payment', fn (Builder $payments) => $payments->where('status', 'cleared'))
            ->sum('amount'), 2);
        $total = (float) $this->total;

        $status = match (true) {
            $paid >= $total => 'paid',
            $paid > 0 => 'partially_paid',
            default => 'issued',
        };

        $this->forceFill(['amount_paid' => min($paid, $total), 'status' => $status])->save();
    }

    /**
     * Cancel an invoice issued by mistake. Its period can then be invoiced again.
     *
     * @throws ValidationException When payments are allocated to it.
     */
    public function void(): void
    {
        if ($this->allocations()->exists()) {
            throw ValidationException::withMessages(['invoice' => 'Remove the payments allocated to this invoice before voiding it.']);
        }

        $this->forceFill(['status' => 'void', 'amount_paid' => 0])->save();
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
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return HasMany<InvoiceItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
