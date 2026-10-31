<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\ContractLineFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One unit a contract rents whole, at its share of the contract's monthly
 * rent: a room, an apartment or a shop.
 */
#[Fillable([
    'property_id',
    'room_id',
    'apartment_id',
    'shop_id',
    'unit_type',
    'monthly_rate',
    'vat_rate',
    'start_date',
    'end_date',
    'description',
])]
class ContractLine extends Model
{
    /** @use HasFactory<ContractLineFactory> */
    use HasFactory;

    public const UNIT_TYPES = ['room', 'apartment', 'shop'];

    /**
     * VAT on a shop's rent: shops are let commercially, homes are exempt.
     */
    public const SHOP_VAT_RATE = 5;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
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
     * The unit's list price for a month: the room's, apartment's or shop's
     * monthly rent. Null when the unit has none.
     */
    public function standardRent(): ?float
    {
        $rent = match ($this->unit_type) {
            'room' => $this->room?->monthly_rent,
            'apartment' => $this->apartment?->monthly_rent,
            'shop' => $this->shop?->monthly_rent,
            default => null,
        };

        return $rent === null ? null : (float) $rent;
    }

    /**
     * Share a contract's monthly rent between its lines: in proportion to
     * their units' list prices when every unit has one, otherwise equally.
     * Shares are rounded to the fils and the last line takes what rounding
     * leaves, so they add up to the rent.
     *
     * @param  list<ContractLine>  $lines
     */
    public static function shareRent(array $lines, float $monthlyRent): void
    {
        $weights = array_map(fn (ContractLine $line) => $line->standardRent(), $lines);

        if (in_array(null, $weights, true) || min($weights ?: [0]) <= 0) {
            $weights = array_fill(0, count($lines), 1.0);
        }

        $total = array_sum($weights);
        $left = $monthlyRent;

        foreach ($lines as $index => $line) {
            $share = $index === count($lines) - 1 ? round($left, 2) : round($monthlyRent * $weights[$index] / $total, 2);
            $left -= $share;
            $line->monthly_rate = $share;
        }
    }

    /**
     * Whether people check in under this line (rooms house them).
     */
    public function housesOccupants(): bool
    {
        return $this->unit_type === 'room';
    }

    /**
     * How many people the line can house at once: as many as its room sleeps.
     */
    public function capacity(): int
    {
        return $this->unit_type === 'room' ? (int) $this->room?->capacity : 0;
    }

    /**
     * A plain description for invoices, such as "Room 101 at Al Quoz Worker Village".
     */
    public function describe(): string
    {
        $property = $this->property->name;

        return match ($this->unit_type) {
            'room' => "Room {$this->room->room_number} at {$property}",
            'apartment' => "Apartment {$this->apartment->apartment_number} at {$property}",
            'shop' => "Shop {$this->shop->shop_number} at {$property}",
        };
    }

    /**
     * Whether another live contract also rents this line's room, apartment or shop.
     */
    public function unitHeldByAnotherContract(): bool
    {
        $column = match ($this->unit_type) {
            'apartment' => 'apartment_id',
            'shop' => 'shop_id',
            'room' => 'room_id',
        };

        return self::query()
            ->where('unit_type', $this->unit_type)
            ->where($column, $this->{$column})
            ->whereNot('contract_id', $this->contract_id)
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->exists();
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
