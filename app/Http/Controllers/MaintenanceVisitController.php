<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\MaintenanceVisitRequest;
use App\Http\Requests\MaintenanceVisitRescheduleRequest;
use App\Http\Requests\MaintenanceVisitStatusRequest;
use App\Models\Company;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceVisit;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The maintenance contractors' visit schedules, such as the pest control
 * company's treatments: each contract's visits as the contractor gave them,
 * and every visit across the contracts on one list, those needing
 * attention first. Visits are confirmed, done (with the service report),
 * missed, cancelled or moved to another day.
 */
class MaintenanceVisitController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    /**
     * Ways the list narrows visits by when they fall: passed without being
     * done, inside their contract's alert window, or coming up.
     */
    public const DUE_FILTERS = ['overdue', 'alert', 'this_week', 'next_30_days'];

    /**
     * List every visit on the contractors' schedules: those still to happen
     * first, soonest on top, then the rest, latest first. `service` narrows
     * them to some kinds of contract, such as pest control.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Amcs/Visits', ['company' => null]);
        }

        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, [
                'status' => MaintenanceVisit::STATUSES,
                'due' => self::DUE_FILTERS,
                'service' => MaintenanceContract::SERVICES,
                'properties' => $properties->pluck('code')->all(),
            ]),
            'period' => $period['value'],
        ];
        $query = fn (?string $except = null) => $this->filteredQuery($company, $filters, $period, $except);
        $propertyCounts = $this->countByContract($query('properties'), 'property_id');
        $serviceCounts = $this->countByContract($query('service'), 'service');

        return Inertia::render('Amcs/Visits', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->facetOptions(MaintenanceVisit::STATUSES, $this->countBy($query('status'), 'status')),
                'due' => array_map(fn (string $due) => ['value' => $due, 'count' => $this->dueVisits($query('due'), $due)->count()], self::DUE_FILTERS),
                'service' => array_map(fn (string $service) => ['value' => $service, 'count' => $serviceCounts->get($service, 0)], MaintenanceContract::SERVICES),
                'properties' => $properties->map(fn (Property $property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ]),
            ],
            'summary' => $this->summary($company),
            'statuses' => MaintenanceVisit::STATUSES,
            'visits' => $query()
                ->with(self::detailRelations())
                ->orderByRaw("case when maintenance_visits.status in ('scheduled', 'confirmed') then 0 else 1 end")
                ->orderByRaw("case when maintenance_visits.status in ('scheduled', 'confirmed') then maintenance_visits.scheduled_on end asc")
                ->orderByDesc('maintenance_visits.scheduled_on')
                ->orderBy('maintenance_visits.scheduled_time')
                ->orderBy('maintenance_visits.id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (MaintenanceVisit $visit) => self::details($visit, withContract: true)),
        ]);
    }

    /**
     * Add the contractor's visits to a contract's schedule.
     */
    public function store(MaintenanceVisitRequest $request, MaintenanceContract $maintenanceContract): RedirectResponse
    {
        $visits = collect($request->validated('visits'));

        DB::transaction(function () use ($request, $maintenanceContract, $visits) {
            foreach ($visits as $row) {
                $visit = new MaintenanceVisit([
                    'scheduled_on' => $row['scheduled_on'],
                    'scheduled_time' => $row['scheduled_time'] ?? null,
                    'notes' => $request->validated('notes'),
                ]);
                $visit->forceFill([
                    'company_id' => $maintenanceContract->company_id,
                    'maintenance_contract_id' => $maintenanceContract->id,
                    'status' => 'scheduled',
                    'created_by' => $request->user()->id,
                ])->save();
            }
        });

        $count = $visits->count();

        return back()->with('success', "{$count} ".Str::plural('visit', $count)." added to the schedule of {$maintenanceContract->contract_number}.");
    }

    /**
     * Move a visit to another day.
     */
    public function reschedule(MaintenanceVisitRescheduleRequest $request, MaintenanceVisit $maintenanceVisit): RedirectResponse
    {
        DB::transaction(function () use ($request, $maintenanceVisit) {
            $maintenanceVisit->reschedule($request->date('scheduled_on'), $request->validated('scheduled_time'), $request->user());

            if ($request->has('notes')) {
                $maintenanceVisit->forceFill(['notes' => $request->validated('notes')])->save();
            }
        });

        return back()->with('success', "The visit was moved to {$maintenanceVisit->scheduled_on->format('j M Y')}.");
    }

    /**
     * Confirm a visit, mark it done (with its service report), missed or
     * cancelled, or put it back on the schedule.
     */
    public function changeStatus(MaintenanceVisitStatusRequest $request, MaintenanceVisit $maintenanceVisit): RedirectResponse
    {
        $status = $request->validated('status');

        $maintenanceVisit->moveTo($status, $request->details(), $request->file('report'), $request->user());

        $date = $maintenanceVisit->scheduled_on->format('j M Y');

        return back()->with('success', match ($status) {
            'done' => "The visit of {$date} was marked as done.",
            'confirmed' => "The visit of {$date} is confirmed.",
            'missed' => "The visit of {$date} was marked as missed. Move it to a new day when the contractor gives one.",
            'cancelled' => "The visit of {$date} was cancelled.",
            default => "The visit of {$date} is back on the schedule.",
        });
    }

    /**
     * Remove a visit added by mistake. One already done stays on record.
     */
    public function destroy(Request $request, MaintenanceVisit $maintenanceVisit): RedirectResponse
    {
        $this->ensureSameCompany($request, $maintenanceVisit);

        abort_if($maintenanceVisit->status === 'done', 422, 'A visit that was done stays on record.');

        $maintenanceVisit->discard();

        return back()->with('success', "The visit of {$maintenanceVisit->scheduled_on->format('j M Y')} was removed from the schedule.");
    }

    /**
     * A visit's service report, for the company's own users only.
     */
    public function report(Request $request, MaintenanceVisit $maintenanceVisit): StreamedResponse
    {
        $this->ensureSameCompany($request, $maintenanceVisit);

        $path = $maintenanceVisit->report_path;

        abort_unless($path && Storage::disk(MaintenanceVisit::REPORT_DISK)->exists($path), 404);

        return Storage::disk(MaintenanceVisit::REPORT_DISK)->response($path, $maintenanceVisit->report_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * Open a contract's page whatever its kind, for links that know only
     * the contract, such as a cheque in the payments ledger.
     */
    public function contract(Request $request, MaintenanceContract $maintenanceContract): RedirectResponse
    {
        $this->ensureSameCompany($request, $maintenanceContract);

        return to_route(MaintenanceContractController::routeName($maintenanceContract->service, 'show'), $maintenanceContract);
    }

    /**
     * The visits that need someone to act, most pressing first: those whose
     * day has passed without being dealt with, then those inside their
     * contract's alert window, soonest first. For the dashboard's alert and
     * the notifications.
     *
     * @return Collection<int, MaintenanceVisit>
     */
    public static function needingAttention(Company $company, int $limit = 30): Collection
    {
        return $company->maintenanceVisits()
            ->needingAttention()
            ->with(self::detailRelations())
            ->orderBy('scheduled_on')
            ->orderBy('scheduled_time')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    /**
     * The relations details() reads with its contract, for eager loading.
     *
     * @return array<string, mixed>
     */
    public static function detailRelations(): array
    {
        return [
            'contract' => fn ($query) => $query->withTrashed()->select(['id', 'company_id', 'contract_number', 'service', 'property_id', 'vendor_name', 'vendor_phone', 'visit_alert_days', 'status']),
            'contract.property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'updatedBy:id,name',
        ];
    }

    /**
     * One visit as the pages show it, with what can happen to it next;
     * `withContract` adds the contract, property and contractor, for lists
     * across contracts.
     *
     * @return array<string, mixed>
     */
    public static function details(MaintenanceVisit $visit, bool $withContract = false): array
    {
        $contract = $visit->contract;

        return [
            'id' => $visit->id,
            'scheduledOn' => $visit->scheduled_on->toDateString(),
            'scheduledTime' => $visit->scheduled_time ? substr($visit->scheduled_time, 0, 5) : null,
            'rescheduledFrom' => $visit->rescheduled_from?->toDateString(),
            'status' => $visit->status,
            'daysAway' => $visit->daysAway(),
            'alert' => $visit->alertState(),
            'completedOn' => $visit->completed_on?->toDateString(),
            'technician' => $visit->technician_name,
            'reportNumber' => $visit->report_number,
            'report' => $visit->report_path ? [
                'url' => route('amc-visits.report', [$visit, 'v' => $visit->updated_at?->timestamp]),
                'name' => $visit->report_name,
                'isImage' => ! str_ends_with(strtolower($visit->report_path), '.pdf'),
            ] : null,
            'notes' => $visit->notes,
            'updatedBy' => $visit->updatedBy?->name,
            'actions' => $visit->allowedStatuses(),
            'canReschedule' => ! in_array($visit->status, ['done', 'cancelled'], true),
            'canDelete' => $visit->status !== 'done',
            ...($withContract ? ['contract' => [
                'id' => $contract->id,
                'number' => $contract->contract_number,
                'service' => $contract->service,
                'vendor' => $contract->vendor_name,
                'vendorPhone' => $contract->vendor_phone,
                'alertDays' => $contract->visit_alert_days,
                'property' => $contract->property?->only(['id', 'name', 'code']),
                'url' => route(MaintenanceContractController::routeName($contract->service, 'show'), $contract->id),
            ]] : []),
        ];
    }

    /**
     * Headline figures across every schedule: what is overdue, what needs
     * attention now, what is coming up this week and what was done this month.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $today = today();
        $attention = fn () => $company->maintenanceVisits()->needingAttention();
        $next = $company->maintenanceVisits()->open()->whereDate('scheduled_on', '>=', $today)->with(self::detailRelations())->orderBy('scheduled_on')->orderBy('scheduled_time')->first();

        return [
            'overdue' => $attention()->whereDate('scheduled_on', '<', $today)->count(),
            'due' => $attention()->whereDate('scheduled_on', '>=', $today)->count(),
            'thisWeek' => $company->maintenanceVisits()->open()->whereBetween('scheduled_on', [$today, $today->copy()->addDays(7)])->count(),
            'doneThisMonth' => $company->maintenanceVisits()->where('status', 'done')->whereBetween('completed_on', [$today->copy()->startOfMonth(), $today])->count(),
            'next' => $next ? self::details($next, withContract: true) : null,
        ];
    }

    /**
     * The company's visits narrowed by the search and filters, leaving out
     * the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<MaintenanceVisit, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $this->wherePeriod($company->maintenanceVisits(), 'maintenance_visits.scheduled_on', $period)
            ->whereHas('contract')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('maintenance_visits.technician_name', "%{$search}%")
                ->orWhereLike('maintenance_visits.report_number', "%{$search}%")
                ->orWhereHas('contract', fn (Builder $contracts) => $contracts
                    ->whereLike('contract_number', "%{$search}%")
                    ->orWhereLike('vendor_name', "%{$search}%")
                    ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('maintenance_visits.status', $filters['status']))
            ->when($except !== 'service' && $filters['service'] !== [], fn (Builder $query) => $query
                ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('service', $filters['service'])))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('contract.property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])))
            ->when($except !== 'due' && $filters['due'] !== [], fn (Builder $query) => $query->where(function (Builder $query) use ($filters) {
                foreach ($filters['due'] as $due) {
                    $query->orWhere(fn (Builder $query) => $this->dueVisits($query, $due));
                }
            }));
    }

    /**
     * How many visits in `$query` fall under each value of a column of their contract.
     *
     * @param  HasMany<MaintenanceVisit, Company>  $query
     * @return Collection<array-key, int>
     */
    private function countByContract(HasMany $query, string $column): Collection
    {
        return $query->toBase()
            ->join('maintenance_contracts', 'maintenance_contracts.id', '=', 'maintenance_visits.maintenance_contract_id')
            ->groupBy("maintenance_contracts.{$column}")
            ->select("maintenance_contracts.{$column} as value")
            ->selectRaw('count(*) as aggregate')
            ->pluck('aggregate', 'value')
            ->map(fn (mixed $aggregate) => (int) $aggregate);
    }

    /**
     * Narrow `$query` to open visits falling in one of DUE_FILTERS.
     *
     * @template TQuery of Builder|HasMany
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    private function dueVisits(Builder|HasMany $query, string $due): Builder|HasMany
    {
        $today = today();

        return match ($due) {
            'overdue' => $query->open()->whereDate('maintenance_visits.scheduled_on', '<', $today),
            'alert' => $query->needingAttention()->whereDate('maintenance_visits.scheduled_on', '>=', $today),
            'this_week' => $query->open()->whereBetween('maintenance_visits.scheduled_on', [$today, $today->copy()->addDays(7)]),
            default => $query->open()->whereBetween('maintenance_visits.scheduled_on', [$today, $today->copy()->addDays(30)]),
        };
    }
}
