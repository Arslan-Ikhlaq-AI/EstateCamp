<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A receipt for money an individual paid towards their room rental: rent
 * (noting the months it paid for), the security deposit, or another
 * charge. A receipt is never deleted; one made by mistake, or whose cheque
 * bounced, is voided and stops counting. Cash is collected on site by the
 * camp boss and stays with them until an admin confirms receiving it.
 */
#[Fillable(['paid_on', 'amount', 'purpose', 'method', 'reference', 'notes'])]
class RentalPayment extends Model
{
    use HasDocumentNumber;

    public const NUMBER_PREFIX = 'RR';

    public const NUMBER_COLUMN = 'receipt_number';

    public const PURPOSES = ['rent', 'deposit', 'other'];

    public const METHODS = RoomRental::PAYMENT_METHODS;

    public const STATUSES = ['cleared', 'void'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'voided_on' => 'date',
            'handed_over_at' => 'datetime',
            'amount' => 'decimal:2',
        ];
    }

    public function isVoid(): bool
    {
        return $this->status === 'void';
    }

    /**
     * Whether this is cash still with whoever collected it: not voided and
     * not yet confirmed as handed over to the company.
     */
    public function awaitsHandover(): bool
    {
        return $this->method === 'cash' && ! $this->isVoid() && $this->handed_over_at === null;
    }

    /**
     * Stop the receipt counting, keeping it on record with why.
     */
    public function void(CarbonInterface $on, ?string $reason = null): void
    {
        if ($this->isVoid()) {
            return;
        }

        $this->forceFill(['status' => 'void', 'voided_on' => $on, 'void_reason' => filled($reason) ? trim($reason) : null])->save();
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<RoomRental, $this>
     */
    public function rental(): BelongsTo
    {
        return $this->belongsTo(RoomRental::class, 'room_rental_id');
    }

    /**
     * The cheque this receipt came from, when it was paid by cheque.
     *
     * @return BelongsTo<Cheque, $this>
     */
    public function cheque(): BelongsTo
    {
        return $this->belongsTo(Cheque::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /**
     * The admin who confirmed receiving this cash from the camp boss.
     *
     * @return BelongsTo<User, $this>
     */
    public function handedOverTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handed_over_to');
    }
}
