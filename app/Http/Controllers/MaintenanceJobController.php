<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\MaintenanceJobRequest;
use App\Http\Requests\MaintenanceStatusChangeRequest;
use App\Models\Company;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceJobUpdate;
use App\Models\MaintenanceStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Maintenance: every problem reported at the company's properties, where it
 * is, where it stands, and once fixed, what it cost with its invoice.
 */
class MaintenanceJobController extends Controller
{
    use ListsRecords;

    /**
     * List the jobs: those still open first, most urgent and most recent on top.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Maintenance/Index', ['company' => null]);
        }

        $statuses = MaintenanceStatus::query()->orderBy('sort_order')->orderBy('name')->get();
        $categories = MaintenanceCategory::query()->orderBy('sort_order')->orderBy('name')->get();
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = $this->listFilters($request, [
            'status' => $statuses->pluck('slug')->all(),
            'category' => $categories->pluck('slug')->all(),
            'priority' => MaintenanceJob::PRIORITIES,
            'properties' => $properties->pluck('code')->all(),
        ]);
        $lookups = ['status' => $statuses, 'category' => $categories];
        $openStatusIds = $statuses->whereIn('stage', ['open', 'in_progress'])->modelKeys();
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, $lookups, except: 'properties'), 'property_id');

        return Inertia::render('Maintenance/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->lookupFacet($statuses, $this->countBy($this->filteredQuery($company, $filters, $lookups, except: 'status'), 'maintenance_status_id')),
                'category' => $this->lookupFacet($categories, $this->countBy($this->filteredQuery($company, $filters, $lookups, except: 'category'), 'maintenance_category_id')),
                'priority' => $this->facetOptions(MaintenanceJob::PRIORITIES, $this->countBy($this->filteredQuery($company, $filters, $lookups, except: 'priority'), 'priority')),
                'properties' => $properties->map(fn ($property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ]),
            ],
            'summary' => $this->summary($company),
            'jobs' => $this->filteredQuery($company, $filters, $lookups)
                ->with(self::listRelations())
                ->when($openStatusIds !== [], fn (Builder $query) => $query->orderByRaw(
                    'case when maintenance_status_id in ('.implode(',', array_fill(0, count($openStatusIds), '?')).') then 0 else 1 end',
                    $openStatusIds,
                ))
                ->orderByRaw("case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end")
                ->orderByDesc('reported_on')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (MaintenanceJob $job) => self::summaryDetails($job)),
        ]);
    }

    /**
     * Show the form for reporting a problem, opened from a property or room when given.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->find($request->integer('property'));
        $room = $property?->rooms()->find($request->integer('room'));

        return Inertia::render('Maintenance/Form', [
            'job' => null,
            'defaults' => [
                'property_id' => $property?->id,
                'unit_type' => $room ? 'room' : 'property',
                'room_id' => $room?->id,
            ],
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save a newly reported problem and start its history.
     */
    public function store(MaintenanceJobRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->findOrFail($request->validated('property_id'));
        $status = MaintenanceStatus::query()->findOrFail($request->validated('maintenance_status_id'));

        $job = DB::transaction(function () use ($request, $company, $property, $status) {
            $job = new MaintenanceJob($request->details());
            $job->placeAt($property, $request->validated('unit_type'), $request->unitId());
            $job->forceFill(['job_number' => MaintenanceJob::nextNumber($company->id), 'created_by' => $request->user()->id]);
            $job->moveTo($status, $status->isCompleted() ? ($request->date('completed_on') ?? today()) : $request->date('reported_on'), by: $request->user());
            $job->recordCost($request->cost());

            return $job;
        });

        return to_route('maintenance.show', $job)->with('success', "{$job->job_number} was reported.");
    }

