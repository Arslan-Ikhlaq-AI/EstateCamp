<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByClient;
use App\Http\Requests\RoomRequest;
use App\Models\Company;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomAttachment;
use App\Models\RoomType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RoomController extends Controller
{
    use FiltersByClient;

    public const AVAILABILITY = ['available', 'full'];

    public const SORTS = ['room', 'occupancy', 'capacity', 'rent', 'floor', 'created'];

    public const PER_PAGE_OPTIONS = [10, 25, 50];

    /**
     * List the company's rooms with search, filters, sorting and paging.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Rooms/Index', ['company' => null]);
        }

        $filters = $this->filters($request);

        $query = $this->filteredQuery($company, $filters)->with([
            'property:id,name,code',
            'roomType:id,name,slug',
            'attachments' => fn ($attachments) => $attachments->where('is_primary', true),
        ]);

        $this->applySort($query, $filters);

        return Inertia::render('Rooms/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => $this->facets($company, $filters),
            'summary' => $this->summary($company),
            'rooms' => $query
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Room $room) => $this->roomDetails($room)),
        ]);
    }

    /**
     * Show the form for adding a room, with the property preselected when
     * coming from a property.
     */
    public function create(Request $request): Response
    {
        abort_if($request->user()->company_id === null, 403);

        return Inertia::render('Rooms/Form', [
            'room' => null,
            'propertyId' => $request->integer('property') ?: null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save a new room with its photos.
     */
    public function store(RoomRequest $request): RedirectResponse
    {
        $property = Property::findOrFail($request->validated('property_id'));

        $room = DB::transaction(function () use ($request, $property) {
            $room = new Room($this->roomAttributes($request));
            $room->forceFill(['property_id' => $property->id, 'company_id' => $property->company_id])->save();

            $room->syncBeds();
            $this->syncPhotos($room, $request);
            $property->recalculateTotals();

            return $room;
        });

        return to_route('rooms.index')->with('success', "Room {$room->room_number} was added to {$property->name}.");
    }

    /**
     * Show the form for editing a room.
     */
    public function edit(Request $request, Room $room): Response
    {
        abort_unless($room->company_id === $request->user()->company_id, 404);

        $room->load(['property:id,name', 'attachments' => fn ($query) => $query->orderByDesc('is_primary')->orderBy('sort_order')]);

        return Inertia::render('Rooms/Form', [
            'room' => [
                'id' => $room->id,
                ...$room->only([
                    'property_id', 'room_number', 'block', 'floor_number', 'room_type_id', 'gender_policy',
                    'capacity', 'occupied_count', 'area_sqm', 'rent_per_bed', 'status', 'notes',
                ]),
                'amenities' => $room->amenities ?? [],
                'photos' => $room->attachments->map(fn (RoomAttachment $photo) => [
                    'id' => $photo->id,
                    'url' => $photo->thumbnail_url ?? $photo->file_url,
                ]),
            ],
            'propertyId' => null,
            ...$this->formOptions($request),
        ]);
    }

    /**
     * Save changes to a room and its photos.
     */
    public function update(RoomRequest $request, Room $room): RedirectResponse
    {
        $previousProperty = $room->property;
        $property = Property::findOrFail($request->validated('property_id'));

        DB::transaction(function () use ($request, $room, $property, $previousProperty) {
            $room->fill($this->roomAttributes($request));
            $room->forceFill(['property_id' => $property->id])->save();

            $room->syncBeds();
            $this->syncPhotos($room, $request);
            $property->recalculateTotals();

            if ($previousProperty && $previousProperty->isNot($property)) {
                $previousProperty->recalculateTotals();
            }
        });

        return to_route('rooms.index')->with('success', "Room {$room->room_number} was updated.");
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
            'roomTypes' => RoomType::query()->where('is_active', true)->orderBy('sort_order')->get(['id', 'name', 'slug']),
            'statuses' => Room::STATUSES,
            'genderPolicies' => Room::GENDER_POLICIES,
            'amenities' => Room::AMENITIES,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function roomAttributes(RoomRequest $request): array
    {
        return [
            ...Arr::except($request->validated(), ['property_id', 'photos', 'keep_photos']),
            'amenities' => array_values($request->validated('amenities', [])),
        ];
    }

    /**
     * Keep the listed existing photos, add uploads after them, and make the
     * first remaining photo the cover.
     */
    private function syncPhotos(Room $room, RoomRequest $request): void
    {
        $room->attachments()
            ->whereNotIn('id', $request->validated('keep_photos', []))
            ->delete();

        $position = (int) $room->attachments()->max('sort_order');

        foreach ($request->file('photos', []) as $photo) {
            $url = '/storage/'.$photo->store("rooms/{$room->id}", 'public');

            $room->attachments()->create([
                'attachment_type' => 'image',
                'file_url' => $url,
                'thumbnail_url' => $url,
                'original_name' => $photo->getClientOriginalName(),
                'mime_type' => $photo->getMimeType(),
                'file_size' => $photo->getSize(),
                'sort_order' => ++$position,
                'uploaded_by' => $request->user()->id,
            ]);
        }

        $photos = $room->attachments()->orderByDesc('is_primary')->orderBy('sort_order')->get();

        $photos->each(fn (RoomAttachment $photo, int $index) => $photo->update(['is_primary' => $index === 0]));
    }

    /**
     * The list options from the query string. Unknown values fall back to the
     * defaults rather than failing, so a stale or hand-edited link still opens.
     *
     * @return array{search: string, properties: list<string>, clients: list<string>, types: list<string>, status: list<string>, gender: list<string>, availability: list<string>, sort: string, direction: string, perPage: int}
     */
    private function filters(Request $request): array
    {
        $sort = $request->string('sort')->toString();
        $perPage = $request->integer('perPage');

        return [
            'search' => $request->string('search')->trim()->limit(100, '')->toString(),
            'properties' => $this->listParameter($request, 'properties'),
            'clients' => array_values(array_filter($this->listParameter($request, 'clients'), 'ctype_digit')),
            'types' => $this->listParameter($request, 'types'),
            'status' => array_values(array_intersect($this->listParameter($request, 'status'), Room::STATUSES)),
            'gender' => array_values(array_intersect($this->listParameter($request, 'gender'), Room::GENDER_POLICIES)),
            'availability' => array_values(array_intersect($this->listParameter($request, 'availability'), self::AVAILABILITY)),
            'sort' => in_array($sort, self::SORTS, true) ? $sort : 'room',
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
     * The company's rooms (in properties that still exist) narrowed by the
     * search and filters, leaving out the facet named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Room, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->rooms()
            ->whereHas('property')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('room_number', "%{$search}%")
                ->orWhereLike('block', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])))
            ->when($except !== 'clients' && $filters['clients'] !== [], fn (Builder $query) => $query
                ->heldByClients($filters['clients']))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query
                ->whereHas('roomType', fn (Builder $types) => $types->whereIn('slug', $filters['types'])))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query
                ->whereIn('status', $filters['status']))
            ->when($except !== 'gender' && $filters['gender'] !== [], fn (Builder $query) => $query
                ->whereIn('gender_policy', $filters['gender']))
            ->when($except !== 'availability' && $filters['availability'] !== [], fn (Builder $query) => $query
                ->where(function (Builder $query) use ($filters) {
                    if (in_array('available', $filters['availability'], true)) {
                        $query->orWhere(fn (Builder $query) => $this->whereAvailable($query));
                    }

                    if (in_array('full', $filters['availability'], true)) {
                        $query->orWhereColumn('occupied_count', '>=', 'capacity');
                    }
                }));
    }

    /**
     * Active rooms with at least one free bed.
     */
    private function whereAvailable(Builder|HasMany $query): Builder|HasMany
    {
        return $query->where('status', 'active')->whereColumn('occupied_count', '<', 'capacity');
    }

    /**
     * @param  HasMany<Room, Company>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applySort(HasMany $query, array $filters): void
    {
        $direction = $filters['direction'];

        match ($filters['sort']) {
            'occupancy' => $query->orderByRaw("occupied_count * 1.0 / capacity {$direction}"),
            'capacity' => $query->orderBy('capacity', $direction),
            'rent' => $query->orderBy('rent_per_bed', $direction),
            'floor' => $query->orderBy('floor_number', $direction),
            'created' => $query->orderBy('created_at', $direction),
            default => $query
                ->orderBy(Property::query()->select('name')->whereColumn('properties.id', 'rooms.property_id'), $direction)
                ->orderBy('room_number', $direction),
        };

        $query->orderBy('rooms.id');
    }

    /**
     * Each filter's options with how many rooms it would show, given the
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
        $typeCounts = $count('types', 'room_type_id');
        $statusCounts = $count('status', 'status');
        $genderCounts = $count('gender', 'gender_policy');
        $availabilityQuery = fn () => $this->filteredQuery($company, $filters, except: 'availability');

        return [
            'clients' => $this->clientFacet($company, fn () => $this->filteredQuery($company, $filters, except: 'clients'), $filters['clients']),
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                ->map(fn (Property $property) => [
                    'value' => $property->code,
                    'label' => $property->name,
                    'count' => $propertyCounts->get($property->id, 0),
                ])
                ->all(),
            'types' => RoomType::query()->where('is_active', true)->orderBy('sort_order')->get(['id', 'name', 'slug'])
                ->map(fn (RoomType $type) => [
                    'value' => $type->slug,
                    'label' => $type->name,
                    'count' => $typeCounts->get($type->id, 0),
                ])
                ->all(),
            'status' => array_map(fn (string $status) => ['value' => $status, 'count' => $statusCounts->get($status, 0)], Room::STATUSES),
            'gender' => array_map(fn (string $gender) => ['value' => $gender, 'count' => $genderCounts->get($gender, 0)], Room::GENDER_POLICIES),
            'availability' => [
                ['value' => 'available', 'count' => $this->whereAvailable($availabilityQuery())->count()],
                ['value' => 'full', 'count' => $availabilityQuery()->whereColumn('occupied_count', '>=', 'capacity')->count()],
            ],
        ];
    }

    /**
     * Headline figures for all of the company's rooms, ignoring the filters.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $totals = $company->rooms()
            ->whereHas('property')
            ->selectRaw('count(*) as rooms')
            ->selectRaw("sum(case when status = 'active' then 1 else 0 end) as active")
            ->selectRaw("sum(case when status = 'under_maintenance' then 1 else 0 end) as maintenance")
            ->selectRaw('coalesce(sum(capacity), 0) as beds_total')
            ->selectRaw('coalesce(sum(occupied_count), 0) as beds_occupied')
            ->selectRaw("coalesce(sum(case when status = 'active' then capacity - occupied_count else 0 end), 0) as beds_available")
            ->selectRaw('coalesce(sum(occupied_count * rent_per_bed), 0) as rent_roll')
            ->toBase()
            ->first();

        return [
            'rooms' => (int) $totals->rooms,
            'active' => (int) $totals->active,
            'maintenance' => (int) $totals->maintenance,
            'beds' => Room::bedBreakdown((int) $totals->beds_total, (int) $totals->beds_occupied, (int) $totals->beds_available),
            'rentRoll' => (float) $totals->rent_roll,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function roomDetails(Room $room): array
    {
        $photo = $room->attachments->first();

        return [
            'id' => $room->id,
            'number' => $room->room_number,
            'block' => $room->block,
            'floor' => $room->floor_number,
            'property' => $room->property->only(['id', 'name', 'code']),
            'type' => $room->roomType->name,
            'typeSlug' => $room->roomType->slug,
            'genderPolicy' => $room->gender_policy,
            'capacity' => $room->capacity,
            'occupied' => $room->occupied_count,
            'available' => $room->status === 'active' ? $room->capacity - $room->occupied_count : 0,
            'areaSqm' => $room->area_sqm === null ? null : (float) $room->area_sqm,
            'rentPerBed' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
            'amenities' => $room->amenities ?? [],
            'status' => $room->status,
            'photoUrl' => $photo?->thumbnail_url ?? $photo?->file_url,
        ];
    }
}
