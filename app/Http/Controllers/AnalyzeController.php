<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ReadsPropertyMoney;
use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyType;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * How the portfolio earns: each property's revenue over a period, where it
 * came from, what the property spent and what was left, along a timeline
 * of days, weeks or months, against the same stretch of time before it.
 *
 * A period still running is counted up to today, and compared with as many
 * days of the period before it, so this year so far is set against the
 * same part of last year.
 */
class AnalyzeController extends Controller
{
    use FiltersByPeriod, ReadsPropertyMoney;

    /**
     * How the timeline groups days, finest first.
     */
    public const BUCKETS = ['day', 'week', 'month'];

    /**
     * The fewest and most days a timeline may cover in each grouping, so a
     * chart has neither one bar nor hundreds.
     */
    private const BUCKET_DAYS = ['day' => [1, 92], 'week' => [14, 731], 'month' => [45, PHP_INT_MAX]];

    /**
     * Show the period chosen (`?period=`, this year by default; any month or
     * range of days), grouped by `?by=` (day, week or month; chosen from the
     * period's length by default), for one kind of property (`?type=`, a
     * property type's slug) or all of them.
     */
    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Analyze/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request, 'this_year');

        if ($period['kind'] === 'all') {
            $period = [...$this->resolvePeriod('this_year'), 'value' => '', 'default' => 'this_year'];
        }

        $from = CarbonImmutable::parse($period['from']);
        $to = CarbonImmutable::parse($period['to']);
        $today = CarbonImmutable::today();
        $through = $from->lte($today) && $today->lt($to) ? $today : $to;
        $days = (int) $from->diffInDays($through) + 1;
        $previous = $this->previousPeriod($period);

        if ($previous !== null && $through->lt($to)) {
            $previous['to'] = CarbonImmutable::parse($previous['from'])->addDays($days - 1)->min(CarbonImmutable::parse($previous['to']))->toDateString();
        }

        $buckets = array_values(array_filter(self::BUCKETS, fn (string $bucket) => $days >= self::BUCKET_DAYS[$bucket][0] && $days <= self::BUCKET_DAYS[$bucket][1]));
        $by = in_array($request->query('by'), $buckets, true) ? $request->query('by') : $this->defaultBucket($days);
        $timeline = $this->timeline($from, $through, $by);

        $properties = $company->properties()->with('propertyType:id,name,slug')->orderBy('name')->get(['id', 'name', 'code', 'city', 'area', 'property_type_id']);
        $types = $properties->pluck('propertyType')->filter()->unique('id')->sortBy('name')->values();
        $type = $types->firstWhere('slug', $request->query('type'))?->slug;
        $shown = $type === null ? $properties : $properties->filter(fn (Property $property) => $property->propertyType?->slug === $type)->values();
        $shownIds = $shown->pluck('id')->flip();

        // Money of no property listed here (a client payment no contract was found for) counts in the totals unless one kind of property is shown.
        $placed = fn (Collection $money) => $money
            ->map(fn (array $row) => [...$row, 'property' => isset($shownIds[$row['property']]) ? $row['property'] : null])
            ->when($type !== null, fn (Collection $money) => $money->whereNotNull('property'))
            ->groupBy(fn (array $row) => $row['property'] ?? 'unlinked');
        $money = $placed($this->propertyMoney($company, $from->toDateString(), $through->toDateString()));
        $before = $previous === null ? collect() : $placed($this->propertyMoney($company, $previous['from'], $previous['to']));
        $index = fn (string $start) => fn (string $date) => $this->bucketIndex(CarbonImmutable::parse($start), CarbonImmutable::parse($date), $by);
        $figures = fn (Collection $money, Collection $before) => $this->figures($money, $before, $previous !== null, count($timeline), $index($from->toDateString()), $index($previous['from'] ?? $from->toDateString()));
        $figuresOf = fn (int|string $key) => $figures($money->get($key, collect()), $before->get($key, collect()));

        return Inertia::render('Analyze/Index', [
            'company' => ['currency' => $company->default_currency],
            'period' => $period,
            'through' => $through->toDateString(),
            'isToDate' => $through->lt($to),
            'previousPeriod' => $previous,
            'by' => $by,
            'buckets' => $buckets,
            'type' => $type,
            'propertyTypes' => $types->map(fn (PropertyType $propertyType) => [
                'value' => $propertyType->slug,
                'label' => $propertyType->name,
                'count' => $properties->filter(fn (Property $property) => $property->property_type_id === $propertyType->id)->count(),
            ])->all(),
            'timeline' => $this->fillTimeline($timeline, $money->flatten(1), $previous === null ? null : $before->flatten(1), $index($from->toDateString()), $index($previous['from'] ?? $from->toDateString())),
            'totals' => $figures($money->flatten(1), $before->flatten(1)),
            'properties' => $shown
                ->map(fn (Property $property) => [
                    'id' => $property->id,
                    'name' => $property->name,
                    'code' => $property->code,
                    'type' => $property->propertyType?->name,
                    'typeSlug' => $property->propertyType?->slug,
                    'place' => $property->area ?? $property->city,
                    ...$figuresOf($property->id),
                ])
                ->sortBy([['revenue', 'desc'], ['name', 'asc']])
                ->values()
                ->all(),
            'unlinked' => $type === null ? $figuresOf('unlinked') : null,
        ]);
    }

    /**
     * The grouping a period of `$days` opens in: days for a month or less,
     * weeks up to half a year, then months.
     */
    private function defaultBucket(int $days): string
    {
        return match (true) {
            $days <= 31 => 'day',
            $days <= 183 => 'week',
            default => 'month',
        };
    }

    /**
     * The days, weeks or months from `$from` to `$through`, each with its
     * first and last day within them.
     *
     * @return list<array{from: string, to: string}>
     */
    private function timeline(CarbonImmutable $from, CarbonImmutable $through, string $by): array
    {
        $buckets = [];
        $start = $from;

        while ($start->lte($through)) {
            $end = (match ($by) {
                'day' => $start,
                'week' => $start->endOfWeek()->startOfDay(),
                default => $start->endOfMonth()->startOfDay(),
            })->min($through);

            $buckets[] = ['from' => $start->toDateString(), 'to' => $end->toDateString()];
            $start = $end->addDay();
        }

        return $buckets;
    }

    /**
     * Where `$date` falls on a timeline starting on `$start`.
     */
    private function bucketIndex(CarbonImmutable $start, CarbonImmutable $date, string $by): int
    {
        return match ($by) {
            'day' => (int) $start->diffInDays($date),
            'week' => intdiv((int) $start->startOfWeek()->diffInDays($date), 7),
            default => ($date->year - $start->year) * 12 + $date->month - $start->month,
        };
    }

    /**
     * Revenue and expenses on each step of the timeline, and the revenue of
     * the same step of the period before (null without one).
     *
     * @param  list<array{from: string, to: string}>  $timeline
     * @param  Collection<int, array{side: string, date: string, amount: float}>  $money
     * @param  Collection<int, array{side: string, date: string, amount: float}>|null  $before
     * @return list<array{from: string, to: string, revenue: float, expenses: float, previous: ?float}>
     */
    private function fillTimeline(array $timeline, Collection $money, ?Collection $before, callable $index, callable $previousIndex): array
    {
        $timeline = array_map(fn (array $bucket) => [...$bucket, 'revenue' => 0.0, 'expenses' => 0.0, 'previous' => $before === null ? null : 0.0], $timeline);

        foreach ($money as $row) {
            $position = $index($row['date']);

            if (isset($timeline[$position])) {
                $timeline[$position][$row['side'] === 'revenue' ? 'revenue' : 'expenses'] += $row['amount'];
            }
        }

        foreach ($before?->where('side', 'revenue') ?? [] as $row) {
            $position = $previousIndex($row['date']);

            if (isset($timeline[$position])) {
                $timeline[$position]['previous'] += $row['amount'];
            }
        }

        return array_map(fn (array $bucket) => [
            ...$bucket,
            'revenue' => round($bucket['revenue'], 2),
            'expenses' => round($bucket['expenses'], 2),
            'previous' => $bucket['previous'] === null ? null : round($bucket['previous'], 2),
        ], $timeline);
    }

    /**
     * Revenue by where it came from, expenses by kind, what was left, the
     * same for the period before (null without one), and the revenue on
     * each of the `$steps` steps of the timeline, in all, by where it came
     * from, and in the same step of the period before (null without one).
     *
     * @param  Collection<int, array{side: string, kind: string, date: string, amount: float}>  $money
     * @param  Collection<int, array{side: string, kind: string, date: string, amount: float}>  $before
     * @return array{revenue: float, sources: array<string, float>, expenses: float, spending: array<string, float>, net: float, previous: ?array{revenue: float, expenses: float, net: float}, timeline: list<float>, sourceTimeline: list<array<string, float>>, previousTimeline: ?list<float>}
     */
    private function figures(Collection $money, Collection $before, bool $hasPrevious, int $steps, callable $index, callable $previousIndex): array
    {
        $byKind = fn (Collection $rows, string $side) => collect(self::MONEY_KINDS[$side])
            ->mapWithKeys(fn (string $kind) => [$kind => round((float) $rows->where('kind', $kind)->sum('amount'), 2)])
            ->all();
        $total = fn (Collection $rows, string $side) => round((float) $rows->where('side', $side)->sum('amount'), 2);
        $sourceTimeline = array_fill(0, $steps, array_fill_keys(self::MONEY_KINDS['revenue'], 0.0));
        $previousTimeline = array_fill(0, $steps, 0.0);

        foreach ($money->where('side', 'revenue') as $row) {
            $position = $index($row['date']);

            if (isset($sourceTimeline[$position])) {
                $sourceTimeline[$position][$row['kind']] += $row['amount'];
            }
        }

        foreach ($before->where('side', 'revenue') as $row) {
            $position = $previousIndex($row['date']);

            if (isset($previousTimeline[$position])) {
                $previousTimeline[$position] += $row['amount'];
            }
        }

        return [
            'revenue' => $total($money, 'revenue'),
            'sources' => $byKind($money, 'revenue'),
            'expenses' => $total($money, 'expense'),
            'spending' => $byKind($money, 'expense'),
            'net' => round($total($money, 'revenue') - $total($money, 'expense'), 2),
            'previous' => $hasPrevious ? [
                'revenue' => $total($before, 'revenue'),
                'expenses' => $total($before, 'expense'),
                'net' => round($total($before, 'revenue') - $total($before, 'expense'), 2),
            ] : null,
            'timeline' => array_map(fn (array $sources) => round(array_sum($sources), 2), $sourceTimeline),
            'sourceTimeline' => array_map(fn (array $sources) => array_map(fn (float $amount) => round($amount, 2), $sources), $sourceTimeline),
            'previousTimeline' => $hasPrevious ? array_map(fn (float $amount) => round($amount, 2), $previousTimeline) : null,
        ];
    }
}
