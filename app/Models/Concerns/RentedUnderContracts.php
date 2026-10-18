<?php

namespace App\Models\Concerns;

use App\Models\ContractLine;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A room, shop or apartment that client contracts rent out through their
 * lines. A line is live while its contract is a draft or active and it has
 * not ended.
 */
trait RentedUnderContracts
{
    /**
     * @return HasMany<ContractLine, $this>
     */
    public function contractLines(): HasMany
    {
        return $this->hasMany(ContractLine::class);
    }

    /**
     * Units held under a live contract of one of the given clients.
     *
     * @param  Builder<static>  $query
     * @param  list<int|string>  $clientIds
     */
    public function scopeHeldByClients(Builder $query, array $clientIds): void
    {
        $query->whereHas('contractLines', fn (Builder $lines) => $lines
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts
                ->whereIn('status', ['draft', 'active'])
                ->whereIn('client_id', $clientIds)));
    }
}
