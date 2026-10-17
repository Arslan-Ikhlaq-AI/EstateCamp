<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One instalment the operator owes a landlord, usually a post-dated cheque.
 */
#[Fillable([
    'payment_method',
    'cheque_number',
    'bank_name',
    'status',
    'paid_on',
    'reference',
    'notes',
])]
class HeadLeasePayment extends Model
{
    public const STATUSES = ['scheduled', 'paid', 'bounced', 'cancelled'];

    public const METHODS = ['cheque', 'bank_transfer', 'cash'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'installment_number' => 'integer',
            'due_date' => 'date',
            'amount' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }

    /**
     * A scheduled instalment whose due date has passed.
     */
    public function isOverdue(): bool
    {
        return $this->status === 'scheduled' && $this->due_date->lt(today());
    }

    /**
     * @return BelongsTo<HeadLease, $this>
     */
    public function headLease(): BelongsTo
    {
        return $this->belongsTo(HeadLease::class);
    }
}
