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
    'medical_rooms',
    'kitchens',
    'washrooms',
    'supervisor_rooms',
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
            'medical_rooms' => 'integer',
            'kitchens' => 'integer',
            'washrooms' => 'integer',
            'supervisor_rooms' => 'integer',
            'lease_start_date' => 'date',
            'lease_end_date' => 'date',
        ];
    }

    /**
     * Add room totals from the property's rooms: `rooms_count`,
     * `occupied_rooms_count`, `available_rooms_count` (vacant rooms that are
     * active) and `rent_roll` (the monthly rent of the occupied rooms, null
     * when none is occupied).
     *
     * @param  Builder<Property>  $query
     */
    #[Scope]
    protected function withOccupancy(Builder $query): void
    {
        $query
            ->withCount([
                'rooms',
                'rooms as occupied_rooms_count' => fn (Builder $rooms) => $rooms->where('is_occupied', true),
                'rooms as available_rooms_count' => fn (Builder $rooms) => $rooms->where('status', 'active')->where('is_occupied', false),
            ])
            ->withSum(['rooms as rent_roll' => fn (Builder $rooms) => $rooms->where('is_occupied', true)], 'monthly_rent');
    }

    /**
     * Add how many shops and apartments the property has and how many of
     * each are occupied: `shops_count`, `occupied_shops_count`,
     * `apartments_count` and `occupied_apartments_count`.
     *
     * @param  Builder<Property>  $query
     */
    #[Scope]
    protected function withUnitOccupancy(Builder $query): void
    {
        $query->withCount([
            'shops',
            'shops as occupied_shops_count' => fn (Builder $shops) => $shops->where('status', 'occupied'),
            'apartments',
            'apartments as occupied_apartments_count' => fn (Builder $apartments) => $apartments->where('status', 'occupied'),
        ]);
    }

    /**
     * How many rooms, shops and apartments the property has.
     */
    public function unitCount(): int
    {
        return $this->rooms()->count() + $this->shops()->count() + $this->apartments()->count();
    }

    /**
     * Refresh the room count and capacity from the property's rooms.
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
     * numbered up from its `first_number`. The property's room totals are
     * refreshed.
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
                    'monthly_rent' => $batch['monthly_rent'] ?? null,
                    'amenities' => [],
                    'status' => 'active',
                ]);
                $room->forceFill($owner)->save();
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
     * The lease the property form edits: the active one, or else the latest
     * that has not been terminated.
     */
    public function currentLease(): ?HeadLease
    {
        return $this->headLeases()
            ->whereNot('status', 'terminated')
            ->orderByRaw("case when status = 'active' then 0 else 1 end")
            ->latest('start_date')
            ->first();
    }

    /**
     * Create or update the head lease behind a leased property from its
     * landlord, lease dates and the lease terms entered with it. A new lease
     * is active unless it has already ended; its cheque schedule is built,
     * and rebuilt when the dates or rent change (unless a cheque has reached
     * the bank). Cheque details and photos entered with the property, keyed
     * by place in the schedule ("rent:3"), are recorded on its cheques.
     *
     * @param  array{ejari_number?: ?string, annual_rent: numeric, payments_per_year: int, security_deposit?: ?numeric, notice_period_days?: ?int}  $terms
     * @param  array<string, array<string, mixed>>  $chequeEntries
     */
    public function syncHeadLease(array $terms, array $chequeEntries = [], ?User $by = null): HeadLease
    {
        $lease = $this->currentLease() ?? new HeadLease;

        $lease->fill([
            ...$terms,
            'start_date' => $this->lease_start_date,
            'end_date' => $this->lease_end_date,
        ]);
        $lease->forceFill(['property_id' => $this->id, 'landlord_id' => $this->landlord_id]);

        if (! $lease->exists) {
            $lease->forceFill([
                'company_id' => $this->company_id,
                'lease_number' => HeadLease::nextNumber($this->company_id, $this->lease_start_date),
                'status' => $this->lease_end_date->lt(today()) ? 'expired' : 'active',
            ]);
        }

        $lease->save();

        if ($chequeEntries !== [] || $lease->wasRecentlyCreated || $lease->wasChanged(['start_date', 'end_date', 'annual_rent', 'payments_per_year', 'security_deposit'])) {
            $lease->syncCheques($chequeEntries, $by);
        }

        return $lease;
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
