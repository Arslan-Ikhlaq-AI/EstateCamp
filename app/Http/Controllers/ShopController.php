<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShopRequest;
use App\Models\Company;
use App\Models\Property;
use App\Models\Shop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class ShopController extends Controller
{
    public const SORTS = ['shop', 'rent', 'area', 'floor', 'created'];

    public const PER_PAGE_OPTIONS = [10, 25, 50];

    /**
     * List the company's shops with search, filters, sorting and paging.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Shops/Index', ['company' => null]);
        }

        $filters = $this->filters($request);

        $query = $this->filteredQuery($company, $filters)->with('property:id,name,code');

        $this->applySort($query, $filters);

        return Inertia::render('Shops/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => $this->facets($company, $filters),
            'summary' => $this->summary($company),
            'shops' => $query
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Shop $shop) => $this->shopDetails($shop)),
        ]);
    }

    /**
     * Show the form for adding a shop, with the property preselected when
     * coming from a property.
     */
    public function create(Request $request): Response
    {
        abort_if($request->user()->company_id === null, 403);

        return Inertia::render('Shops/Form', [
            'shop' => null,
            'propertyId' => $request->integer('property') ?: null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save a new shop.
     */
    public function store(ShopRequest $request): RedirectResponse
    {
        $property = Property::findOrFail($request->validated('property_id'));

        $shop = new Shop($this->shopAttributes($request));
        $shop->forceFill(['property_id' => $property->id, 'company_id' => $property->company_id])->save();

        return to_route('shops.show', $shop)
            ->with('success', "Shop {$shop->shop_number} was added to {$property->name}.");
    }

    /**
     * Show one shop with its details, pricing and utilities.
     */
    public function show(Request $request, Shop $shop): Response
    {
        abort_unless($shop->company_id === $request->user()->company_id, 404);

        $shop->load('property:id,name,code');

        return Inertia::render('Shops/Show', [
            'currency' => Company::findOrFail($shop->company_id)->default_currency,
            'shop' => [
                ...$this->shopDetails($shop),
                'utilityAccountNumber' => $shop->utility_account_number,
                'notes' => $shop->notes,
                'createdAt' => $shop->created_at->toDateString(),
                'updatedAt' => $shop->updated_at->toDateString(),
            ],
        ]);
    }

    /**
     * Show the form for editing a shop.
     */
    public function edit(Request $request, Shop $shop): Response
    {
        abort_unless($shop->company_id === $request->user()->company_id, 404);

        return Inertia::render('Shops/Form', [
            'shop' => [
                'id' => $shop->id,
                ...$shop->only([
                    'property_id', 'shop_number', 'block', 'floor_number', 'shop_type', 'area_sqm', 'monthly_rent',
                    'security_deposit', 'utility_account_number', 'status', 'notes',
                ]),
                'amenities' => $shop->amenities ?? [],
            ],
            'propertyId' => null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save changes to a shop.
     */
    public function update(ShopRequest $request, Shop $shop): RedirectResponse
    {
        $property = Property::findOrFail($request->validated('property_id'));

        $shop->fill($this->shopAttributes($request));
        $shop->forceFill(['property_id' => $property->id])->save();

        return to_route('shops.show', $shop)
            ->with('success', "Shop {$shop->shop_number} was updated.");
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
            'statuses' => Shop::STATUSES,
            'types' => Shop::TYPES,
            'amenities' => Shop::AMENITIES,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function shopAttributes(ShopRequest $request): array
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
     * @return array{search: string, properties: list<string>, status: list<string>, types: list<string>, sort: string, direction: string, perPage: int}
     */
    private function filters(Request $request): array
    {
        $sort = $request->string('sort')->toString();
        $perPage = $request->integer('perPage');

        return [
            'search' => $request->string('search')->trim()->limit(100, '')->toString(),
            'properties' => $this->listParameter($request, 'properties'),
            'status' => array_values(array_intersect($this->listParameter($request, 'status'), Shop::STATUSES)),
            'types' => $this->listParameter($request, 'types'),
            'sort' => in_array($sort, self::SORTS, true) ? $sort : 'shop',
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
     * The company's shops (in properties that still exist) narrowed by the
     * search and filters, leaving out the facet named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Shop, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->shops()
            ->whereHas('property')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('shop_number', "%{$search}%")
                ->orWhereLike('block', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query
                ->whereIn('status', $filters['status']))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query
                ->whereIn('shop_type', $filters['types']));
    }

    /**
     * @param  HasMany<Shop, Company>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applySort(HasMany $query, array $filters): void
    {
        $direction = $filters['direction'];

        match ($filters['sort']) {
            'rent' => $query->orderBy('monthly_rent', $direction),
            'area' => $query->orderBy('area_sqm', $direction),
            'floor' => $query->orderBy('floor_number', $direction),
            'created' => $query->orderBy('created_at', $direction),
            default => $query
                ->orderBy(Property::query()->select('name')->whereColumn('properties.id', 'shops.property_id'), $direction)
                ->orderBy('shop_number', $direction),
        };

        $query->orderBy('shops.id');
    }

    /**
     * Each filter's options with how many shops it would show, given the
     * search and the other filters. Shop types are whatever the company's
     * shops use, since the column is free text.
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
        $typeCounts = $count('types', 'shop_type');

        return [
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                ->map(fn (Property $property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ])
                ->all(),
            'status' => array_map(fn (string $status) => ['value' => $status, 'count' => $statusCounts->get($status, 0)], Shop::STATUSES),
            'types' => $company->shops()->whereHas('property')->whereNotNull('shop_type')->distinct()->orderBy('shop_type')->pluck('shop_type')
                ->map(fn (string $type) => ['value' => $type, 'count' => $typeCounts->get($type, 0)])
                ->all(),
        ];
    }

    /**
     * Headline figures for all of the company's shops, ignoring the filters.
     * Occupancy is measured against shops in service (vacant, occupied or
     * reserved); the rent roll is the rent of occupied shops.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $totals = $company->shops()
            ->whereHas('property')
            ->selectRaw('count(*) as shops')
            ->selectRaw("sum(case when status = 'vacant' then 1 else 0 end) as vacant")
            ->selectRaw("sum(case when status = 'occupied' then 1 else 0 end) as occupied")
            ->selectRaw("sum(case when status = 'reserved' then 1 else 0 end) as reserved")
            ->selectRaw("sum(case when status = 'under_maintenance' then 1 else 0 end) as maintenance")
            ->selectRaw("coalesce(sum(case when status = 'occupied' then monthly_rent else 0 end), 0) as rent_roll")
            ->toBase()
            ->first();

        $inService = (int) $totals->vacant + (int) $totals->occupied + (int) $totals->reserved;

        return [
            'shops' => (int) $totals->shops,
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
    private function shopDetails(Shop $shop): array
    {
        return [
            'id' => $shop->id,
            'number' => $shop->shop_number,
            'block' => $shop->block,
            'floor' => $shop->floor_number,
            'property' => $shop->property->only(['id', 'name', 'code']),
            'type' => $shop->shop_type,
            'areaSqm' => $shop->area_sqm === null ? null : (float) $shop->area_sqm,
            'amenities' => $shop->amenities ?? [],
            'monthlyRent' => $shop->monthly_rent === null ? null : (float) $shop->monthly_rent,
            'securityDeposit' => $shop->security_deposit === null ? null : (float) $shop->security_deposit,
            'status' => $shop->status,
        ];
    }
}
