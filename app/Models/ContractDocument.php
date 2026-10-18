<?php

namespace App\Models;

use Database\Factories\ContractDocumentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'document_type',
    'title',
    'document_number',
    'file_url',
    'issued_on',
    'expires_on',
    'notes',
])]
class ContractDocument extends Model
{
    /** @use HasFactory<ContractDocumentFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Document types offered when adding a document to a contract.
     */
    public const TYPES = [
        'signed_contract',
        'trade_license',
        'emirates_id',
        'passport',
        'vat_certificate',
        'other',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
            'expires_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Contract, $this>
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
