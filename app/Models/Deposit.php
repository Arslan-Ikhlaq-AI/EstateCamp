<?php

namespace App\Models;

use App\Models\Concerns\ComesWithAgreement;
use App\Models\Concerns\HasDocumentNumber;
use App\Models\Concerns\HasSettlements;
use Database\Factories\DepositFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The security deposit taken with a contract or a short-term rental. It is
 * the tenant's money held by the company, so it stays out of payments,
 * revenue and the reports; handing it back is a settlement.
 */
#[Fillable([
    'amount',
    'notes',
])]
class Deposit extends Model
{
    /** @use HasFactory<DepositFactory> */
    use ComesWithAgreement, HasDocumentNumber, HasFactory, HasSettlements;

    public const NUMBER_PREFIX = 'DP';

    public const NUMBER_COLUMN = 'deposit_number';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'settled_amount' => 'decimal:2',
            'received_on' => 'date',
            'cheque_date' => 'date',
        ];
    }
}
