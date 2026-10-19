<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * Money received from a client, spread over its invoices through
 * PaymentAllocations. A post-dated cheque is `pending` until it clears and
 * only then counts towards those invoices.
 */
#[Fillable([
    'received_on',
    'amount',
    'method',
    'status',
    'reference',
    'cheque_number',
    'cheque_date',
    'bank_name',
    'notes',
])]
class Payment extends Model
{
    use HasDocumentNumber;

    public const NUMBER_PREFIX = 'RCPT';

    public const NUMBER_COLUMN = 'payment_number';

    public const METHODS = ['cash', 'bank_transfer', 'cheque', 'card'];

    public const STATUSES = ['pending', 'cleared', 'bounced'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'received_on' => 'date',
            'cheque_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * Allocate the payment to invoices and refresh what each has been paid.
     *
     * @param  array<int, float>  $amounts  Invoice id => amount; zero amounts are skipped.
     */
    public function allocate(array $amounts): void
    {
        DB::transaction(function () use ($amounts) {
            foreach ($amounts as $invoiceId => $amount) {
                if ($amount > 0) {
                    $this->allocations()->create(['invoice_id' => $invoiceId, 'client_id' => $this->client_id, 'amount' => round($amount, 2)]);
                }
            }

            $this->refreshInvoices();
        });
    }

    /**
     * Record that a cheque cleared or bounced, and refresh its invoices.
     */
    public function changeStatus(string $status): void
    {
        DB::transaction(function () use ($status) {
            $this->update(['status' => $status]);
            $this->refreshInvoices();
        });
    }

    /**
     * How much of the payment is allocated to invoices.
     */
    public function allocatedAmount(): float
    {
        return round((float) $this->allocations()->sum('amount'), 2);
    }

    /**
     * Recalculate every invoice this payment is allocated to.
     */
    private function refreshInvoices(): void
    {
        Invoice::query()
            ->whereKey($this->allocations()->pluck('invoice_id'))
            ->get()
            ->each->recalculatePaid();
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
     * The cheque this payment was made by, when it came from clearing one.
     *
     * @return BelongsTo<Cheque, $this>
     */
    public function cheque(): BelongsTo
    {
        return $this->belongsTo(Cheque::class);
    }

    /**
     * @return HasMany<PaymentAllocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
