<?php

namespace App\Models;

use App\Models\Concerns\ComesWithAgreement;
use App\Models\Concerns\HasDocumentNumber;
use App\Models\Concerns\HasSettlements;
use Database\Factories\CommissionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * The commission taken with a contract or a short-term rental, as a
 * percentage of the rent (`rate` keeps it) or an exact amount. It stays out
 * of payments, revenue and the reports.
 */
#[Fillable([
    'rate',
    'amount',
    'notes',
])]
class Commission extends Model
{
    /** @use HasFactory<CommissionFactory> */
    use ComesWithAgreement, HasDocumentNumber, HasFactory, HasSettlements;

    public const NUMBER_PREFIX = 'CM';

    public const NUMBER_COLUMN = 'commission_number';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rate' => 'decimal:2',
            'amount' => 'decimal:2',
            'settled_amount' => 'decimal:2',
            'received_on' => 'date',
            'cheque_date' => 'date',
        ];
    }
}
