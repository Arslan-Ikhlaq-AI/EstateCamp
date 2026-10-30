<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Database\Factories\ExtraIncomeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Money a property earns besides rent (EI-2026-0001), such as the share
 * an internet, gas or washing machine provider pays for serving the
 * building under its own agreement with the company. An admin records it
 * once it is received, so it is always paid; one added by mistake is
 * cancelled and no longer counts. A received one is money in in the cash
 * ledger and on the property's payments.
 *
 * The invoice is kept on the private disk and served only to the
 * company's own users.
 */
#[Fillable(['title', 'received_from', 'amount', 'received_on', 'method', 'invoice_number', 'notes'])]
class ExtraIncome extends Model
{
    /** @use HasFactory<ExtraIncomeFactory> */
    use HasDocumentNumber, HasFactory;

    public const NUMBER_PREFIX = 'EI';

    public const NUMBER_COLUMN = 'income_number';

    public const STATUSES = ['received', 'cancelled'];

    public const METHODS = MaintenanceJob::PAYMENT_METHODS;

    /**
     * The disk holding invoices.
     */
    public const INVOICE_DISK = 'local';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'received_on' => 'date',
        ];
    }

    public function isReceived(): bool
    {
        return $this->status === 'received';
    }

    /**
     * Save the invoice, replacing any earlier one.
     */
    public function storeInvoice(UploadedFile $file): void
    {
        $this->removeInvoice();

        $path = $file->storeAs(
            "extra-incomes/{$this->company_id}/{$this->id}",
            'invoice-'.Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::INVOICE_DISK,
        );

        $this->forceFill(['invoice_path' => $path, 'invoice_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeInvoice(): void
    {
        if ($this->invoice_path) {
            Storage::disk(self::INVOICE_DISK)->delete($this->invoice_path);
            $this->forceFill(['invoice_path' => null, 'invoice_name' => null])->save();
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
}
