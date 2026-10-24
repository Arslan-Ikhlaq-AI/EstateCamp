<?php

namespace App\Models;

use App\Models\Concerns\RentedUnderContracts;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'room_number',
    'block',
    'floor_number',
    'room_type_id',
    'gender_policy',
    'capacity',
    'occupied_count',
    'area_sqm',
    'rent_per_bed',
    'amenities',
    'status',
    'notes',
])]
class Room extends Model
{
    /** @use HasFactory<RoomFactory> */
    use HasFactory, RentedUnderContracts, SoftDeletes;

    public const STATUSES = ['active', 'inactive', 'under_maintenance'];

    public const GENDER_POLICIES = ['male', 'female', 'mixed'];

    public const AMENITIES = [
        'air_conditioning',
        'wifi',
        'attached_bathroom',
        'shared_bathroom',
        'bunk_beds',
        'lockers',
        'wardrobe',
        'kitchenette',
        'balcony',
        'tv',
    ];

    /**
     * Beds split into occupied, available (free beds in active rooms) and out
     * of service (free beds in rooms under maintenance or inactive).
     *
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    public static function bedBreakdown(int $total, int $occupied, int $available): array
    {
        $inService = $occupied + $available;

        return [
            'total' => $total,
            'occupied' => $occupied,
            'available' => $available,
            'outOfService' => $total - $inService,
            'occupancyRate' => $inService > 0 ? round($occupied / $inService * 100, 1) : null,
        ];
    }

    /**
     * Rooms split into full (every bed taken), partial (some beds taken) and
     * empty (nobody staying).
     *
     * @return array{full: int, partial: int, empty: int}
     */
    public static function roomBreakdown(int $total, int $full, int $empty): array
    {
        return [
            'full' => $full,
            'partial' => $total - $full - $empty,
            'empty' => $empty,
        ];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'floor_number' => 'integer',
            'capacity' => 'integer',
            'occupied_count' => 'integer',
            'area_sqm' => 'decimal:2',
            'rent_per_bed' => 'decimal:2',
            'amenities' => 'array',
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

    /**
     * @return BelongsTo<RoomType, $this>
     */
    public function roomType(): BelongsTo
    {
        return $this->belongsTo(RoomType::class);
    }

    /**
     * @return HasMany<RoomAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(RoomAttachment::class);
    }

    /**
     * @return HasMany<Bed, $this>
     */
    public function beds(): HasMany
    {
        return $this->hasMany(Bed::class);
    }

    /**
     * Keep one active bed per unit of capacity. Raising the capacity brings
     * back beds taken out of service before adding new ones; lowering it takes
     * the highest-numbered empty beds out of service. Beds are never deleted,
     * so their stay history survives.
     */
    public function syncBeds(): void
    {
        $beds = $this->beds()
            ->withExists(['currentOccupancy as is_occupied'])
            ->get()
            ->sortBy(fn (Bed $bed) => (int) $bed->label)
            ->values();
        $missing = $this->capacity - $beds->where('is_active', true)->count();

        if ($missing > 0) {
            foreach ($beds->where('is_active', false)->take($missing) as $bed) {
                $bed->update(['is_active' => true]);
                $missing--;
            }

            $nextLabel = (int) $beds->max(fn (Bed $bed) => (int) $bed->label) + 1;

            for (; $missing > 0; $missing--) {
                $this->beds()->create(['label' => (string) $nextLabel++]);
            }
        } elseif ($missing < 0) {
            $beds->where('is_active', true)
                ->where('is_occupied', false)
                ->sortByDesc(fn (Bed $bed) => (int) $bed->label)
                ->take(-$missing)
                ->each->update(['is_active' => false]);
        }
    }

    /**
     * Set `occupied_count` to the number of people staying in the room today.
     * Check-ins and check-outs call this; the count is not typed in by hand.
     */
    public function recalculateOccupancy(): void
    {
        $occupied = Occupancy::query()->current()->whereIn('bed_id', $this->beds()->select('id'))->count();

        $this->update(['occupied_count' => min($occupied, $this->capacity)]);
    }
}
