<?php

namespace App\Http\Controllers\Concerns;

use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Query\Expression;
use Illuminate\Http\Request;

/**
 * The period filter of the payment pages, read from `period` in the query
 * string: a named period (`this_month`, `last_quarter`…), one month
 * (`2026-09`), a range of days (`2026-09-01..2026-09-15`), or `all` for
 * all time. Missing or unreadable values fall back to the page's default,
 * so a stale or hand-edited link still opens.
 */
trait FiltersByPeriod
{
    /**
     * The named periods, in the order the filter offers them.
     */
    public const PERIOD_PRESETS = ['today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year'];

    /**
     * Longest range of days a custom period may cover.
     */
    private const PERIOD_MAX_YEARS = 10;

    /**
     * The chosen period: its value as the URL carries it ('' for the
     * page's default), its name (the value, or the default's), what kind
     * it is, its first and last day (null for all time), and the page's
     * default.
     *
     * @return array{value: string, name: string, kind: string, from: ?string, to: ?string, default: string}
     */
    protected function periodFilter(Request $request, string $default = 'all'): array
    {
        $value = $request->query('period');
        $value = is_string($value) ? trim($value) : '';

        $period = ($value !== '' && $value !== $default ? $this->resolvePeriod($value) : null)
            ?? [...($this->resolvePeriod($default) ?? $this->resolvePeriod('all')), 'value' => ''];

        return [...$period, 'default' => $default];
    }

    /**
     * A period from its value, or null when the value is not one.
     *
     * @return array{value: string, name: string, kind: string, from: ?string, to: ?string}|null
     */
    protected function resolvePeriod(string $value): ?array
    {
        $today = CarbonImmutable::today();

        $range = match ($value) {
            'all' => ['all', null, null],
            'today' => ['preset', $today, $today],
            'this_week' => ['preset', $today->startOfWeek(), $today->endOfWeek()],
            'this_month' => ['preset', $today->startOfMonth(), $today->endOfMonth()],
            'last_month' => ['preset', $today->subMonthNoOverflow()->startOfMonth(), $today->subMonthNoOverflow()->endOfMonth()],
            'this_quarter' => ['preset', $today->startOfQuarter(), $today->endOfQuarter()],
            'last_quarter' => ['preset', $today->startOfQuarter()->subMonthsNoOverflow(3), $today->startOfQuarter()->subDay()],
            'this_year' => ['preset', $today->startOfYear(), $today->endOfYear()],
            'last_year' => ['preset', $today->subYearNoOverflow()->startOfYear(), $today->subYearNoOverflow()->endOfYear()],
            default => $this->customRange($value),
        };

        if ($range === null) {
            return null;
        }

        [$kind, $from, $to] = $range;

        return ['value' => $value, 'name' => $value, 'kind' => $kind, 'from' => $from?->toDateString(), 'to' => $to?->startOfDay()->toDateString()];
    }

    /**
     * The same length of time just before `$period`: the previous month,
     * quarter or year for whole months, otherwise as many days before it.
     * Null for all time.
     *
     * @param  array{from: ?string, to: ?string}  $period
     * @return array{from: string, to: string}|null
     */
    protected function previousPeriod(array $period): ?array
    {
        if ($period['from'] === null || $period['to'] === null) {
            return null;
        }

        $from = CarbonImmutable::parse($period['from']);
        $to = CarbonImmutable::parse($period['to']);

        if ($from->equalTo($from->startOfMonth()) && $to->equalTo($to->endOfMonth()->startOfDay())) {
            $months = (int) round($from->floatDiffInMonths($to->addDay()));

            return ['from' => $from->subMonthsNoOverflow($months)->toDateString(), 'to' => $from->subDay()->toDateString()];
        }

        $days = (int) $from->diffInDays($to) + 1;

        return ['from' => $from->subDays($days)->toDateString(), 'to' => $from->subDay()->toDateString()];
    }

    /**
     * Keep the rows of `$query` whose `$column` (or an expression such as a
     * coalesce of dates) falls in `$period`.
     *
     * @template TQuery of Builder|Relation|QueryBuilder
     *
     * @param  TQuery  $query
     * @param  array{from: ?string, to: ?string}  $period
     * @return TQuery
     */
    protected function wherePeriod(Builder|Relation|QueryBuilder $query, string|Expression $column, array $period): Builder|Relation|QueryBuilder
    {
        return $query
            ->when($period['from'] !== null, fn ($query) => $query->whereDate($column, '>=', $period['from']))
            ->when($period['to'] !== null, fn ($query) => $query->whereDate($column, '<=', $period['to']));
    }

    /**
     * A month (`2026-09`) or a range of days (`2026-09-01..2026-09-30`).
     *
     * @return array{0: string, 1: CarbonImmutable, 2: CarbonImmutable}|null
     */
    private function customRange(string $value): ?array
    {
        if (preg_match('/^\d{4}-\d{2}$/', $value)) {
            $month = $this->periodDate("{$value}-01");

            return $month ? ['month', $month->startOfMonth(), $month->endOfMonth()] : null;
        }

        if (! preg_match('/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/', $value, $matches)) {
            return null;
        }

        $from = $this->periodDate($matches[1]);
        $to = $this->periodDate($matches[2]);

        if ($from === null || $to === null || $to->lt($from) || $from->diffInYears($to) > self::PERIOD_MAX_YEARS) {
            return null;
        }

        return ['range', $from, $to];
    }

    private function periodDate(string $value): ?CarbonImmutable
    {
        try {
            $date = CarbonImmutable::createFromFormat('!Y-m-d', $value);
        } catch (InvalidFormatException) {
            return null;
        }

        return $date?->format('Y-m-d') === $value ? $date : null;
    }
}
