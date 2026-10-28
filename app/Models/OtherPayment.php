<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonInterface;
use Database\Factories\OtherPaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * A one-off payment the company makes for a property that is neither rent,
 * a maintenance contract nor a maintenance job, such as a permit fee or a
 * supply bought for the building (OP-2026-0001). It is to pay, paid or
 * cancelled; `payment_date` is the day it was paid, or the day it is due
 * while still to pay. A paid one is money out in the cash ledger.
 *
 * The receipt is kept on the private disk and served only to the
 * company's own users.
 */
#[Fillable(['title', 'paid_to', 'amount', 'payment_date', 'method', 'reference', 'notes'])]
class OtherPayment extends Model
{
    /** @use HasFactory<OtherPaymentFactory> */
    use HasDocumentNumber, HasFactory;

    public const NUMBER_PREFIX = 'OP';

    public const NUMBER_COLUMN = 'payment_number';

    public const STATUSES = ['pending', 'paid', 'cancelled'];

    public const METHODS = MaintenanceJob::PAYMENT_METHODS;

    /**
     * The disk holding receipts.
     */
    public const RECEIPT_DISK = 'local';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'date',
        ];
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    /**
     * Record that it was paid on `$on`, and how.
     */
    public function markPaid(CarbonInterface $on, string $method, ?User $by = null): void
    {
        $this->forceFill(['status' => 'paid', 'payment_date' => $on, 'method' => $method, 'paid_by' => $by?->id])->save();
    }

    /**
     * Put it back as still to pay, such as a payment recorded by mistake.
     */
    public function markPending(): void
    {
        $this->forceFill(['status' => 'pending', 'paid_by' => null])->save();
    }

    public function cancel(): void
    {
        $this->forceFill(['status' => 'cancelled', 'paid_by' => null])->save();
    }

    /**
     * Save the receipt, replacing any earlier one.
     */
    public function storeReceipt(UploadedFile $file): void
    {
        $this->removeReceipt();

        $path = $file->storeAs(
            "other-payments/{$this->company_id}/{$this->id}",
            'receipt-'.Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::RECEIPT_DISK,
        );

        $this->forceFill(['receipt_path' => $path, 'receipt_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeReceipt(): void
    {
        if ($this->receipt_path) {
            Storage::disk(self::RECEIPT_DISK)->delete($this->receipt_path);
            $this->forceFill(['receipt_path' => null, 'receipt_name' => null])->save();
        }
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
