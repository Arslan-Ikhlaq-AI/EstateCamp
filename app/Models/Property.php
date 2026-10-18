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
use Illuminate\Support\Collection;
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
    'total_floors',
    'total_units',
    'contact_person_name',
    'contact_person_phone',
    'ownership_type',
    'landlord_id',
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
            'total_floors' => 'integer',
            'total_units' => 'integer',
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
    public function unitCount(): int
    {
        return $this->rooms()->count() + $this->shops()->count() + $this->apartments()->count();
    }

    /**
     * Refresh the room and bed counts from the property's rooms.
     */
    public function recalculateTotals(): void
    {
        $this->update([
            'total_rooms' => $this->rooms()->count(),
            'total_capacity' => (int) $this->rooms()->sum('capacity'),
        ]);
    }

    /**
     * Numbers counting up from `$first`, keeping its prefix and zero padding:
     * "101" gives 101, 102, …; "G-01" gives G-01, G-02, ….
     *
     * @return list<string>
     */
    public static function unitNumbers(string $first, int $count): array
    {
        preg_match('/^(.*?)(\d+)$/', trim($first), $parts);
        [, $prefix, $digits] = $parts;

        return array_map(
            fn (int $offset) => $prefix.str_pad((string) ((int) $digits + $offset), strlen($digits), '0', STR_PAD_LEFT),
            range(0, $count - 1),
        );
    }

    /**
     * The number after the highest-numbered unit in `$numbers`, or
     * `$fallback` when none of them ends in a number.
     *
     * @param  Collection<int, string>  $numbers
     */
    public static function nextUnitNumber(Collection $numbers, string $fallback): string
    {
        $highest = $numbers
            ->filter(fn (string $number) => preg_match('/\d$/', $number) === 1)
            ->sortBy(fn (string $number) => (int) preg_replace('/^.*?(\d+)$/', '$1', $number))
            ->last();

        return $highest === null ? $fallback : self::unitNumbers($highest, 2)[1];
    }

    /**
     * Add rooms, shops and apartments in batches of alike units, each batch
     * numbered up from its `first_number`. New rooms get their beds and the
     * property's room and bed totals are refreshed.
     *
     * @param  array{rooms?: list<array<string, mixed>>, shops?: list<array<string, mixed>>, apartments?: list<array<string, mixed>>}  $units
     * @return array{rooms: int, shops: int, apartments: int}
     */
    public function addUnits(array $units): array
    {
        $added = ['rooms' => 0, 'shops' => 0, 'apartments' => 0];
        $owner = ['property_id' => $this->id, 'company_id' => $this->company_id];

        foreach ($units['rooms'] ?? [] as $batch) {
            foreach (self::unitNumbers($batch['first_number'], (int) $batch['count']) as $number) {
                $room = new Room([
                    'room_number' => $number,
                    'room_type_id' => $batch['room_type_id'],
                    'capacity' => $batch['capacity'],
                    'gender_policy' => $batch['gender_policy'] ?? null,
                    'floor_number' => $batch['floor_number'] ?? null,
                    'area_sqm' => $batch['area_sqm'] ?? null,
                    'rent_per_bed' => $batch['rent_per_bed'] ?? null,
                    'amenities' => [],
                    'status' => 'active',
                ]);
                $room->forceFill($owner)->save();
                $room->syncBeds();
                $added['rooms']++;
            }
        }

        foreach ($units['shops'] ?? [] as $batch) {
            foreach (self::unitNumbers($batch['first_number'], (int) $batch['count']) as $number) {
                (new Shop([
                    'shop_number' => $number,
                    'shop_type' => $batch['shop_type'] ?? null,
                    'floor_number' => $batch['floor_number'] ?? null,
                    'area_sqm' => $batch['area_sqm'] ?? null,
                    'monthly_rent' => $batch['monthly_rent'] ?? null,
                    'amenities' => [],
                    'status' => 'vacant',
                ]))->forceFill($owner)->save();
                $added['shops']++;
            }
        }

        foreach ($units['apartments'] ?? [] as $batch) {
            foreach (self::unitNumbers($batch['first_number'], (int) $batch['count']) as $number) {
                (new Apartment([
                    'apartment_number' => $number,
                    'bedrooms' => $batch['bedrooms'],
                    'bathrooms' => $batch['bathrooms'],
                    'furnishing_status' => $batch['furnishing_status'] ?? null,
                    'floor_number' => $batch['floor_number'] ?? null,
                    'area_sqm' => $batch['area_sqm'] ?? null,
                    'monthly_rent' => $batch['monthly_rent'] ?? null,
                    'amenities' => [],
                    'status' => 'vacant',
                ]))->forceFill($owner)->save();
                $added['apartments']++;
            }
        }

        if ($added['rooms'] > 0) {
            $this->recalculateTotals();
        }

        return $added;
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * The landlord a leased property is rented from.
     *
     * @return BelongsTo<Landlord, $this>
     */
    public function landlord(): BelongsTo
    {
        return $this->belongsTo(Landlord::class);
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
