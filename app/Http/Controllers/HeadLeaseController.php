<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\HeadLeaseRequest;
use App\Models\Cheque;
use App\Models\Company;
use App\Models\HeadLease;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class HeadLeaseController extends Controller
{
    use ListsRecords;

    /**
     * Lease fields set by hand rather than mass assigned.
     */
    private const RELATION_FIELDS = ['property_id', 'landlord_id', 'renewed_from_id', 'landlord_mode', 'new_landlord', 'documents'];

    /**
     * List the company's head leases with what has been paid and when the next cheque is due.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('HeadLeases/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['status' => HeadLease::STATUSES, 'properties' => null]);
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, except: 'properties'), 'property_id');

        return Inertia::render('HeadLeases/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(HeadLease::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
                'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                    ->map(fn (Property $property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])
                    ->all(),
            ],
            'summary' => $this->summary($company),
            'leases' => $this->filteredQuery($company, $filters)
                ->with(['property:id,name,code', 'landlord:id,name'])
                ->withSum(['cheques as paid_amount' => fn (Builder $cheques) => $cheques->where('status', 'cleared')], 'amount')
                ->withMin(['cheques as next_due_date' => fn (Builder $cheques) => $cheques->whereIn('status', ['pending', 'issued'])], 'cheque_date')
                ->orderByDesc('start_date')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (HeadLease $lease) => [
                    ...$this->leaseDetails($lease),
                    'paidAmount' => (float) $lease->paid_amount,
                    'nextDueDate' => $lease->next_due_date ? substr($lease->next_due_date, 0, 10) : null,
                ]),
        ]);
    }

    /**
     * Show the form for adding a head lease. `?renew=<id>` starts a renewal
     * of that lease: the same property, landlord and terms for the next term.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $lease = null;
        $renewing = $request->integer('renew') ? $company->headLeases()->find($request->integer('renew')) : null;

        if ($renewing) {
            $termMonths = max(1, (int) round($renewing->start_date->floatDiffInMonths($renewing->end_date->copy()->addDay())));
            $start = $renewing->end_date->copy()->addDay();

            $lease = [
                ...$renewing->only(['property_id', 'landlord_id', 'annual_rent', 'payments_per_year', 'security_deposit', 'notice_period_days']),
                'renewed_from_id' => $renewing->id,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addMonthsNoOverflow($termMonths)->subDay()->toDateString(),
                'status' => 'draft',
            ];
        }

        return Inertia::render('HeadLeases/Form', [
            'lease' => null,
            'prefill' => $lease ?? [
                'property_id' => $request->integer('property') ?: null,
                'landlord_id' => $request->integer('landlord') ?: null,
            ],
            'renewing' => $renewing ? ['id' => $renewing->id, 'number' => $renewing->lease_number] : null,
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save a new head lease with its cheque schedule.
     */
    public function store(HeadLeaseRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $lease = DB::transaction(function () use ($request, $company) {
            $lease = new HeadLease($request->safe()->except(self::RELATION_FIELDS));
            $lease->forceFill([
                ...$request->safe()->only(['property_id', 'renewed_from_id']),
                'landlord_id' => $this->landlordId($request, $company),
                'company_id' => $company->id,
                'lease_number' => HeadLease::nextNumber($company->id, $request->date('start_date')),
            ])->save();

            $lease->syncCheques($request->chequeEntries(), $request->user());
            $lease->syncPropertyLease();
            $this->addDocuments($lease, $request);

            return $lease;
        });

        return to_route('head-leases.show', $lease)
            ->with('success', "Lease {$lease->lease_number} was added with {$lease->cheques()->count()} cheques to the landlord.");
    }

    /**
     * Show a head lease with its cheque schedule.
     */
    public function show(Request $request, HeadLease $headLease): Response
    {
        $this->ensureSameCompany($request, $headLease);

        $headLease->load([
            'property:id,name,code',
            'landlord',
            'renewedFrom:id,lease_number',
            'renewal:id,renewed_from_id,lease_number',
        ]);
        $cheques = $headLease->cheques()
            ->with(['chequeStatus:id,name,slug,color,stage', 'replacement:id,replaces_id', 'payment:id,cheque_id,payment_number', ...ChequeController::historyRelations()])
            ->orderByRaw("case when purpose = 'security_deposit' then 0 else 1 end")
            ->orderBy('sequence')
            ->orderBy('id')
            ->get()
            ->each(fn (Cheque $cheque) => $cheque->setRelation('chequeable', $headLease));
        $property = Property::query()
            ->whereKey($headLease->property_id)
            ->with(['propertyType:id,name,slug', 'documents' => fn (HasMany $documents) => $documents->with('headLease:id,lease_number')->orderBy('id')])
            ->withOccupancy()
            ->withCount(['shops', 'apartments'])
            ->firstOrFail();
        $toPay = $cheques->whereIn('status', ['pending', 'issued']);
        $next = $toPay->sortBy('cheque_date')->first();

        return Inertia::render('HeadLeases/Show', [
            'currency' => $headLease->company->default_currency,
            'lease' => [
                ...$this->leaseDetails($headLease),
                'securityDeposit' => $headLease->security_deposit === null ? null : (float) $headLease->security_deposit,
                'noticePeriodDays' => $headLease->notice_period_days,
                'notes' => $headLease->notes,
                'landlord' => [
                    ...$headLease->landlord->only(['id', 'name', 'landlord_type', 'contact_person_name', 'phone', 'email', 'bank_name', 'iban']),
                ],
                'createdAt' => $headLease->created_at?->toDateString(),
                'renewedFrom' => $headLease->renewedFrom ? ['id' => $headLease->renewedFrom->id, 'number' => $headLease->renewedFrom->lease_number] : null,
                'renewal' => $headLease->renewal ? ['id' => $headLease->renewal->id, 'number' => $headLease->renewal->lease_number] : null,
            ],
            'stats' => [
                'paid' => (float) $cheques->where('status', 'cleared')->sum('amount'),
                'outstanding' => (float) $toPay->sum('amount'),
                'overdue' => $toPay->filter(fn (Cheque $cheque) => $cheque->isOverdue())->count(),
                'toWrite' => $cheques->filter(fn (Cheque $cheque) => $cheque->isDueNow())->count(),
                'nextPayment' => $next ? ['dueDate' => $next->cheque_date->toDateString(), 'amount' => (float) $next->amount] : null,
            ],
            'property' => [
                ...$property->only(['id', 'name', 'code', 'cover_image_url', 'status', 'area', 'city', 'address', 'total_floors', 'total_units']),
                'type' => $property->propertyType?->only(['name', 'slug']),
                'rooms' => $property->rooms_count,
                'shops' => $property->shops_count,
                'apartments' => $property->apartments_count,
                'beds' => Room::bedBreakdown((int) $property->beds_total, (int) $property->beds_occupied, (int) $property->beds_available),
            ],
            'documents' => $property->documents->map(fn (PropertyDocument $document) => [
                'id' => $document->id,
                ...$document->only(['document_type', 'title', 'document_number', 'file_url', 'head_lease_id']),
                'expires_on' => $document->expires_on?->toDateString(),
                'lease_number' => $document->headLease?->lease_number,
            ]),
            'cheques' => $cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque)),
            'banks' => ChequeController::knownBanks($headLease->company),
            'chequeStatuses' => ChequeController::statusOptions(),
        ]);
    }

    /**
     * Show the form for editing a head lease.
     */
    public function edit(Request $request, HeadLease $headLease): Response
    {
        $this->ensureSameCompany($request, $headLease);

        return Inertia::render('HeadLeases/Form', [
            'lease' => [
                'id' => $headLease->id,
                'lease_number' => $headLease->lease_number,
                ...$headLease->only([
                    'property_id', 'landlord_id', 'renewed_from_id', 'ejari_number', 'annual_rent', 'payments_per_year',
                    'security_deposit', 'notice_period_days', 'status', 'notes',
                ]),
                'start_date' => $headLease->start_date->toDateString(),
                'end_date' => $headLease->end_date->toDateString(),
                'hasLockedCheques' => $headLease->cheques()->whereNotIn('status', Cheque::EDITABLE_STATUSES)->exists(),
                'cheques' => $headLease->cheques()->whereNull('replaces_id')->with('chequeStatus:id,name,slug,color,stage')->get()->map(fn (Cheque $cheque) => ChequeController::formDetails($cheque)),
            ],
            'prefill' => null,
            'renewing' => null,
            ...$this->formOptions($headLease->company),
        ]);
    }

    /**
     * Save changes to a head lease and its cheques. Changed terms rebuild the
     * cheque schedule, unless a cheque has already reached the bank.
     */
    public function update(HeadLeaseRequest $request, HeadLease $headLease): RedirectResponse
    {
        $rebuilt = DB::transaction(function () use ($request, $headLease) {
            $headLease->fill($request->safe()->except(self::RELATION_FIELDS));
            $headLease->forceFill([
                ...$request->safe()->only(['property_id', 'renewed_from_id']),
                'landlord_id' => $this->landlordId($request, $headLease->company),
            ])->save();

            $termsChanged = $headLease->wasChanged(['start_date', 'end_date', 'annual_rent', 'payments_per_year', 'security_deposit']);
            $rebuilt = $headLease->syncCheques($request->chequeEntries(), $request->user());

            $headLease->syncPropertyLease();
            $this->addDocuments($headLease, $request);

            return $termsChanged ? $rebuilt : null;
        });

        $message = match ($rebuilt) {
            true => "Lease {$headLease->lease_number} was updated and its cheque schedule rebuilt.",
            false => "Lease {$headLease->lease_number} was updated. Its cheque schedule was kept because cheques have already cleared or bounced; adjust them on the lease page.",
            null => "Lease {$headLease->lease_number} was updated.",
        };

        return to_route('head-leases.show', $headLease)->with('success', $message);
    }

    /**
     * The chosen landlord, or a new one created from the details entered.
     */
    private function landlordId(HeadLeaseRequest $request, Company $company): int
    {
        return $request->validated('landlord_mode') === 'new'
            ? $company->landlords()->create($request->validated('new_landlord'))->id
            : $request->integer('landlord_id');
    }

    /**
     * File the uploaded documents under the lease and its property. Places
     * left without a file (optional on the lease form) are skipped.
     */
    private function addDocuments(HeadLease $lease, HeadLeaseRequest $request): void
    {
        foreach ($request->validated('documents', []) as $index => $input) {
            $file = $request->file("documents.{$index}.file");

            if (! $file) {
                continue;
            }

            $path = $file->store("properties/{$lease->property_id}/documents", 'public');

            $lease->property->documents()->create([
                ...Arr::only($input, ['document_type', 'title', 'document_number', 'issued_on', 'expires_on', 'notes']),
                'head_lease_id' => $lease->id,
                'file_url' => '/storage/'.$path,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code', 'ownership_type']);

        return [
            'documentTypes' => PropertyDocument::TYPES,
            'requiredDocumentTypes' => PropertyDocument::REQUIRED_TYPES,
            'propertyDocuments' => PropertyDocument::query()
                ->whereIn('property_id', $properties->modelKeys())
                ->with('headLease:id,lease_number')
                ->orderBy('id')
                ->get()
                ->groupBy('property_id')
                ->map(fn ($documents) => $documents->map(fn (PropertyDocument $document) => [
                    'id' => $document->id,
                    'document_type' => $document->document_type,
                    'title' => $document->title,
                    'document_number' => $document->document_number,
                    'expires_on' => $document->expires_on?->toDateString(),
                    'file_url' => $document->file_url,
                    'head_lease_id' => $document->head_lease_id,
                    'lease_number' => $document->headLease?->lease_number,
                ])->values()),
            'currency' => $company->default_currency,
            'properties' => $properties,
            'landlords' => $company->landlords()->orderBy('name')->get(['id', 'name']),
            'statuses' => HeadLease::STATUSES,
            'paymentsPerYear' => HeadLease::PAYMENTS_PER_YEAR,
            'banks' => ChequeController::knownBanks($company),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<HeadLease, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->headLeases()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('lease_number', "%{$search}%")
                ->orWhereLike('ejari_number', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))
                ->orWhereHas('landlord', fn (Builder $landlords) => $landlords->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $active = fn () => $company->headLeases()->where('status', 'active');
        $toPay = fn () => $company->cheques()
            ->where('direction', 'issued')
            ->whereIn('status', ['pending', 'issued'])
            ->whereHasMorph('chequeable', [HeadLease::class], fn (Builder $leases) => $leases->where('status', 'active'));
        $next = $toPay()->with('chequeable')->orderBy('cheque_date')->first();

        return [
            'activeLeases' => $active()->count(),
            'annualRent' => (float) $active()->sum('annual_rent'),
            'outstanding' => (float) $toPay()->sum('amount'),
            'overdue' => $toPay()->where('status', 'pending')->whereDate('cheque_date', '<', today())->count(),
            'nextPayment' => $next ? [
                'dueDate' => $next->cheque_date->toDateString(),
                'amount' => (float) $next->amount,
                'leaseNumber' => $next->chequeable->lease_number,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function leaseDetails(HeadLease $lease): array
    {
        return [
            'id' => $lease->id,
            'number' => $lease->lease_number,
            'ejariNumber' => $lease->ejari_number,
            'property' => $lease->property->only(['id', 'name', 'code']),
            'landlordName' => $lease->landlord->name,
            'landlordId' => $lease->landlord_id,
            'startDate' => $lease->start_date->toDateString(),
            'endDate' => $lease->end_date->toDateString(),
            'annualRent' => (float) $lease->annual_rent,
            'paymentsPerYear' => $lease->payments_per_year,
            'installmentAmount' => round((float) $lease->annual_rent / $lease->payments_per_year, 2),
            'status' => $lease->status,
            'daysLeft' => (int) today()->diffInDays($lease->end_date, false),
        ];
    }
}
