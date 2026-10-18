<?php

namespace App\Models;

use App\Models\Concerns\RentedUnderContracts;
use Database\Factories\ShopFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'shop_number',
    'block',
    'floor_number',
    'shop_type',
    'area_sqm',
    'amenities',
    'monthly_rent',
    'security_deposit',
    'utility_account_number',
    'status',
    'notes',
])]
class Shop extends Model
{
    /** @use HasFactory<ShopFactory> */
    use HasFactory, RentedUnderContracts, SoftDeletes;

    public const STATUSES = ['vacant', 'occupied', 'reserved', 'under_maintenance', 'inactive'];

    /**
     * Suggested shop types. The column is free text, so the database does not enforce this list.
     */
    public const TYPES = [
        'grocery',
        'restaurant',
        'cafe',
        'laundry',
        'barber',
        'pharmacy',
        'electronics',
        'telecom',
        'money_exchange',
    ];

    public const AMENITIES = [
        'air_conditioning',
        'storage_room',
        'display_window',
        'signage',
        'loading_access',
        'security_shutter',
        'cctv',
        'water_connection',
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
            'area_sqm' => 'decimal:2',
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
