<?php

namespace App\Http\Controllers;

use App\Http\Requests\PropertyRequest;
use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\PropertyType;
use App\Models\Room;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        $today = today();

        $query = $this->filteredQuery($company, $filters)
            ->with('propertyType:id,name,slug')
            ->withOccupancy()
            ->withCount([
                'documents',
                'documents as expired_documents_count' => fn (Builder $documents) => $documents
                    ->whereDate('expires_on', '<', $today),
                'documents as expiring_documents_count' => fn (Builder $documents) => $documents
                    ->whereDate('expires_on', '>=', $today)
                    ->whereDate('expires_on', '<=', $today->copy()->addDays(DashboardController::EXPIRY_WARNING_DAYS)),
            ]);

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
            ...$this->formOptions(),
        ]);
    }

    /**
     * Save a new property with its documents.
     */
    public function store(PropertyRequest $request): RedirectResponse
    {
        $company = Company::findOrFail($request->user()->company_id);

        $property = DB::transaction(function () use ($request, $company) {
            $property = $company->properties()->create($this->propertyAttributes($request));
            $this->syncDocuments($property, $request);

            return $property;
        });

        return to_route('properties.index')->with('success', "{$property->name} was added.");
    }

    /**
     * Show the form for editing a property.
     */
    public function edit(Request $request, Property $property): Response
    {
        abort_unless($property->company_id === $request->user()->company_id, 404);

        $property->load(['documents' => fn ($query) => $query->orderBy('id')]);

        return Inertia::render('Properties/Form', [
            'property' => [
                'id' => $property->id,
                ...$property->only([
                    'name', 'code', 'property_type_id', 'status', 'cover_image_url',
                    'country_code', 'city', 'area', 'street', 'building_name', 'plot_number',
                    'makani_number', 'po_box', 'address', 'map_url',
                    'contact_person_name', 'contact_person_phone',
                    'ownership_type', 'landlord_name', 'landlord_phone', 'notes',
                ]),
                'latitude' => $property->latitude,
                'longitude' => $property->longitude,
                'lease_start_date' => $property->lease_start_date?->toDateString(),
                'lease_end_date' => $property->lease_end_date?->toDateString(),
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
            ...$this->formOptions(),
        ]);
    }

    /**
     * Save changes to a property and its documents.
     */
    public function update(PropertyRequest $request, Property $property): RedirectResponse
    {
        DB::transaction(function () use ($request, $property) {
            $property->update($this->propertyAttributes($request));
            $this->syncDocuments($property, $request);
        });

        return to_route('properties.index')->with('success', "{$property->name} was updated.");
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'propertyTypes' => PropertyType::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'name', 'slug']),
            'statuses' => self::STATUSES,
            'documentTypes' => PropertyDocument::TYPES,
        ];
    }

    /**
     * The validated property columns, with an uploaded cover stored on the
     * public disk.
     *
     * @return array<string, mixed>
     */
    private function propertyAttributes(PropertyRequest $request): array
    {
        $attributes = Arr::except($request->validated(), ['cover_image', 'documents']);

        if ($request->hasFile('cover_image')) {
            $attributes['cover_image_url'] = $this->storePublicly($request->file('cover_image'), 'properties/covers');
        }

        return $attributes;
    }

    /**
     * Make the property's documents match the submitted list: listed ones
     * are updated (keeping their file unless a new one is uploaded), new ones
     * are created and any left out are removed.
     */
    private function syncDocuments(Property $property, PropertyRequest $request): void
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
                $property->documents()->create($attributes);
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
            'landlordName' => $property->landlord_name,
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