    /**
     * Show a job with where it is, its history and what it cost.
     */
    public function show(Request $request, MaintenanceJob $maintenanceJob): Response
    {
        $this->ensureSameCompany($request, $maintenanceJob);

        $maintenanceJob->load([
            ...self::listRelations(),
            'createdBy:id,name',
            'updates.status:id,name,slug,color,stage',
            'updates.previousStatus:id,name,slug,color,stage',
            'updates.user:id,name',
        ]);

        return Inertia::render('Maintenance/Show', [
            'currency' => $maintenanceJob->company->default_currency,
            'job' => [
                ...self::summaryDetails($maintenanceJob),
                ...$maintenanceJob->only(['description', 'reported_by', 'vendor_phone', 'payment_method', 'invoice_number', 'invoice_name', 'voucher_number', 'notes']),
                'startedOn' => $maintenanceJob->started_on?->toDateString(),
                'paidOn' => $maintenanceJob->paid_on?->toDateString(),
                'invoiceUrl' => self::invoiceUrl($maintenanceJob),
                'invoiceIsImage' => $maintenanceJob->invoice_path !== null && ! str_ends_with(strtolower($maintenanceJob->invoice_path), '.pdf'),
                'createdBy' => $maintenanceJob->createdBy?->name,
            ],
            'history' => $maintenanceJob->updates->map(fn (MaintenanceJobUpdate $update) => [
                'id' => $update->id,
                'date' => $update->changed_on->toDateString(),
                'note' => $update->note,
                'user' => $update->user?->name,
                'status' => $update->status->only(['id', 'name', 'slug', 'color', 'stage']),
                'previous' => $update->previousStatus?->only(['id', 'name', 'slug', 'color', 'stage']),
            ]),
            'statuses' => self::offered(MaintenanceStatus::class, ['stage', 'color']),
            'paymentMethods' => MaintenanceJob::PAYMENT_METHODS,
        ]);
    }

    /**
     * Show the form for correcting a job's details and cost.
     */
    public function edit(Request $request, MaintenanceJob $maintenanceJob): Response
    {
        $this->ensureSameCompany($request, $maintenanceJob);

        $maintenanceJob->load('status');

        return Inertia::render('Maintenance/Form', [
            'job' => [
                'id' => $maintenanceJob->id,
                'number' => $maintenanceJob->job_number,
                ...$maintenanceJob->only([
                    'property_id', 'unit_type', 'room_id', 'apartment_id', 'shop_id', 'location', 'maintenance_category_id',
                    'maintenance_status_id', 'title', 'description', 'priority', 'reported_by', 'vendor_name', 'vendor_phone',
                    'payment_method', 'invoice_number', 'invoice_name', 'notes',
                ]),
                'reported_on' => $maintenanceJob->reported_on->toDateString(),
                'completed_on' => $maintenanceJob->completed_on?->toDateString(),
                'paid_on' => $maintenanceJob->paid_on?->toDateString(),
                'amount' => $maintenanceJob->amount === null ? null : (float) $maintenanceJob->amount,
                'invoice_url' => self::invoiceUrl($maintenanceJob),
                'status' => $maintenanceJob->status->only(['id', 'name', 'slug', 'color', 'stage']),
            ],
            'defaults' => null,
            ...$this->formOptions($maintenanceJob->company, $maintenanceJob),
        ]);
    }

    /**
     * Save corrections to a job; its status changes through changeStatus().
     */
    public function update(MaintenanceJobRequest $request, MaintenanceJob $maintenanceJob): RedirectResponse
    {
        $property = $maintenanceJob->company->properties()->findOrFail($request->validated('property_id'));

        DB::transaction(function () use ($request, $maintenanceJob, $property) {
            $maintenanceJob->fill($request->details());
            $maintenanceJob->placeAt($property, $request->validated('unit_type'), $request->unitId());

            if ($maintenanceJob->status->isCompleted() && $request->filled('completed_on')) {
                $maintenanceJob->completed_on = $request->date('completed_on');
            }

            $maintenanceJob->save();
            $maintenanceJob->recordCost($request->cost());
        });

        return to_route('maintenance.show', $maintenanceJob)->with('success', "{$maintenanceJob->job_number} was updated.");
    }

    /**
     * Move a job to another status; finishing it records the amount and invoice.
     */
    public function changeStatus(MaintenanceStatusChangeRequest $request, MaintenanceJob $maintenanceJob): RedirectResponse
    {
        $status = $request->newStatus();

        DB::transaction(function () use ($request, $maintenanceJob, $status) {
            $maintenanceJob->moveTo($status, $request->date('changed_on'), $request->validated('note'), $request->user());

            if ($status->isCompleted()) {
                $maintenanceJob->recordCost($request->cost());
            }
        });

        return back()->with('success', "{$maintenanceJob->job_number} is now {$status->name}.");
    }

