<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * Search, filters and paging for the list pages, read from the query string
 * the same way the Rooms list does.
 */
trait ListsRecords
{
    /**
     * Page sizes the lists offer; the first is the default.
     */
    private const PER_PAGE_OPTIONS = [10, 25, 50];

    /**
     * The search term, each filter's chosen values and the page size. A filter
     * keeps only the values listed for it in `$filters` (null keeps any value,
     * for filters whose options come from the data, such as properties).
     * Unknown values are dropped rather than failing, so a stale or
     * hand-edited link still opens.
     *
     * @param  array<string, list<string>|null>  $filters
     * @return array<string, mixed>
     */
    protected function listFilters(Request $request, array $filters): array
    {
        $chosen = ['search' => $request->string('search')->trim()->limit(100, '')->toString()];

        foreach ($filters as $key => $allowed) {
            $values = collect(Arr::wrap($request->input($key)))
                ->filter(fn (mixed $value) => is_string($value) && $value !== '')
                ->unique()
                ->values()
                ->all();

            $chosen[$key] = $allowed === null ? $values : array_values(array_intersect($values, $allowed));
        }

        $perPage = $request->integer('perPage');
        $chosen['perPage'] = in_array($perPage, self::PER_PAGE_OPTIONS, true) ? $perPage : self::PER_PAGE_OPTIONS[0];

        return $chosen;
    }

    /**
     * How many records in `$query` have each value of `$column`.
     *
     * @param  Builder<*>|Relation<*, *, *>|QueryBuilder  $query
     * @return Collection<array-key, int>
     */
    protected function countBy(Builder|Relation|QueryBuilder $query, string $column): Collection
    {
        return ($query instanceof QueryBuilder ? $query : $query->toBase())
            ->whereNotNull($column)
            ->groupBy($column)
            ->selectRaw("{$column} as value, count(*) as aggregate")
            ->pluck('aggregate', 'value')
            ->map(fn (mixed $aggregate) => (int) $aggregate);
    }

    /**
     * Filter options for a fixed list of values, each with its count.
     *
     * @param  list<string>  $values
     * @param  Collection<array-key, int>  $counts
     * @return list<array{value: string, count: int}>
     */
    protected function facetOptions(array $values, Collection $counts): array
    {
        return array_map(fn (string $value) => ['value' => $value, 'count' => $counts->get($value, 0)], $values);
    }
}
