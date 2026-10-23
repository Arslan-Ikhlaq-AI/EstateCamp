<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\ContractLineFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * One thing a contract rents at its own monthly rate:
 * - bed: `quantity` beds in the property, or in one room of it;
 * - room: a whole room, charged per room;
 * - apartment or shop: that unit.
 */
#[Fillable([
    'property_id',
    'room_id',
    'apartment_id',
    'shop_id',
    'unit_type',
    'quantity',
    'monthly_rate',
    'billing_basis',
    'vat_rate',
    'start_date',
    'end_date',
    'description',
])]
class ContractLine extends Model
{
    /** @use HasFactory<ContractLineFactory> */
    use HasFactory;

    public const UNIT_TYPES = ['bed', 'room', 'apartment', 'shop'];

    /**
     * Contracted bills every bed on the line; actual bills only the beds that
     * had someone in them during the period.
     */
    public const BILLING_BASES = ['contracted', 'actual'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'monthly_rate' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    /**
     * Whether the line runs on `$day`.
     */
    public function covers(CarbonInterface $day): bool
    {
        return $day->betweenIncluded($this->start_date, $this->end_date);
    }

    /**
     * Whether people check in under this line (beds and whole rooms do).
     */
    public function housesOccupants(): bool
    {
        return in_array($this->unit_type, ['bed', 'room'], true);
    }

    /**
     * How many people the line can house at once.
     */
    public function bedCapacity(): int
    {
        return match ($this->unit_type) {
            'bed' => $this->quantity,
            'room' => (int) $this->room?->capacity,
            default => 0,
        };
    }

    /**
     * How many units to bill for a stretch of days: every contracted bed, or
     * on the actual basis only the stays that overlapped it.
     */
    public function billedQuantity(CarbonInterface $from, CarbonInterface $to): int
    {
        if ($this->billing_basis !== 'actual') {
            return $this->quantity;
        }

        return $this->occupancies()
            ->whereDate('check_in_date', '<=', $to)
            ->where(fn (Builder $query) => $query->whereNull('check_out_date')->orWhereDate('check_out_date', '>', $from))
            ->count();
    }

    /**
     * A plain description for invoices, such as "8 beds in room 101 at Al Quoz Worker Village".
     */
    public function describe(): string
    {
        $property = $this->property->name;

        return match ($this->unit_type) {
            'bed' => $this->quantity.' '.Str::plural('bed', $this->quantity)
                .($this->room ? " in room {$this->room->room_number}" : '')." at {$property}",
            'room' => "Room {$this->room->room_number} at {$property}",
            'apartment' => "Apartment {$this->apartment->apartment_number} at {$property}",
            'shop' => "Shop {$this->shop->shop_number} at {$property}",
        };
    }

    /**
     * Whether another live contract also rents this line's apartment, shop or whole room.
     */
    public function unitHeldByAnotherContract(): bool
    {
        $column = match ($this->unit_type) {
            'apartment' => 'apartment_id',
            'shop' => 'shop_id',
            'room' => 'room_id',
            default => null,
        };

        if ($column === null) {
            return false;
        }

        return self::query()
            ->where('unit_type', $this->unit_type)
            ->where($column, $this->{$column})
            ->whereNot('contract_id', $this->contract_id)
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->exists();
    }

    /**
     * Beds someone could check into under this line today: active beds in
     * active rooms of the line's property (or of its room) with nobody in them.
     * A bed line never offers a room that another contract, or an
     * individual's room rental, rents whole.
     *
     * @return Collection<int, Bed>
     */
    public function availableBeds(): Collection
    {
        $roomsRentedWhole = self::query()
            ->where('unit_type', 'room')
            ->whereKeyNot($this->id)
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->pluck('room_id')
            ->concat(RoomRental::query()->active()->where('unit_type', 'room')->pluck('room_id'));

        return Bed::query()
            ->where('is_active', true)
            ->whereHas('room', fn (Builder $rooms) => $rooms
                ->where('property_id', $this->property_id)
                ->where('status', 'active')
                ->when($this->room_id, fn (Builder $query) => $query->whereKey($this->room_id))
                ->when($this->unit_type === 'bed', fn (Builder $query) => $query->whereKeyNot($roomsRentedWhole)))
            ->whereDoesntHave('occupancies', fn (Builder $stays) => $stays->whereNull('check_out_date'))
            ->with('room:id,room_number,block,floor_number,gender_policy')
            ->get()
            ->sortBy(fn (Bed $bed) => [$bed->room->room_number, (int) $bed->label])
            ->values();
    }

    /**
     * @return BelongsTo<Contract, $this>
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * @return BelongsTo<Apartment, $this>
     */
    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class);
    }

    /**
     * @return BelongsTo<Shop, $this>
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    /**
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }
}