    /**
     * A job's invoice, for the company's own users only.
     */
    public function invoice(Request $request, MaintenanceJob $maintenanceJob): StreamedResponse
    {
        $this->ensureSameCompany($request, $maintenanceJob);

        $path = $maintenanceJob->invoice_path;

        abort_unless($path && Storage::disk(MaintenanceJob::INVOICE_DISK)->exists($path), 404);

        return Storage::disk(MaintenanceJob::INVOICE_DISK)->response($path, $maintenanceJob->invoice_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * The relations summaryDetails() reads, for eager loading. Units are
     * loaded even once removed, so old jobs still say where they were.
     *
     * @return array<string, mixed>
     */
    public static function listRelations(): array
    {
        return [
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'room' => fn ($query) => $query->withTrashed()->select(['id', 'room_number']),
            'apartment' => fn ($query) => $query->withTrashed()->select(['id', 'apartment_number']),
            'shop' => fn ($query) => $query->withTrashed()->select(['id', 'shop_number']),
            'category:id,name,slug',
            'status:id,name,slug,color,stage',
        ];
    }

    /**
     * One job as the list and its page show it.
     *
     * @return array<string, mixed>
     */
    public static function summaryDetails(MaintenanceJob $job): array
    {
        return [
            'id' => $job->id,
            'number' => $job->job_number,
            'title' => $job->title,
            'priority' => $job->priority,
            'reportedOn' => $job->reported_on->toDateString(),
            'completedOn' => $job->completed_on?->toDateString(),
            'category' => $job->category->only(['id', 'name', 'slug']),
            'status' => $job->status->only(['id', 'name', 'slug', 'color', 'stage']),
            'property' => $job->property?->only(['id', 'name', 'code']),
            'unit' => match ($job->unit_type) {
                'room' => ['type' => 'room', 'id' => $job->room_id, 'number' => $job->room?->room_number],
                'apartment' => ['type' => 'apartment', 'id' => $job->apartment_id, 'number' => $job->apartment?->apartment_number],
                'shop' => ['type' => 'shop', 'id' => $job->shop_id, 'number' => $job->shop?->shop_number],
                default => null,
            },
            'location' => $job->location,
            'vendor' => $job->vendor_name,
            'amount' => $job->amount === null ? null : (float) $job->amount,
            'isPaid' => $job->isPaid(),
            'hasInvoice' => $job->invoice_path !== null,
        ];
    }

    /**
     * Headline figures: what is still open, what was finished and spent
     * this month and year, and finished work not yet paid.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $jobs = fn () => $company->maintenanceJobs();
        $finished = fn () => $jobs()->inStage('completed');
        $today = today();

        return [
            'open' => $jobs()->inStage(['open', 'in_progress'])->count(),
            'inProgress' => $jobs()->inStage('in_progress')->count(),
            'urgent' => $jobs()->inStage(['open', 'in_progress'])->whereIn('priority', ['urgent', 'high'])->count(),
            'completedThisMonth' => $finished()->whereBetween('completed_on', [$today->copy()->startOfMonth(), $today])->count(),
            'spentThisMonth' => round((float) $finished()->whereBetween('completed_on', [$today->copy()->startOfMonth(), $today])->sum('amount'), 2),
            'spentThisYear' => round((float) $finished()->whereBetween('completed_on', [$today->copy()->startOfYear(), $today])->sum('amount'), 2),
            'unpaid' => [
                'count' => $finished()->whereNull('paid_on')->where('amount', '>', 0)->count(),
                'amount' => round((float) $finished()->whereNull('paid_on')->where('amount', '>', 0)->sum('amount'), 2),
            ],
        ];
    }

    /**
     * The company's jobs narrowed by the search and filters, leaving out the
     * filter named in `$except`. Status and category filters hold slugs,
     * matched to ids through `$lookups`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{status: Collection<int, MaintenanceStatus>, category: Collection<int, MaintenanceCategory>}  $lookups
     * @return HasMany<MaintenanceJob, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $lookups, ?string $except = null): HasMany
    {
        $search = $filters['search'];
        $ids = fn (string $key) => $lookups[$key]->whereIn('slug', $filters[$key])->modelKeys();

        return $company->maintenanceJobs()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('job_number', "%{$search}%")
                ->orWhereLike('title', "%{$search}%")
                ->orWhereLike('location', "%{$search}%")
                ->orWhereLike('vendor_name', "%{$search}%")
                ->orWhereLike('reported_by', "%{$search}%")
                ->orWhereLike('invoice_number', "%{$search}%")
                ->orWhereHas('room', fn (Builder $rooms) => $rooms->whereLike('room_number', $search))
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('maintenance_status_id', $ids('status')))
            ->when($except !== 'category' && $filters['category'] !== [], fn (Builder $query) => $query->whereIn('maintenance_category_id', $ids('category')))
            ->when($except !== 'priority' && $filters['priority'] !== [], fn (Builder $query) => $query->whereIn('priority', $filters['priority']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }

    /**
     * Filter options for a configuration list, by slug, with each entry's
     * name (as stored, translated in the browser when it can be) and count.
     *
     * @param  Collection<int, MaintenanceStatus|MaintenanceCategory>  $entries
     * @param  \Illuminate\Support\Collection<array-key, int>  $counts  by id
     * @return list<array<string, mixed>>
     */
    private function lookupFacet(Collection $entries, $counts): array
    {
        return $entries
            ->filter(fn ($entry) => $entry->is_active || $counts->get($entry->id, 0) > 0)
            ->map(fn ($entry) => [
                'value' => $entry->slug,
                'label' => $entry->name,
                ...($entry instanceof MaintenanceStatus ? ['color' => $entry->color, 'stage' => $entry->stage] : []),
                'count' => $counts->get($entry->id, 0),
            ])
            ->values()
            ->all();
    }

    /**
     * The properties with their rooms, apartments and shops, and the lists
     * the form offers. A switched-off category or status stays offered on
     * the job already using it.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company, ?MaintenanceJob $job = null): array
    {
        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()
                ->with([
                    'rooms' => fn (HasMany $rooms) => $rooms->orderBy('room_number')->select(['id', 'property_id', 'room_number', 'block', 'floor_number']),
                    'apartments' => fn (HasMany $apartments) => $apartments->orderBy('apartment_number')->select(['id', 'property_id', 'apartment_number']),
                    'shops' => fn (HasMany $shops) => $shops->orderBy('shop_number')->select(['id', 'property_id', 'shop_number']),
                ])
                ->orderBy('name')
                ->get(['id', 'name', 'code'])
                ->map(fn ($property) => [
                    'id' => $property->id,
                    'name' => $property->name,
                    'code' => $property->code,
                    'rooms' => $property->rooms->map(fn ($room) => ['id' => $room->id, 'number' => $room->room_number, 'block' => $room->block, 'floor' => $room->floor_number]),
                    'apartments' => $property->apartments->map(fn ($apartment) => ['id' => $apartment->id, 'number' => $apartment->apartment_number]),
                    'shops' => $property->shops->map(fn ($shop) => ['id' => $shop->id, 'number' => $shop->shop_number]),
                ]),
            'categories' => self::offered(MaintenanceCategory::class, [], $job?->maintenance_category_id),
            'statuses' => self::offered(MaintenanceStatus::class, ['stage', 'color']),
            'priorities' => MaintenanceJob::PRIORITIES,
            'unitTypes' => MaintenanceJob::UNIT_TYPES,
            'paymentMethods' => MaintenanceJob::PAYMENT_METHODS,
        ];
    }

    /**
     * The switched-on entries of a configuration list in their order, plus
     * the one in use, with `$fields` beyond their id, name, slug and description.
     *
     * @param  class-string<MaintenanceStatus|MaintenanceCategory>  $model
     * @param  list<string>  $fields
     * @return list<array<string, mixed>>
     */
    private static function offered(string $model, array $fields = [], ?int $currentId = null): array
    {
        return $model::query()
            ->where(fn (Builder $query) => $query->where('is_active', true)->when($currentId, fn (Builder $query) => $query->orWhere('id', $currentId)))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($entry) => $entry->only(['id', 'name', 'slug', 'description', ...$fields]))
            ->all();
    }

    private static function invoiceUrl(MaintenanceJob $job): ?string
    {
        return $job->invoice_path ? route('maintenance.invoice', [$job, 'v' => $job->updated_at?->timestamp]) : null;
    }
}
