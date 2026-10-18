<?php

namespace App\Http\Controllers;

use App\Http\Requests\PropertyRequest;
use App\Models\Apartment;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\PropertyType;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\Shop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PropertyController extends Controller
{
    public const STATUSES = ['active', 'inactive', 'under_maintenance'];

    public const OWNERSHIP_TYPES = ['owned', 'leased'];

    public const SORTS = ['name', 'code', 'occupancy', 'beds', 'rooms', 'rent_roll', 'lease_end', 'created'];

    public const PER_PAGE_OPTIONS = [10, 25, 50];

    /**
     * Leases ending within this many days count as "ending soon".
     */
    public const LEASE_WARNING_DAYS = 90;

    /**
     * Columns matched by the search box.
     */
    private const SEARCHABLE_COLUMNS = ['name', 'code', 'area', 'city', 'building_name', 'makani_number'];

    /**
     * List the company's properties with search, filters, sorting and paging.
     */
    public function index(Request $request): Response
    {
        // Queried directly so the company is not cached on the shared `auth.user` prop.
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Properties/Index', ['company' => null]);
        }

        $filters = $this->filters($request);

        $query = $this->filteredQuery($company, $filters)
            ->with(['propertyType:id,name,slug', 'landlord:id,name'])
            ->withOccupancy()
            ->withCount($this->documentCounts());

        $this->applySort($query, $filters);

        return Inertia::render('Properties/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => $this->facets($company, $filters),
            'summary' => $this->summary($company),
            'properties' => $query
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Property $property) => $this->propertyDetails($property)),
        ]);
    }

    /**
     * Show the form for adding a property.
     */
    public function create(Request $request): Response
    {
        abort_if($request->user()->company_id === null, 403);

        return Inertia::render('Properties/Form', [
            'property' => null,
            'unitSummary' => null,
            ...$this->formOptions($request->user()->company_id),
        ]);
    }

    /**
     * Save a new property with its documents.
     */
    public function store(PropertyRequest $request): RedirectResponse
    {
        $company = Company::findOrFail($request->user()->company_id);

        [$property, $added] = DB::transaction(function () use ($request, $company) {
            $property = $company->properties()->create($this->propertyAttributes($request, $company));
            $this->syncDocuments($property, $request, $this->syncLease($property, $request));

            return [$property, $property->addUnits($request->validated('units', []))];
        });

        return to_route('properties.index')->with('success', trim("{$property->name} was added. {$this->unitsAddedMessage($added)}"));
    }

    /**
     * Show a property: its details and occupancy, which clients rent which
     * of its units, and its documents.
     */
    public function show(Request $request, Property $property): Response
    {
        abort_unless($property->company_id === $request->user()->company_id, 404);

        $property = Property::query()
            ->whereKey($property->id)
            ->with([
                'propertyType:id,name,slug',
                'landlord:id,name',
                'company:id,default_currency',
                'documents' => fn ($query) => $query->orderBy('id'),
                'documents.headLease:id,lease_number',
            ])
            ->withOccupancy()
            ->withCount([...$this->documentCounts(), 'shops', 'apartments'])
            ->firstOrFail();
        $lease = $property->currentLease();

        return Inertia::render('Properties/Show', [
            'currency' => $property->company->default_currency,
            'property' => [
                ...$this->propertyDetails($property),
                'shops' => $property->shops_count,
                'apartments' => $property->apartments_count,
                'totalFloors' => $property->total_floors,
                'totalUnits' => $property->total_units,
                'notes' => $property->notes,
                'lease' => $lease ? ['id' => $lease->id, 'number' => $lease->lease_number] : null,
            ],
            'clients' => $this->clientShares($property),
            'documents' => $property->documents->map(fn (PropertyDocument $document) => [
                'id' => $document->id,
                ...$document->only(['document_type', 'title', 'document_number', 'file_url', 'head_lease_id']),
                'expires_on' => $document->expires_on?->toDateString(),
                'lease_number' => $document->headLease?->lease_number,
            ]),
        ]);
    }

    /**
     * Show the form for editing a property.
     */
    public function edit(Request $request, Property $property): Response
    {
        abort_unless($property->company_id === $request->user()->company_id, 404);

        $property->load(['documents' => fn ($query) => $query->orderBy('id')]);
        $lease = $property->currentLease();

        return Inertia::render('Properties/Form', [
            'unitSummary' => $this->unitSummary($property),
            'property' => [
                'id' => $property->id,
                ...$property->only([
                    'name', 'code', 'property_type_id', 'status', 'cover_image_url',
                    'country_code', 'city', 'area', 'street', 'building_name', 'plot_number',
                    'makani_number', 'po_box', 'address', 'map_url',
                    'contact_person_name', 'contact_person_phone',
                    'ownership_type', 'landlord_id', 'notes', 'total_floors', 'total_units',
                ]),
                'latitude' => $property->latitude,
                'longitude' => $property->longitude,
                'lease_start_date' => $property->lease_start_date?->toDateString(),
                'lease_end_date' => $property->lease_end_date?->toDateString(),
                ...($lease?->only(PropertyRequest::LEASE_TERMS) ?? []),
                'lease' => $lease ? ['id' => $lease->id, 'number' => $lease->lease_number] : null,
                'documents' => $property->documents->map(fn (PropertyDocument $document) => [
                    'id' => $document->id,
                    'document_type' => $document->document_type,
                    'title' => $document->title,
                    'document_number' => $document->document_number,
                    'issued_on' => $document->issued_on?->toDateString(),
                    'expires_on' => $document->expires_on?->toDateString(),
                    'notes' => $document->notes,
                    'file_url' => $document->file_url,
                ]),
            ],
            ...$this->formOptions($request->user()->company_id),
        ]);
    }

    /**
     * Save changes to a property and its documents.
     */
    public function update(PropertyRequest $request, Property $property): RedirectResponse
    {
        $added = DB::transaction(function () use ($request, $property) {
            $property->update($this->propertyAttributes($request, $property->company));
            $this->syncDocuments($property, $request, $this->syncLease($property, $request));

            return $property->addUnits($request->validated('units', []));
        });

        return to_route('properties.index')->with('success', trim("{$property->name} was updated. {$this->unitsAddedMessage($added)}"));
    }

    /**
     * How many rooms, shops and apartments the property already has, and the
     * next free number of each, to start new batches from.
     *
     * @return array<string, array{count: int, next: string}>
     */
    private function unitSummary(Property $property): array
    {
        $kinds = ['rooms' => ['room_number', '101'], 'shops' => ['shop_number', 'S-01'], 'apartments' => ['apartment_number', 'A-101']];

        return collect($kinds)->map(function (array $kind, string $relation) use ($property) {
            [$column, $fallback] = $kind;
            $numbers = $property->{$relation}()->pluck($column);

            return ['count' => $numbers->count(), 'next' => Property::nextUnitNumber($numbers, $fallback)];
        })->all();
    }

    /**
     * "5 rooms and 2 shops were added." for what a save created, or nothing.
     *
     * @param  array{rooms: int, shops: int, apartments: int}  $added
     */
    private function unitsAddedMessage(array $added): string
    {
        $parts = collect(['rooms' => 'room', 'shops' => 'shop', 'apartments' => 'apartment'])
            ->filter(fn (string $noun, string $kind) => $added[$kind] > 0)
            ->map(fn (string $noun, string $kind) => $added[$kind].' '.Str::plural($noun, $added[$kind]))
            ->values();

        if ($parts->isEmpty()) {
            return '';
        }

        return $parts->join(', ', ' and ').(array_sum($added) === 1 ? ' was added.' : ' were added.');
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(int $companyId): array
    {
        return [
            'currency' => Company::whereKey($companyId)->value('default_currency'),
            'landlords' => Landlord::query()
                ->where('company_id', $companyId)
                ->orderBy('name')
                ->get(['id', 'name', 'landlord_type', 'phone']),
            'propertyTypes' => PropertyType::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'name', 'slug']),
            'statuses' => self::STATUSES,
            'documentTypes' => PropertyDocument::TYPES,
            'requiredDocumentTypes' => PropertyDocument::REQUIRED_TYPES,
            'roomTypes' => RoomType::query()->where('is_active', true)->orderBy('sort_order')->get(['id', 'name', 'slug']),
            'genderPolicies' => Room::GENDER_POLICIES,
            'shopTypes' => Shop::TYPES,
            'furnishingStatuses' => Apartment::FURNISHING_STATUSES,
            'paymentsPerYear' => HeadLease::PAYMENTS_PER_YEAR,
        ];
    }

    /**
     * How many documents a property has, and how many have expired or expire soon.
     *
     * @return array<int|string, mixed>
     */
    private function documentCounts(): array
    {
        $today = today();

        return [
            'documents',
            'documents as expired_documents_count' => fn (Builder $documents) => $documents
                ->whereDate('expires_on', '<', $today),
            'documents as expiring_documents_count' => fn (Builder $documents) => $documents
                ->whereDate('expires_on', '>=', $today)
                ->whereDate('expires_on', '<=', $today->copy()->addDays(DashboardController::EXPIRY_WARNING_DAYS)),
        ];
    }

    /**
     * Who rents what in the property: for each client with a live contract
     * line here, the rooms and beds, shops and apartments they hold, their
     * contracts and the monthly value, the biggest first.
     *
     * @return list<array<string, mixed>>
     */
    private function clientShares(Property $property): array
    {
        return $property->contractLines()
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->with(['contract:id,client_id,contract_number,status', 'contract.client:id,name,client_type', 'room:id,capacity'])
            ->get()
            ->groupBy(fn (ContractLine $line) => $line->contract->client_id)
            ->map(function (Collection $lines) {
                $client = $lines->first()->contract->client;
                $roomLines = $lines->whereIn('unit_type', ['bed', 'room']);

                return [
                    'id' => $client->id,
                    'name' => $client->name,
                    'type' => $client->client_type,
                    'rooms' => $roomLines->pluck('room_id')->filter()->unique()->count(),
                    'beds' => (int) $roomLines->sum(fn (ContractLine $line) => $line->unit_type === 'room' ? $line->room->capacity : $line->quantity),
                    'shops' => $lines->where('unit_type', 'shop')->count(),
                    'apartments' => $lines->where('unit_type', 'apartment')->count(),
                    'monthly' => round($lines->sum(fn (ContractLine $line) => (float) $line->monthly_rate * $line->quantity), 2),
                    'contracts' => $lines->pluck('contract')->unique('id')
                        ->map(fn (Contract $contract) => ['id' => $contract->id, 'number' => $contract->contract_number, 'status' => $contract->status])
                        ->values()
                        ->all(),
                ];
            })
            ->sortBy([['beds', 'desc'], ['monthly', 'desc']])
            ->values()
            ->all();
    }

    /**
     * The validated property columns, with an uploaded cover stored on the
     * public disk.
     *
     * @return array<string, mixed>
     */
    private function propertyAttributes(PropertyRequest $request, Company $company): array
    {
        $attributes = Arr::except($request->validated(), ['cover_image', 'documents', 'landlord_mode', 'new_landlord', 'units', ...PropertyRequest::LEASE_TERMS]);

        if ($request->validated('landlord_mode') === 'new') {
            $attributes['landlord_id'] = $company->landlords()->create($request->validated('new_landlord'))->id;
        }

        if ($request->hasFile('cover_image')) {
            $attributes['cover_image_url'] = $this->storePublicly($request->file('cover_image'), 'properties/covers');
        }

        return $attributes;
    }

    /**
     * Create or update the head lease of a leased property from the terms
     * entered with it.
     */
    private function syncLease(Property $property, PropertyRequest $request): ?HeadLease
    {
        return $property->ownership_type === 'leased'
            ? $property->syncHeadLease($request->safe()->only(PropertyRequest::LEASE_TERMS))
            : null;
    }

    /**
     * Make the property's documents match the submitted list: listed ones
     * are updated (keeping their file unless a new one is uploaded), new ones
     * are created (filed under the property's lease, if any) and any left
     * out are removed.
     */
    private function syncDocuments(Property $property, PropertyRequest $request, ?HeadLease $lease): void
    {
        $submitted = collect($request->validated('documents', []));
        $existing = $property->documents()->get()->keyBy('id');

        $property->documents()
            ->whereNotIn('id', $submitted->pluck('id')->filter()->all())
            ->delete();

        foreach ($submitted as $index => $input) {
            $attributes = Arr::only($input, ['document_type', 'title', 'document_number', 'issued_on', 'expires_on', 'notes']);
            $file = $request->file("documents.{$index}.file");

            if ($file) {
                $attributes['file_url'] = $this->storePublicly($file, "properties/{$property->id}/documents");
            }

            $document = isset($input['id']) ? $existing->get($input['id']) : null;

            if ($document) {
                $document->update($attributes);
            } elseif ($file) {
                $property->documents()->create([...$attributes, 'head_lease_id' => $lease?->id]);
            }
        }
    }

    private function storePublicly(UploadedFile $file, string $directory): string
    {
        return '/storage/'.$file->store($directory, 'public');
    }

    /**
     * The list options from the query string. Unknown values fall back to the
     * defaults rather than failing, so a stale or hand-edited link still opens.
     *
     * @return array{search: string, types: list<string>, status: list<string>, ownership: list<string>, cities: list<string>, sort: string, direction: string, perPage: int}
     */
    private function filters(Request $request): array
    {
        $sort = $request->string('sort')->toString();
        $perPage = $request->integer('perPage');

        return [
            'search' => $request->string('search')->trim()->limit(100, '')->toString(),
            'types' => $this->listParameter($request, 'types'),
            'status' => array_values(array_intersect($this->listParameter($request, 'status'), self::STATUSES)),
            'ownership' => array_values(array_intersect($this->listParameter($request, 'ownership'), self::OWNERSHIP_TYPES)),
            'cities' => $this->listParameter($request, 'cities'),
            'sort' => in_array($sort, self::SORTS, true) ? $sort : 'name',
            'direction' => $request->input('direction') === 'desc' ? 'desc' : 'asc',
            'perPage' => in_array($perPage, self::PER_PAGE_OPTIONS, true) ? $perPage : self::PER_PAGE_OPTIONS[0],
        ];
    }

    /**
     * @return list<string>
     */
    private function listParameter(Request $request, string $key): array
    {
        return collect(Arr::wrap($request->input($key)))
            ->filter(fn (mixed $value) => is_string($value) && $value !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * The company's properties narrowed by the search and filters. A facet
     * named in `$except` is left out, so its own options can be counted
     * against everything else that is selected.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Property, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        return $company->properties()
            ->when($filters['search'] !== '', fn (Builder $query) => $query->where(function (Builder $query) use ($filters) {
                foreach (self::SEARCHABLE_COLUMNS as $column) {
                    $query->orWhereLike($column, "%{$filters['search']}%");
                }
            }))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query
                ->whereHas('propertyType', fn (Builder $types) => $types->whereIn('slug', $filters['types'])))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query
                ->whereIn('status', $filters['status']))
            ->when($except !== 'ownership' && $filters['ownership'] !== [], fn (Builder $query) => $query
                ->whereIn('ownership_type', $filters['ownership']))
            ->when($except !== 'cities' && $filters['cities'] !== [], fn (Builder $query) => $query
                ->whereIn('city', $filters['cities']));
    }

    /**
     * Order by the chosen column, then by id so pages never shuffle.
     *
     * @param  HasMany<Property, Company>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applySort(HasMany $query, array $filters): void
    {
        $direction = $filters['direction'];

        match ($filters['sort']) {
            'code' => $query->orderBy('code', $direction),
            'occupancy' => $query->orderBy($this->occupancyRateQuery(), $direction),
            'beds' => $query->orderBy('beds_total', $direction),
            'rooms' => $query->orderBy('rooms_count', $direction),
            'rent_roll' => $query->orderBy('rent_roll', $direction),
            // Owned properties have no lease end, so they always follow the leased ones.
            'lease_end' => $query->orderByRaw('lease_end_date is null')->orderBy('lease_end_date', $direction),
            'created' => $query->orderBy('created_at', $direction),
            default => $query->orderBy('name', $direction),
        };

        $query->orderBy('id');
    }

    /**
     * Occupied beds as a share of beds in service, per property. Properties
     * without beds in service sort as -1, below every real rate.
     *
     * @return Builder<Room>
     */
    private function occupancyRateQuery(): Builder
    {
        return Room::query()
            ->selectRaw(
                'coalesce(sum(occupied_count) * 1.0 / nullif(sum(case when status = ? then capacity else occupied_count end), 0), -1)',
                ['active'],
            )
            ->whereColumn('rooms.property_id', 'properties.id');
    }

    /**
     * The options for each filter with how many properties each would show,
     * given the search and the other filters.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, list<array{value: string, label?: string, count: int}>>
     */
    private function facets(Company $company, array $filters): array
    {
        $count = fn (string $facet, string $column): Collection => $this->filteredQuery($company, $filters, except: $facet)
            ->whereNotNull($column)
            ->groupBy($column)
            ->selectRaw("{$column} as value, count(*) as aggregate")
            ->toBase()
            ->pluck('aggregate', 'value')
            ->map(fn (mixed $aggregate) => (int) $aggregate);

        $typeCounts = $count('types', 'property_type_id');
        $statusCounts = $count('status', 'status');
        $ownershipCounts = $count('ownership', 'ownership_type');

        return [
            // Every active type is offered, plus any retired type still in use.
            'types' => PropertyType::query()
                ->where('is_active', true)
                ->orWhereIn('id', $company->properties()->select('property_type_id'))
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug'])
                ->map(fn (PropertyType $type) => [
                    'value' => $type->slug,
                    'label' => $type->name,
                    'count' => $typeCounts->get($type->id, 0),
                ])
                ->all(),
            'status' => array_map(fn (string $status) => [
                'value' => $status,
                'count' => $statusCounts->get($status, 0),
            ], self::STATUSES),
            'ownership' => array_map(fn (string $ownership) => [
                'value' => $ownership,
                'count' => $ownershipCounts->get($ownership, 0),
            ], self::OWNERSHIP_TYPES),
            'cities' => $count('cities', 'city')
                ->sortKeys()
                ->map(fn (int $aggregate, string $city) => ['value' => $city, 'count' => $aggregate])
                ->values()
                ->all(),
        ];
    }

    /**
     * Headline figures for the whole portfolio, ignoring the filters.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $properties = $company->properties()
            ->select(['properties.id', 'status', 'ownership_type', 'lease_end_date'])
            ->withOccupancy()
            ->get();

        $today = today();

        $documentsNeedingAttention = $company->properties()
            ->join('property_documents', 'property_documents.property_id', '=', 'properties.id')
            ->whereNull('property_documents.deleted_at')
            ->whereDate('property_documents.expires_on', '<=', $today->copy()->addDays(DashboardController::EXPIRY_WARNING_DAYS))
            ->count();

        return [
            'properties' => $properties->count(),
            'active' => $properties->where('status', 'active')->count(),
            'owned' => $properties->where('ownership_type', 'owned')->count(),
            'leased' => $properties->where('ownership_type', 'leased')->count(),
            'rooms' => (int) $properties->sum('rooms_count'),
            'beds' => Room::bedBreakdown(
                (int) $properties->sum('beds_total'),
                (int) $properties->sum('beds_occupied'),
                (int) $properties->sum('beds_available'),
            ),
            'rentRoll' => (float) $properties->sum('rent_roll'),
            'leasesEndingSoon' => $properties
                ->filter(fn (Property $property) => $property->lease_end_date?->between($today, $today->copy()->addDays(self::LEASE_WARNING_DAYS)))
                ->count(),
            'documentsNeedingAttention' => $documentsNeedingAttention,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function propertyDetails(Property $property): array
    {
        return [
            'id' => $property->id,
            'name' => $property->name,
            'code' => $property->code,
            'type' => $property->propertyType?->name,
            'typeSlug' => $property->propertyType?->slug,
            'coverImageUrl' => $property->cover_image_url,
            'status' => $property->status,
            'ownership' => $property->ownership_type,
            'city' => $property->city,
            'area' => $property->area,
            'address' => $property->address,
            'buildingName' => $property->building_name,
            'makaniNumber' => $property->makani_number,
            'mapUrl' => $property->map_url,
            'contactName' => $property->contact_person_name,
            'contactPhone' => $property->contact_person_phone,
            'landlordName' => $property->landlord?->name,
            'leaseStartsOn' => $property->lease_start_date?->toDateString(),
            'leaseEndsOn' => $property->lease_end_date?->toDateString(),
            'leaseDaysLeft' => $property->lease_end_date === null ? null : (int) today()->diffInDays($property->lease_end_date, false),
            'rooms' => $property->rooms_count,
            'beds' => Room::bedBreakdown(
                (int) $property->beds_total,
                (int) $property->beds_occupied,
                (int) $property->beds_available,
            ),
            'rentRoll' => (float) $property->rent_roll,
            'documents' => [
                'total' => $property->documents_count,
                'expiring' => $property->expiring_documents_count,
                'expired' => $property->expired_documents_count,
            ],
        ];
    }
}
