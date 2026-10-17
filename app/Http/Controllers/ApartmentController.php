<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApartmentRequest;
use App\Models\Apartment;
use App\Models\Company;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ApartmentController extends Controller
{
    public const SORTS = ['apartment', 'rent', 'area', 'bedrooms', 'floor', 'created'];

    public const PER_PAGE_OPTIONS = [10, 25, 50];

    /**
     * List the company's apartments with search, filters, sorting and paging.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Apartments/Index', ['company' => null]);
        }

        $filters = $this->filters($request);

        $query = $this->filteredQuery($company, $filters)->with('property:id,name,code');

        $this->applySort($query, $filters);

        return Inertia::render('Apartments/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => $this->facets($company, $filters),
            'summary' => $this->summary($company),
            'apartments' => $query
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Apartment $apartment) => $this->apartmentDetails($apartment)),
        ]);
    }

    /**
     * Show the form for adding an apartment, with the property preselected
     * when coming from a property.
     */
    public function create(Request $request): Response
    {
        abort_if($request->user()->company_id === null, 403);

        return Inertia::render('Apartments/Form', [
            'apartment' => null,
            'propertyId' => $request->integer('property') ?: null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save a new apartment.
     */
    public function store(ApartmentRequest $request): RedirectResponse
    {
        $property = Property::findOrFail($request->validated('property_id'));

        $apartment = new Apartment($this->apartmentAttributes($request));
        $apartment->forceFill(['property_id' => $property->id, 'company_id' => $property->company_id])->save();

        return to_route('apartments.show', $apartment)
            ->with('success', "Apartment {$apartment->apartment_number} was added to {$property->name}.");
    }

    /**
     * Show one apartment with its layout, pricing and utilities.
     */
    public function show(Request $request, Apartment $apartment): Response
    {
        abort_unless($apartment->company_id === $request->user()->company_id, 404);

        $apartment->load('property:id,name,code');

        return Inertia::render('Apartments/Show', [
            'currency' => Company::findOrFail($apartment->company_id)->default_currency,
            'apartment' => [
                ...$this->apartmentDetails($apartment),
                'utilityAccountNumber' => $apartment->utility_account_number,
                'notes' => $apartment->notes,
                'createdAt' => $apartment->created_at->toDateString(),
                'updatedAt' => $apartment->updated_at->toDateString(),
            ],
        ]);
    }

    /**
     * Show the form for editing an apartment.
     */
    public function edit(Request $request, Apartment $apartment): Response
    {
        abort_unless($apartment->company_id === $request->user()->company_id, 404);

        return Inertia::render('Apartments/Form', [
            'apartment' => [
                'id' => $apartment->id,
                ...$apartment->only([
                    'property_id', 'apartment_number', 'block', 'floor_number', 'bedrooms', 'bathrooms', 'area_sqm',
                    'furnishing_status', 'max_occupants', 'monthly_rent', 'security_deposit', 'utility_account_number',
                    'status', 'notes',
                ]),
                'amenities' => $apartment->amenities ?? [],
            ],
            'propertyId' => null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save changes to an apartment.
     */
    public function update(ApartmentRequest $request, Apartment $apartment): RedirectResponse
    {
        $property = Property::findOrFail($request->validated('property_id'));

        $apartment->fill($this->apartmentAttributes($request));
        $apartment->forceFill(['property_id' => $property->id])->save();

        return to_route('apartments.show', $apartment)
            ->with('success', "Apartment {$apartment->apartment_number} was updated.");
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(Request $request): array
    {
        $company = Company::findOrFail($request->user()->company_id);

        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code']),
            'statuses' => Apartment::STATUSES,
            'furnishingStatuses' => Apartment::FURNISHING_STATUSES,
            'amenities' => Apartment::AMENITIES,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function apartmentAttributes(ApartmentRequest $request): array
    {
        return [
            ...Arr::except($request->validated(), ['property_id']),
            'amenities' => array_values($request->validated('amenities', [])),
        ];
    }

    /**
     * The list options from the query string. Unknown values fall back to the
     * defaults rather than failing, so a stale or hand-edited link still opens.
     *
     * @return array{search: string, properties: list<string>, status: list<string>, furnishing: list<string>, bedrooms: list<string>, sort: string, direction: string, perPage: int}
     */
    private function filters(Request $request): array
    {
        $sort = $request->string('sort')->toString();
        $perPage = $request->integer('perPage');

        return [
            'search' => $request->string('search')->trim()->limit(100, '')->toString(),
            'properties' => $this->listParameter($request, 'properties'),
            'status' => array_values(array_intersect($this->listParameter($request, 'status'), Apartment::STATUSES)),
            'furnishing' => array_values(array_intersect($this->listParameter($request, 'furnishing'), Apartment::FURNISHING_STATUSES)),
            'bedrooms' => array_values(array_filter($this->listParameter($request, 'bedrooms'), fn (string $value) => ctype_digit($value) && strlen($value) <= 2)),
            'sort' => in_array($sort, self::SORTS, true) ? $sort : 'apartment',
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
     * The company's apartments (in properties that still exist) narrowed by
     * the search and filters, leaving out the facet named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Apartment, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->apartments()
            ->whereHas('property')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('apartment_number', "%{$search}%")
                ->orWhereLike('block', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query
                ->whereIn('status', $filters['status']))
            ->when($except !== 'furnishing' && $filters['furnishing'] !== [], fn (Builder $query) => $query
                ->whereIn('furnishing_status', $filters['furnishing']))
            ->when($except !== 'bedrooms' && $filters['bedrooms'] !== [], fn (Builder $query) => $query
                ->whereIn('bedrooms', array_map('intval', $filters['bedrooms'])));
    }

    /**
     * @param  HasMany<Apartment, Company>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applySort(HasMany $query, array $filters): void
    {
        $direction = $filters['direction'];

        match ($filters['sort']) {
            'rent' => $query->orderBy('monthly_rent', $direction),
            'area' => $query->orderBy('area_sqm', $direction),
            'bedrooms' => $query->orderBy('bedrooms', $direction),
            'floor' => $query->orderBy('floor_number', $direction),
            'created' => $query->orderBy('created_at', $direction),
            default => $query
                ->orderBy(Property::query()->select('name')->whereColumn('properties.id', 'apartments.property_id'), $direction)
                ->orderBy('apartment_number', $direction),
        };

        $query->orderBy('apartments.id');
    }

    /**
     * Each filter's options with how many apartments it would show, given the
     * search and the other filters.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, list<array<string, mixed>>>
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

        $propertyCounts = $count('properties', 'property_id');
        $statusCounts = $count('status', 'status');
        $furnishingCounts = $count('furnishing', 'furnishing_status');
        $bedroomCounts = $count('bedrooms', 'bedrooms');

        return [
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                ->map(fn (Property $property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ])
                ->all(),
            'status' => array_map(fn (string $status) => ['value' => $status, 'count' => $statusCounts->get($status, 0)], Apartment::STATUSES),
            'furnishing' => array_map(fn (string $furnishing) => ['value' => $furnishing, 'count' => $furnishingCounts->get($furnishing, 0)], Apartment::FURNISHING_STATUSES),
            'bedrooms' => $company->apartments()->whereHas('property')->distinct()->orderBy('bedrooms')->pluck('bedrooms')
                ->map(fn (int $bedrooms) => ['value' => (string) $bedrooms, 'count' => $bedroomCounts->get($bedrooms, 0)])
                ->all(),
        ];
    }

    /**
     * Headline figures for all of the company's apartments, ignoring the
     * filters. Occupancy is measured against apartments in service (vacant,
     * occupied or reserved); the rent roll is the rent of occupied apartments.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $totals = $company->apartments()
            ->whereHas('property')
            ->selectRaw('count(*) as apartments')
            ->selectRaw("sum(case when status = 'vacant' then 1 else 0 end) as vacant")
            ->selectRaw("sum(case when status = 'occupied' then 1 else 0 end) as occupied")
            ->selectRaw("sum(case when status = 'reserved' then 1 else 0 end) as reserved")
            ->selectRaw("sum(case when status = 'under_maintenance' then 1 else 0 end) as maintenance")
            ->selectRaw("coalesce(sum(case when status = 'occupied' then monthly_rent else 0 end), 0) as rent_roll")
            ->toBase()
            ->first();

        $inService = (int) $totals->vacant + (int) $totals->occupied + (int) $totals->reserved;

        return [
            'apartments' => (int) $totals->apartments,
            'vacant' => (int) $totals->vacant,
            'occupied' => (int) $totals->occupied,
            'reserved' => (int) $totals->reserved,
            'maintenance' => (int) $totals->maintenance,
            'inService' => $inService,
            'occupancyRate' => $inService > 0 ? round((int) $totals->occupied / $inService * 100, 1) : null,
            'rentRoll' => (float) $totals->rent_roll,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function apartmentDetails(Apartment $apartment): array
    {
        return [
            'id' => $apartment->id,
            'number' => $apartment->apartment_number,
            'block' => $apartment->block,
            'floor' => $apartment->floor_number,
            'property' => $apartment->property->only(['id', 'name', 'code']),
            'bedrooms' => $apartment->bedrooms,
            'bathrooms' => $apartment->bathrooms,
            'areaSqm' => $apartment->area_sqm === null ? null : (float) $apartment->area_sqm,
            'furnishing' => $apartment->furnishing_status,
            'maxOccupants' => $apartment->max_occupants,
            'amenities' => $apartment->amenities ?? [],
            'monthlyRent' => $apartment->monthly_rent === null ? null : (float) $apartment->monthly_rent,
            'securityDeposit' => $apartment->security_deposit === null ? null : (float) $apartment->security_deposit,
            'status' => $apartment->status,
        ];
    }
}
