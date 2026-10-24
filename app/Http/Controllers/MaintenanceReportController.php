<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Models\Company;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use App\Models\Property;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The maintenance report: problems reported and fixed over a period against
 * the one before, how long fixing took, what the work cost and what was
 * paid, by kind of problem, property, priority and vendor, a year of it
 * month by month, and the work still open by how long it has waited.
 */
class MaintenanceReportController extends Controller
{
    use FiltersByPeriod, PreparesReports;

    /**
     * How long open work has waited since it was reported.
     */
    public const BACKLOG_AGES = ['days_0_7', 'days_8_30', 'days_31_90', 'over_90'];

    /**
     * Months in the trend, ending with the period's last month.
     */
    private const TREND_MONTHS = 12;

    /**
     * How many vendors, and how many of the longest-waiting jobs, the report names.
     */
    private const TOP_VENDORS = 8;

    private const OLDEST_OPEN = 10;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Maintenance', ['company' => null]);
        }

        $period = $this->periodFilter($request, 'this_month');
        $previous = $this->previousPeriod($period);
        $reported = fn (array $range) => $this->wherePeriod($company->maintenanceJobs(), 'reported_on', $range);
        $completed = fn (array $range) => $this->wherePeriod($company->maintenanceJobs()->inStage('completed'), 'completed_on', $range);
        $paid = fn (array $range) => $this->wherePeriod($company->maintenanceJobs()->whereNotNull('paid_on')->where('amount', '>', 0), 'paid_on', $range);

        $reportedJobs = $reported($period)->with('status:id,name,slug,stage,color')->get();
        $completedJobs = $completed($period)->get();
        $openJobs = $company->maintenanceJobs()
            ->inStage(['open', 'in_progress'])
            ->with(['property:id,name,code', 'status:id,name,slug,stage,color', 'category:id,name,slug'])
            ->orderBy('reported_on')
            ->orderBy('id')
            ->get();
        $unpaid = $company->maintenanceJobs()->inStage('completed')->whereNull('paid_on')->where('amount', '>', 0);

        return Inertia::render('Reports/Maintenance', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'period' => $period,
            'previousPeriod' => $previous,
            'summary' => [
                'reported' => $reportedJobs->count(),
                'completed' => $completedJobs->count(),
                'open' => $openJobs->count(),
                'urgent' => $openJobs->whereIn('priority', ['high', 'urgent'])->count(),
                'averageDays' => $this->averageDays($completedJobs),
                'cost' => round((float) $completedJobs->sum('amount'), 2),
                'paid' => round((float) $paid($period)->sum('amount'), 2),
                'unpaid' => ['count' => (clone $unpaid)->count(), 'amount' => round((float) (clone $unpaid)->sum('amount'), 2)],
            ],
            'previous' => $previous ? [
                'reported' => $reported($previous)->count(),
                'completed' => $completed($previous)->count(),
                'averageDays' => $this->averageDays($completed($previous)->get(['reported_on', 'completed_on'])),
                'cost' => round((float) $completed($previous)->sum('amount'), 2),
                'paid' => round((float) $paid($previous)->sum('amount'), 2),
            ] : null,
            'categories' => MaintenanceCategory::query()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->map(fn (MaintenanceCategory $category) => $this->breakdown(
                    ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug],
                    $reportedJobs->where('maintenance_category_id', $category->id),
                    $completedJobs->where('maintenance_category_id', $category->id),
                    $openJobs->where('maintenance_category_id', $category->id),
                ))
                ->filter(fn (array $row) => $row['reported'] + $row['completed'] + $row['open'] > 0)
                ->values()
                ->all(),
            'properties' => $company->properties()
                ->orderBy('name')
                ->get(['id', 'name', 'code'])
                ->map(fn (Property $property) => $this->breakdown(
                    ['id' => $property->id, 'name' => $property->name, 'code' => $property->code],
                    $reportedJobs->where('property_id', $property->id),
                    $completedJobs->where('property_id', $property->id),
                    $openJobs->where('property_id', $property->id),
                ))
                ->all(),
            'priorities' => collect(MaintenanceJob::PRIORITIES)
                ->map(fn (string $priority) => [
                    'priority' => $priority,
                    'reported' => $reportedJobs->where('priority', $priority)->count(),
                    'open' => $openJobs->where('priority', $priority)->count(),
                ])
                ->all(),
            'statuses' => $reportedJobs
                ->groupBy('maintenance_status_id')
                ->map(fn (Collection $jobs) => [...$jobs->first()->status->only(['id', 'name', 'slug', 'stage', 'color']), 'count' => $jobs->count()])
                ->sortByDesc('count')
                ->values()
                ->all(),
            'vendors' => $completedJobs
                ->filter(fn (MaintenanceJob $job) => filled($job->vendor_name) && (float) $job->amount > 0)
                ->groupBy(fn (MaintenanceJob $job) => mb_strtolower(trim($job->vendor_name)))
                ->map(fn (Collection $jobs) => [
                    'name' => trim($jobs->first()->vendor_name),
                    'jobs' => $jobs->count(),
                    'amount' => round((float) $jobs->sum('amount'), 2),
                    'unpaid' => round((float) $jobs->whereNull('paid_on')->sum('amount'), 2),
                ])
                ->sortBy([['amount', 'desc'], ['name', 'asc']])
                ->take(self::TOP_VENDORS)
                ->values()
                ->all(),
            'backlog' => collect(self::BACKLOG_AGES)
                ->mapWithKeys(fn (string $age) => [$age => $openJobs->filter(fn (MaintenanceJob $job) => $this->backlogAge($job) === $age)->count()])
                ->all(),
            'oldestOpen' => $openJobs
                ->take(self::OLDEST_OPEN)
                ->map(fn (MaintenanceJob $job) => [
                    'id' => $job->id,
                    'number' => $job->job_number,
                    'title' => $job->title,
                    'property' => $job->property->name,
                    'category' => $job->category->only(['name', 'slug']),
                    'priority' => $job->priority,
                    'status' => $job->status->only(['name', 'slug', 'stage', 'color']),
                    'reportedOn' => $job->reported_on->toDateString(),
                    'days' => (int) $job->reported_on->diffInDays(today()),
                ])
                ->values()
                ->all(),
            'trend' => $this->trend($company, $period),
        ]);
    }

    /**
     * Jobs reported and finished in a period, what the finished work cost,
     * and the jobs open today, for one kind of problem or property.
     *
     * @param  array<string, mixed>  $details
     * @param  Collection<int, MaintenanceJob>  $reported
     * @param  Collection<int, MaintenanceJob>  $completed
     * @param  Collection<int, MaintenanceJob>  $open
     * @return array<string, mixed>
     */
    private function breakdown(array $details, Collection $reported, Collection $completed, Collection $open): array
    {
        return [
            ...$details,
            'reported' => $reported->count(),
            'completed' => $completed->count(),
            'open' => $open->count(),
            'cost' => round((float) $completed->sum('amount'), 2),
            'averageDays' => $this->averageDays($completed),
        ];
    }

    /**
     * The average number of days from reported to finished, or null when
     * nothing was finished.
     *
     * @param  Collection<int, MaintenanceJob>  $jobs
     */
    private function averageDays(Collection $jobs): ?float
    {
        $days = $jobs
            ->filter(fn (MaintenanceJob $job) => $job->completed_on !== null)
            ->map(fn (MaintenanceJob $job) => (int) $job->reported_on->diffInDays($job->completed_on));

        return $days->isEmpty() ? null : round($days->avg(), 1);
    }

    private function backlogAge(MaintenanceJob $job): string
    {
        $days = (int) $job->reported_on->diffInDays(today());

        return match (true) {
            $days <= 7 => 'days_0_7',
            $days <= 30 => 'days_8_30',
            $days <= 90 => 'days_31_90',
            default => 'over_90',
        };
    }

    /**
     * Jobs reported and finished, and what the finished work cost, in each
     * of the twelve months up to the period's last month.
     *
     * @param  array{to: ?string}  $period
     * @return list<array{month: string, reported: int, completed: int, cost: float}>
     */
    private function trend(Company $company, array $period): array
    {
        $months = $this->monthsEndingWith($period['to'], self::TREND_MONTHS);
        $range = ['from' => "{$months[0]}-01", 'to' => CarbonImmutable::parse(end($months).'-01')->endOfMonth()->toDateString()];
        $reported = $this->wherePeriod($company->maintenanceJobs(), 'reported_on', $range)->get(['reported_on'])
            ->countBy(fn (MaintenanceJob $job) => $job->reported_on->format('Y-m'));
        $completed = $this->wherePeriod($company->maintenanceJobs()->inStage('completed'), 'completed_on', $range)->get(['completed_on', 'amount'])
            ->groupBy(fn (MaintenanceJob $job) => $job->completed_on->format('Y-m'));

        return array_map(fn (string $month) => [
            'month' => $month,
            'reported' => $reported->get($month, 0),
            'completed' => $completed->get($month, collect())->count(),
            'cost' => round((float) $completed->get($month, collect())->sum('amount'), 2),
        ], $months);
    }
}
