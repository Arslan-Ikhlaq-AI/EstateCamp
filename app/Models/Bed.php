<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * One bed in a room. Rooms keep one active bed per unit of capacity
 * through Room::syncBeds().
 */
#[Fillable(['label', 'is_active'])]
class Bed extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }

    /**
     * The stay in progress, if anyone is in the bed.
     *
     * @return HasOne<Occupancy, $this>
     */
    public function currentOccupancy(): HasOne
    {
        return $this->hasOne(Occupancy::class)->whereNull('check_out_date');
    }
}
