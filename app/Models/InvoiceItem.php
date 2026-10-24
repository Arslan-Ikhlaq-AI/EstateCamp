<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'contract_line_id',
    'item_type',
    'description',
    'quantity',
    'unit_price',
    'vat_rate',
    'amount',
    'vat_amount',
])]
class InvoiceItem extends Model
{
    public const ITEM_TYPES = ['rent', 'deposit', 'gas', 'other'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'amount' => 'decimal:2',
            'vat_amount' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<ContractLine, $this>
     */
    public function contractLine(): BelongsTo
    {
        return $this->belongsTo(ContractLine::class);
    }
}
