<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\MaintenanceContractRequest;
use App\Models\Cheque;
use App\Models\Company;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceVisit;
use App\Models\Property;
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
 * Annual maintenance contracts (AMCs), one kind of service per page under
 * Contracts in the sidebar: which properties are covered and by whom, what
 * each contract costs and the cheques that pay it, the contractor's visit
 * schedule, and which contracts and certificates are due for renewal. The
 * kind comes from the route (its `service` default), such as `fire_safety`
 * for amcs/fire-safety.
 */
class MaintenanceContractController extends Controller
{
    use ListsRecords;

    /**
     * Contract fields copied into a renewal, for the next term.
     */
    private const RENEWED_FIELDS = [
        'property_id', 'vendor_name', 'vendor_contact_person', 'vendor_phone', 'vendor_email', 'vendor_licence_number',
        'payment_terms', 'visit_frequency', 'response_time_hours', 'visit_alert_days', 'coverage',
    ];

    /**
     * List the contracts: running ones first, those ending soonest on top.
     */
    public function index(Request $request, string $service): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Amcs/Index', ['service' => $service, 'company' => null]);
        }

        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = $this->listFilters($request, ['state' => MaintenanceContract::STATES, 'properties' => $properties->pluck('code')->all()]);
        $propertyCounts = $this->countBy($this->filteredQuery($company, $service, $filters, except: 'properties'), 'property_id');

        return Inertia::render('Amcs/Index', [
            'service' => $service,
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'state' => array_map(fn (string $state) => [
                    'value' => $state,
                    'count' => $this->filteredQuery($company, $service, $filters, except: 'state')->inState($state)->count(),
                ], MaintenanceContract::STATES),
                'properties' => $properties->map(fn (Property $property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ]),
            ],
            'summary' => $this->summary($company, $service, $properties),
            'contracts' => $this->filteredQuery($company, $service, $filters)
                ->with(self::listRelations())
                ->orderByRaw("case when status = 'cancelled' then 2 when end_date < ? then 1 else 0 end", [today()->toDateString()])
                ->orderBy('end_date')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (MaintenanceContract $contract) => self::summaryDetails($contract)),
        ]);
    }

    /**
     * Show the form for adding a contract, for a property when given, with
     * the visits and payments usual for its kind. `?renew=<id>` starts a renewal of that contract: the same property,
     * contractor and service for the next term.
     */
    public function create(Request $request, string $service): Response
    {
        $company = $this->currentCompany($request);
        $renewing = $request->integer('renew') ? $company->maintenanceContracts()->where('service', $service)->find($request->integer('renew')) : null;
        $prefill = [
            ...MaintenanceContract::DEFAULTS[$service],
            'visit_alert_days' => MaintenanceContract::DEFAULT_VISIT_ALERT_DAYS,
            'property_id' => $request->integer('property') ?: null,
        ];

        if ($renewing) {
            $start = $renewing->end_date->copy()->addDay();

            $prefill = [
                ...$renewing->only(self::RENEWED_FIELDS),
                'renewed_from_id' => $renewing->id,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addMonthsNoOverflow($renewing->termMonths())->subDay()->toDateString(),
                'contract_value' => (float) $renewing->contract_value,
            ];
        }

        return Inertia::render('Amcs/Form', [
            'service' => $service,
            'contract' => null,
            'prefill' => $prefill,
            'renewing' => $renewing ? ['id' => $renewing->id, 'number' => $renewing->contract_number] : null,
            ...$this->formOptions($company, $service),
        ]);
    }

    /**
     * Save a new contract with its signed copy and the cheques its terms
     * call for.
     */
    public function store(MaintenanceContractRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $contract = DB::transaction(function () use ($request, $company) {
            $contract = new MaintenanceContract($request->details());
            $contract->forceFill([
                'company_id' => $company->id,
                'service' => $request->service(),
                'property_id' => $request->validated('property_id'),
                'renewed_from_id' => $request->validated('renewed_from_id'),
                'contract_number' => MaintenanceContract::nextNumber($company->id, $request->date('start_date')),
                'status' => 'active',
                'created_by' => $request->user()->id,
            ])->save();

            if ($request->file('document')) {
                $contract->storeDocument($request->file('document'));
            }

            $contract->syncCheques($request->chequeEntries(), $request->user());

            return $contract;
        });

        return to_route(self::routeName($contract->service, 'show'), $contract)
            ->with('success', "{$contract->contract_number} was added. Add the contractor's visit schedule below.");
    }

    /**
     * Show a contract with its contractor, service and certificate, the
     * contractor's visit schedule and the cheques paying for it.
     */
    public function show(Request $request, MaintenanceContract $maintenanceContract): Response
    {
        $this->ensureContractOnPage($request, $maintenanceContract);

        $maintenanceContract->load([
            ...self::listRelations(),
            'company:id,default_currency',
            'createdBy:id,name',
            'renewedFrom:id,contract_number',
        ]);
        $start = $maintenanceContract->start_date;
        $elapsedDays = $start->diffInDays(min(today(), $maintenanceContract->end_date->copy()->addDay()), false);
        // Visits still to happen first, soonest on top, then the rest, latest first.
        $visits = $maintenanceContract->visits()
            ->with('updatedBy:id,name')
            ->orderByRaw("case when status in ('scheduled', 'confirmed') then 0 else 1 end")
            ->orderByRaw("case when status in ('scheduled', 'confirmed') then scheduled_on end asc")
            ->orderByDesc('scheduled_on')
            ->orderBy('scheduled_time')
            ->orderBy('id')
            ->get()
            ->each(fn (MaintenanceVisit $visit) => $visit->setRelation('contract', $maintenanceContract));
        $cheques = $maintenanceContract->cheques()
            ->with(['chequeStatus:id,name,slug,color,stage', 'replacement:id,replaces_id', 'payment:id,cheque_id,payment_number', 'rentalPayment:id,cheque_id,receipt_number,status', ...ChequeController::historyRelations()])
            ->orderBy('cheque_date')
            ->orderBy('id')
            ->get()
            ->each(fn (Cheque $cheque) => $cheque->setRelation('chequeable', $maintenanceContract));
        $toPay = $cheques->whereIn('status', ['pending', 'issued']);
        $nextCheque = $toPay->sortBy('cheque_date')->first();

        return Inertia::render('Amcs/Show', [
            'service' => $maintenanceContract->service,
            'currency' => $maintenanceContract->company->default_currency,
            'contract' => [
                ...self::summaryDetails($maintenanceContract),
                ...$maintenanceContract->only(['vendor_contact_person', 'vendor_email', 'vendor_licence_number', 'response_time_hours', 'coverage', 'notes']),
                'coverageOptions' => count(MaintenanceContract::COVERAGE[$maintenanceContract->service]),
                'termMonths' => $maintenanceContract->termMonths(),
                'visitCount' => $maintenanceContract->visitCount(),
                'paymentCount' => $maintenanceContract->paymentCount(),
                'elapsedPercent' => (int) round(100 * max(0, $elapsedDays) / ($start->diffInDays($maintenanceContract->end_date) + 1)),
                'lastVisitOn' => $maintenanceContract->last_visit_on?->toDateString(),
                'document' => self::documentOnFile($maintenanceContract),
                'createdBy' => $maintenanceContract->createdBy?->name,
                'createdAt' => $maintenanceContract->created_at?->toDateString(),
                'renewedFrom' => $maintenanceContract->renewedFrom ? ['id' => $maintenanceContract->renewedFrom->id, 'number' => $maintenanceContract->renewedFrom->contract_number] : null,
                'canSchedule' => $maintenanceContract->status === 'active' && $maintenanceContract->end_date->gte(today()),
                'suggestedVisits' => $maintenanceContract->suggestedVisitDates(),
                'paysByCheque' => $maintenanceContract->payment_terms !== 'per_visit' && (float) $maintenanceContract->contract_value > 0,
            ],
            'visits' => $visits->map(fn (MaintenanceVisit $visit) => MaintenanceVisitController::details($visit)),
            'visitStats' => [
                'total' => $visits->count(),
                'done' => $visits->where('status', 'done')->count(),
                'open' => $visits->filter(fn (MaintenanceVisit $visit) => $visit->isOpen())->count(),
                'overdue' => $visits->filter(fn (MaintenanceVisit $visit) => $visit->alertState() === 'overdue')->count(),
                'due' => $visits->filter(fn (MaintenanceVisit $visit) => $visit->alertState() === 'due')->count(),
            ],
            'cheques' => $cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque)),
            'chequeStats' => [
                'paid' => round((float) $cheques->where('status', 'cleared')->sum('amount'), 2),
                'toPay' => round((float) $toPay->sum('amount'), 2),
                'toWrite' => $cheques->filter(fn (Cheque $cheque) => $cheque->isDueNow())->count(),
                'next' => $nextCheque ? ['date' => $nextCheque->cheque_date->toDateString(), 'amount' => (float) $nextCheque->amount] : null,
            ],
            'banks' => ChequeController::knownBanks($maintenanceContract->company),
            'chequeStatuses' => ChequeController::statusOptions(),
            'visitStatuses' => MaintenanceVisit::STATUSES,
        ]);
    }

    /**
     * Show the form for correcting a contract, or cancelling it.
     */
    public function edit(Request $request, MaintenanceContract $maintenanceContract): Response
    {
        $this->ensureContractOnPage($request, $maintenanceContract);

        return Inertia::render('Amcs/Form', [
            'service' => $maintenanceContract->service,
            'contract' => [
                'id' => $maintenanceContract->id,
                'number' => $maintenanceContract->contract_number,
                ...$maintenanceContract->only([
                    'property_id', 'renewed_from_id', 'vendor_name', 'vendor_contact_person', 'vendor_phone', 'vendor_email', 'vendor_licence_number',
                    'reference_number', 'payment_terms', 'status', 'visit_frequency', 'response_time_hours', 'visit_alert_days', 'coverage', 'certificate_number', 'notes',
                ]),
                'start_date' => $maintenanceContract->start_date->toDateString(),
                'end_date' => $maintenanceContract->end_date->toDateString(),
                'last_visit_on' => $maintenanceContract->last_visit_on?->toDateString(),
                'certificate_expires_on' => $maintenanceContract->certificate_expires_on?->toDateString(),
                'contract_value' => (float) $maintenanceContract->contract_value,
                'document' => self::documentOnFile($maintenanceContract),
                'hasLockedCheques' => $maintenanceContract->cheques()->whereNotIn('status', Cheque::EDITABLE_STATUSES)->exists(),
                'cheques' => $maintenanceContract->cheques()->whereNull('replaces_id')->with('chequeStatus:id,name,slug,color,stage')->get()->map(fn (Cheque $cheque) => ChequeController::formDetails($cheque)),
            ],
            'prefill' => null,
            'renewing' => null,
            ...$this->formOptions($maintenanceContract->company, $maintenanceContract->service),
        ]);
    }

    /**
     * Save changes to a contract, its signed copy and its cheques. Changed
     * terms rebuild the cheque schedule, unless a cheque has already cleared
     * or bounced.
     */
    public function update(MaintenanceContractRequest $request, MaintenanceContract $maintenanceContract): RedirectResponse
    {
        $this->ensureContractOnPage($request, $maintenanceContract);

        $rebuilt = DB::transaction(function () use ($request, $maintenanceContract) {
            $maintenanceContract->fill($request->details());
            $maintenanceContract->forceFill(['property_id' => $request->validated('property_id')])->save();

            if ($request->boolean('remove_document')) {
                $maintenanceContract->removeDocument();
            }

            if ($request->file('document')) {
                $maintenanceContract->storeDocument($request->file('document'));
            }

            return $maintenanceContract->syncCheques($request->chequeEntries(), $request->user());
        });

        return to_route(self::routeName($maintenanceContract->service, 'show'), $maintenanceContract)
            ->with('success', $rebuilt
                ? "{$maintenanceContract->contract_number} was updated."
                : "{$maintenanceContract->contract_number} was updated. Its cheques were kept because some have already cleared or bounced; adjust them below.");
    }

    /**
     * A contract's signed copy, for the company's own users only.
     */
    public function document(Request $request, MaintenanceContract $maintenanceContract): StreamedResponse
    {
        $this->ensureContractOnPage($request, $maintenanceContract);

        $path = $maintenanceContract->document_path;

        abort_unless($path && Storage::disk(MaintenanceContract::DOCUMENT_DISK)->exists($path), 404);

        return Storage::disk(MaintenanceContract::DOCUMENT_DISK)->response($path, $maintenanceContract->document_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * The route of a kind of contract's page, such as amcs.fire-safety.show
     * (or its list, amcs.fire-safety, without `$action`).
     */
    public static function routeName(string $service, ?string $action = null): string
    {
        return 'amcs.'.str_replace('_', '-', $service).($action ? ".{$action}" : '');
    }

    /**
     * The relations summaryDetails() reads, for eager loading. The property
     * is loaded even once removed, so old contracts still say what they
     * covered; the renewal says whether the next term is already in place,
     * and the visits when the contractor comes next.
     *
     * @return array<string, mixed>
     */
    public static function listRelations(): array
    {
        return [
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'renewal:id,renewed_from_id,contract_number',
            'visits:id,maintenance_contract_id,scheduled_on,status',
        ];
    }

    /**
     * One contract as the list and its page show it.
     *
     * @return array<string, mixed>
     */
    public static function summaryDetails(MaintenanceContract $contract): array
    {
        return [
            'id' => $contract->id,
            'number' => $contract->contract_number,
            'reference' => $contract->reference_number,
            'property' => $contract->property?->only(['id', 'name', 'code']),
            'vendor' => $contract->vendor_name,
            'vendorPhone' => $contract->vendor_phone,
            'startDate' => $contract->start_date->toDateString(),
            'endDate' => $contract->end_date->toDateString(),
            'daysLeft' => (int) today()->diffInDays($contract->end_date, false),
            'value' => (float) $contract->contract_value,
            'paymentTerms' => $contract->payment_terms,
            'installment' => $contract->installmentAmount(),
            'visitFrequency' => $contract->visit_frequency,
            'visitAlertDays' => $contract->visit_alert_days,
            'nextVisitOn' => $contract->nextVisitOn()?->toDateString(),
            'hasSchedule' => $contract->visits->isNotEmpty(),
            'state' => $contract->state(),
            'renewal' => $contract->renewal ? ['id' => $contract->renewal->id, 'number' => $contract->renewal->contract_number] : null,
            'canRenew' => in_array($contract->state(), ['expiring', 'expired'], true) && $contract->renewal === null,
            'certificate' => [
                'number' => $contract->certificate_number,
                'expiresOn' => $contract->certificate_expires_on?->toDateString(),
                'state' => $contract->certificateState(),
            ],
        ];
    }

    /**
     * Headline figures: what is running and what it costs, how many
     * properties it covers (and which have no cover), renewals due without
     * a next contract lined up, and the contractors' next visits.
     *
     * @param  Collection<int, Property>  $properties
     * @return array<string, mixed>
     */
    private function summary(Company $company, string $service, Collection $properties): array
    {
        $contracts = fn () => $company->maintenanceContracts()->where('service', $service);
        $running = $contracts()->inState(['active', 'expiring'])->with(['property:id,name', 'visits:id,maintenance_contract_id,scheduled_on,status'])->get();
        $linedUp = $contracts()->inState('upcoming')->pluck('property_id');
        $covered = $running->pluck('property_id')->unique();
        $renewals = $running
            ->filter(fn (MaintenanceContract $contract) => $contract->state() === 'expiring' && ! $linedUp->contains($contract->property_id))
            ->sortBy('end_date');
        $visits = $running
            ->map(fn (MaintenanceContract $contract) => ['date' => $contract->nextVisitOn(), 'property' => $contract->property->name])
            ->filter(fn (array $visit) => $visit['date'] !== null)
            ->sortBy('date');

        return [
            'running' => $running->count(),
            'value' => round((float) $running->sum('contract_value'), 2),
            'properties' => $properties->count(),
            'covered' => $covered->count(),
            'uncovered' => $properties->whereNotIn('id', $covered)->map(fn (Property $property) => $property->only(['id', 'name', 'code']))->values(),
            'renewalsDue' => $renewals->count(),
            'nextRenewal' => $renewals->isNotEmpty() ? ['date' => $renewals->first()->end_date->toDateString(), 'property' => $renewals->first()->property->name] : null,
            'visitsDue' => $visits->filter(fn (array $visit) => $visit['date']->lte(today()->addDays(14)))->count(),
            'visitsOverdue' => $visits->filter(fn (array $visit) => $visit['date']->lt(today()))->count(),
            'nextVisit' => $visits->isNotEmpty() ? ['date' => $visits->first()['date']->toDateString(), 'property' => $visits->first()['property']] : null,
        ];
    }

    /**
     * The company's contracts of one kind narrowed by the search and
     * filters, leaving out the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<MaintenanceContract, Company>
     */
    private function filteredQuery(Company $company, string $service, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->maintenanceContracts()
            ->where('service', $service)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('contract_number', "%{$search}%")
                ->orWhereLike('reference_number', "%{$search}%")
                ->orWhereLike('vendor_name', "%{$search}%")
                ->orWhereLike('certificate_number', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'state' && $filters['state'] !== [], fn (Builder $query) => $query->inState($filters['state']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }

    /**
     * The properties and the choices the form offers for this kind of contract.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company, string $service): array
    {
        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code']),
            'coverage' => MaintenanceContract::COVERAGE[$service],
            'paymentTerms' => MaintenanceContract::PAYMENT_TERMS,
            'visitFrequencies' => MaintenanceContract::VISIT_FREQUENCIES,
            'visitAlertDays' => MaintenanceContract::VISIT_ALERT_DAYS,
            'paymentMonths' => MaintenanceContract::PAYMENT_MONTHS,
            'statuses' => MaintenanceContract::STATUSES,
            'banks' => ChequeController::knownBanks($company),
        ];
    }

    /**
     * Answer 404 for another company's contract, or one opened under
     * another kind's pages.
     */
    private function ensureContractOnPage(Request $request, MaintenanceContract $contract): void
    {
        $this->ensureSameCompany($request, $contract);

        abort_unless($contract->service === $request->route('service'), 404);
    }

    /**
     * The signed copy on file, if any.
     *
     * @return array{url: string, name: ?string, isImage: bool}|null
     */
    private static function documentOnFile(MaintenanceContract $contract): ?array
    {
        if ($contract->document_path === null) {
            return null;
        }

        return [
            'url' => route(self::routeName($contract->service, 'document'), [$contract, 'v' => $contract->updated_at?->timestamp]),
            'name' => $contract->document_name,
            'isImage' => ! str_ends_with(strtolower($contract->document_path), '.pdf'),
        ];
    }
}
