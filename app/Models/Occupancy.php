<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One stay: an occupant in a bed from check-in up to, but not including,
 * the check-out date, under a contract line. An open stay has no check-out.
 */
#[Fillable(['check_in_date', 'check_out_date', 'notes'])]
class Occupancy extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'check_in_date' => 'date',
            'check_out_date' => 'date',
        ];
    }

    /**
     * Stays in progress on `$on` (today by default).
     *
     * @param  Builder<Occupancy>  $query
     */
    #[Scope]
    protected function current(Builder $query, ?CarbonInterface $on = null): void
    {
        $on ??= today();

        $query->whereDate('check_in_date', '<=', $on)
            ->where(fn (Builder $query) => $query->whereNull('check_out_date')->orWhereDate('check_out_date', '>', $on));
    }

    /**
     * End the stay. The occupant leaves on `$on`, so the bed is free that night.
     */
    public function checkOut(CarbonInterface $on): void
    {
        $this->update(['check_out_date' => $on]);
        $this->bed->room->recalculateOccupancy();
    }

    /**
     * @return BelongsTo<Occupant, $this>
     */
    public function occupant(): BelongsTo
    {
        return $this->belongsTo(Occupant::class);
    }

    /**
     * @return BelongsTo<ContractLine, $this>
     */
    public function contractLine(): BelongsTo
    {
        return $this->belongsTo(ContractLine::class);
    }

    /**
     * @return BelongsTo<Bed, $this>
     */
    public function bed(): BelongsTo
    {
        return $this->belongsTo(Bed::class);
    }
}
