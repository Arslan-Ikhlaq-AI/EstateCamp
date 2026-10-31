<?php

namespace App\Models;

use App\Models\Concerns\RentedUnderContracts;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'room_number',
    'block',
    'floor_number',
    'room_type_id',
    'gender_policy',
    'capacity',
    'is_occupied',
    'area_sqm',
    'monthly_rent',
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
     * Rooms split into occupied, available (vacant rooms that are active) and
     * out of service (vacant rooms under maintenance or inactive).
     *
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    public static function occupancyBreakdown(int $total, int $occupied, int $available): array
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
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'floor_number' => 'integer',
            'capacity' => 'integer',
            'is_occupied' => 'boolean',
            'area_sqm' => 'decimal:2',
            'monthly_rent' => 'decimal:2',
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
     * Stays in the room, past and present.
     *
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }

    /**
     * Short-term rentals that hold the room, ended ones included.
     *
     * @return BelongsToMany<RoomRental, $this>
     */
    public function roomRentals(): BelongsToMany
    {
        return $this->belongsToMany(RoomRental::class, 'room_rental_rooms');
    }

    /**
     * Set `is_occupied` from today's agreements: the room is occupied while
     * a running contract or short-term rental holds it, from the agreement's
     * first day, or while anyone is staying in it. Agreements, check-ins and
     * check-outs call this; it is not set by hand.
     */
    public function recalculateOccupancy(): void
    {
        $this->update(['is_occupied' => $this->isHeld() || $this->peopleStaying() > 0]);
    }

    /**
     * Whether a running agreement holds the room today: an active contract
     * line covering today, or a live short-term rental that has started.
     */
    public function isHeld(): bool
    {
        return $this->contractLines()
            ->where('unit_type', 'room')
            ->whereDate('start_date', '<=', today())
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->where('status', 'active'))
            ->exists()
            || $this->roomRentals()->live()->whereDate('room_rentals.start_date', '<=', today())->exists();
    }

    /**
     * People staying in the room today.
     */
    public function peopleStaying(): int
    {
        return $this->occupancies()->current()->count();
    }
}
