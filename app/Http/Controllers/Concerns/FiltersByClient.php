<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Client;
use App\Models\Company;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The "client" filter of the room, shop and apartment lists: units held
 * under a live contract of the chosen clients.
 */
trait FiltersByClient
{
    /**
     * The clients holding any of the listed units, as filter options with how
     * many units each holds. A chosen client stays listed even at zero so its
     * filter chip keeps its name.
     *
     * @param  Closure(): Builder<covariant \Illuminate\Database\Eloquent\Model>|Closure(): HasMany<covariant \Illuminate\Database\Eloquent\Model, Company>  $units  the list narrowed by every other filter
     * @param  list<string>  $chosen
     * @return list<array{value: string, label: string, count: int}>
     */
    private function clientFacet(Company $company, Closure $units, array $chosen): array
    {
        return $company->clients()
            ->whereHas('contracts', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Client $client) => [
                'value' => (string) $client->id,
                'label' => $client->name,
                'count' => $units()->heldByClients([$client->id])->count(),
            ])
            ->filter(fn (array $option) => $option['count'] > 0 || in_array($option['value'], $chosen, true))
            ->values()
            ->all();
    }
}
