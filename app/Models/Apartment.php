<?php

namespace App\Models;

use Database\Factories\ApartmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'apartment_number',
    'block',
    'floor_number',
    'bedrooms',
    'bathrooms',
    'area_sqm',
    'furnishing_status',
    'max_occupants',
    'amenities',
    'monthly_rent',
    'security_deposit',
    'utility_account_number',
    'status',
    'notes',
])]
class Apartment extends Model
{
    /** @use HasFactory<ApartmentFactory> */
    use HasFactory, SoftDeletes;

    public const STATUSES = ['vacant', 'occupied', 'reserved', 'under_maintenance', 'inactive'];

    public const FURNISHING_STATUSES = ['furnished', 'semi_furnished', 'unfurnished'];

    public const AMENITIES = [
        'air_conditioning',
        'wifi',
        'kitchen',
        'balcony',
        'parking',
        'built_in_wardrobes',
        'laundry_area',
        'maid_room',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'floor_number' => 'integer',
            'bedrooms' => 'integer',
            'bathrooms' => 'integer',
            'area_sqm' => 'decimal:2',
            'max_occupants' => 'integer',
            'amenities' => 'array',
            'monthly_rent' => 'decimal:2',
            'security_deposit' => 'decimal:2',
        ];
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
}
