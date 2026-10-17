<?php

namespace App\Models;

use Database\Factories\PropertyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

#[Fillable([
    'name',
    'code',
    'property_type_id',
    'cover_image_url',
    'country_code',
    'city',
    'area',
    'street',
    'building_name',
    'plot_number',
    'makani_number',
    'po_box',
    'address',
    'latitude',
    'longitude',
    'map_url',
    'total_capacity',
    'total_rooms',
    'contact_person_name',
    'contact_person_phone',
    'ownership_type',
    'landlord_name',
    'landlord_phone',
    'lease_start_date',
    'lease_end_date',
    'status',
    'notes',
])]
class Property extends Model
{
    /** @use HasFactory<PropertyFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'total_capacity' => 'integer',
            'total_rooms' => 'integer',
            'lease_start_date' => 'date',
            'lease_end_date' => 'date',
        ];
    }

    /**
     * Add room and bed totals from the property's rooms: `rooms_count`,
     * `beds_total`, `beds_occupied`, `beds_available` (free beds in active
     * rooms) and `rent_roll` (occupied beds at their room's bed rate). The sums
     * are null for a property without rooms.
     *
     * @param  Builder<Property>  $query
     */
    #[Scope]
    protected function withOccupancy(Builder $query): void
    {
        $query
            ->withCount('rooms')
            ->withSum('rooms as beds_total', 'capacity')
            ->withSum('rooms as beds_occupied', 'occupied_count')
            ->withSum(
                ['rooms as beds_available' => fn (Builder $rooms) => $rooms->where('status', 'active')],
                DB::raw('capacity - occupied_count'),
            )
            ->withSum('rooms as rent_roll', DB::raw('occupied_count * rent_per_bed'));
    }

    /**
     * Refresh the stored room and bed totals from the property's rooms.
     */
    public function recalculateTotals(): void
    {
        $this->update([
            'total_rooms' => $this->rooms()->count(),
            'total_capacity' => (int) $this->rooms()->sum('capacity'),
        ]);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<PropertyType, $this>
     */
    public function propertyType(): BelongsTo
    {
        return $this->belongsTo(PropertyType::class);
    }

    /**
     * @return HasMany<Room, $this>
     */
    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    /**
     * @return HasMany<Apartment, $this>
     */
    public function apartments(): HasMany
    {
        return $this->hasMany(Apartment::class);
    }

    /**
     * @return HasMany<Shop, $this>
     */
    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class);
    }

    /**
     * @return HasMany<HeadLease, $this>
     */
    public function headLeases(): HasMany
    {
        return $this->hasMany(HeadLease::class);
    }

    /**
     * @return HasMany<ContractLine, $this>
     */
    public function contractLines(): HasMany
    {
        return $this->hasMany(ContractLine::class);
    }

    /**
     * @return HasMany<PropertyDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(PropertyDocument::class);
    }
}
