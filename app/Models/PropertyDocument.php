<?php

namespace App\Models;

use Database\Factories\PropertyDocumentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'head_lease_id',
    'document_type',
    'title',
    'document_number',
    'file_url',
    'issued_on',
    'expires_on',
    'notes',
])]
class PropertyDocument extends Model
{
    /** @use HasFactory<PropertyDocumentFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Document types offered when adding a document to a property.
     */
    public const TYPES = [
        'title_deed',
        'tenancy_contract',
        'civil_defence_certificate',
        'insurance_policy',
        'municipality_permit',
        'labour_accommodation_permit',
        'emirates_id',
        'passport',
        'trade_license',
        'other',
    ];

    /**
     * Documents every property must have.
     */
    public const REQUIRED_TYPES = [
        'tenancy_contract',
        'emirates_id',
        'trade_license',
        'passport',
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
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<HeadLease, $this>
     */
    public function headLease(): BelongsTo
    {
        return $this->belongsTo(HeadLease::class);
    }
}
