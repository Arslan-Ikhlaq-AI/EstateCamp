<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\OccupantRequest;
use App\Models\Bed;
use App\Models\Client;
use App\Models\Company;
use App\Models\Occupancy;
use App\Models\Occupant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OccupantController extends Controller
{
    use ListsRecords;

    /**
     * List the people the company houses, with where each one is staying now.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Occupants/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['status' => ['staying', 'not_staying'], 'gender' => Occupant::GENDERS, 'clients' => null]);
        $statusQuery = fn () => $this->filteredQuery($company, $filters, except: 'status');
        $staying = $statusQuery()->whereHas('currentStay')->count();
        $clientCounts = $this->countBy($this->filteredQuery($company, $filters, except: 'clients'), 'client_id');

        return Inertia::render('Occupants/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => [
                    ['value' => 'staying', 'count' => $staying],
                    ['value' => 'not_staying', 'count' => $statusQuery()->count() - $staying],
                ],
                'gender' => $this->facetOptions(Occupant::GENDERS, $this->countBy($this->filteredQuery($company, $filters, except: 'gender'), 'gender')),
                'clients' => $company->clients()->whereHas('occupants')->orderBy('name')->get(['id', 'name'])
                    ->map(fn (Client $client) => ['value' => (string) $client->id, 'label' => $client->name, 'count' => $clientCounts->get($client->id, 0)])
                    ->all(),
            ],
            'summary' => $this->summary($company),
            'occupants' => $this->filteredQuery($company, $filters)
                ->with(['client:id,name', 'currentStay.bed.room:id,room_number,property_id', 'currentStay.bed.room.property:id,name,code'])
                ->orderBy('full_name')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Occupant $occupant) => [
                    ...$this->occupantDetails($occupant),
                    'stay' => $occupant->currentStay ? $this->stayDetails($occupant->currentStay) : null,
                ]),
        ]);
    }

    /**
     * Show the form for registering an occupant, with the client preselected when coming from one.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);

        return Inertia::render('Occupants/Form', [
            'occupant' => null,
            'clientId' => $request->integer('client') ?: null,
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Register a new occupant.
     */
    public function store(OccupantRequest $request): RedirectResponse
    {
        $occupant = $this->currentCompany($request)->occupants()->create($request->validated());

        return to_route('occupants.show', $occupant)->with('success', "{$occupant->full_name} was registered. Check them into a bed when they arrive.");
    }

    /**
     * Show an occupant with their current stay and stay history.
     */
    public function show(Request $request, Occupant $occupant): Response
    {
        $this->ensureSameCompany($request, $occupant);

        $occupant->load([
            'client:id,name,client_type',
            'occupancies' => fn (HasMany $stays) => $stays->orderByDesc('check_in_date'),
            'occupancies.bed.room:id,room_number,property_id,gender_policy',
            'occupancies.bed.room.property:id,name,code',
            'occupancies.contractLine.contract:id,contract_number',
        ]);

        return Inertia::render('Occupants/Show', [
            'occupant' => [
                ...$this->occupantDetails($occupant),
                'notes' => $occupant->notes,
                'client' => $occupant->client->only(['id', 'name', 'client_type']),
            ],
            'stays' => $occupant->occupancies->map(fn (Occupancy $stay) => [
                ...$this->stayDetails($stay),
                'checkOutDate' => $stay->check_out_date?->toDateString(),
                'contract' => ['id' => $stay->contractLine->contract->id, 'number' => $stay->contractLine->contract->contract_number],
                'nights' => (int) $stay->check_in_date->diffInDays($stay->check_out_date ?? today()),
            ]),
        ]);
    }

    /**
     * Show the form for editing an occupant.
     */
    public function edit(Request $request, Occupant $occupant): Response
    {
        $this->ensureSameCompany($request, $occupant);

        return Inertia::render('Occupants/Form', [
            'occupant' => [
                'id' => $occupant->id,
                ...$occupant->only(['client_id', 'full_name', 'gender', 'nationality', 'id_type', 'id_number', 'phone', 'employee_number', 'notes']),
            ],
            'clientId' => null,
            ...$this->formOptions($occupant->company),
        ]);
    }

    /**
     * Save changes to an occupant.
     */
    public function update(OccupantRequest $request, Occupant $occupant): RedirectResponse
    {
        $occupant->update($request->validated());

        return to_route('occupants.show', $occupant)->with('success', "{$occupant->full_name} was updated.");
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        return [
            'clients' => $company->clients()->orderBy('name')->get(['id', 'name', 'client_type']),
            'genders' => Occupant::GENDERS,
            'idTypes' => Occupant::ID_TYPES,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function occupantDetails(Occupant $occupant): array
    {
        return [
            'id' => $occupant->id,
            'name' => $occupant->full_name,
            'gender' => $occupant->gender,
            'nationality' => $occupant->nationality,
            'idType' => $occupant->id_type,
            'idNumber' => $occupant->id_number,
            'phone' => $occupant->phone,
            'employeeNumber' => $occupant->employee_number,
            'client' => $occupant->client?->only(['id', 'name']),
        ];
    }

    /**
     * Where a stay is, for lists and the occupant page.
     *
     * @return array<string, mixed>
     */
    private function stayDetails(Occupancy $stay): array
    {
        return [
            'id' => $stay->id,
            'property' => $stay->bed->room->property->only(['id', 'name', 'code']),
            'roomId' => $stay->bed->room->id,
            'roomNumber' => $stay->bed->room->room_number,
            'bedLabel' => $stay->bed->label,
            'checkInDate' => $stay->check_in_date->toDateString(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<Occupant, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->occupants()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('id_number', "%{$search}%")
                ->orWhereLike('employee_number', "%{$search}%")
                ->orWhereLike('phone', "%{$search}%")))
            ->when($except !== 'status' && count($filters['status']) === 1, fn (Builder $query) => $filters['status'] === ['staying']
                ? $query->whereHas('currentStay')
                : $query->whereDoesntHave('currentStay'))
            ->when($except !== 'gender' && $filters['gender'] !== [], fn (Builder $query) => $query->whereIn('gender', $filters['gender']))
            ->when($except !== 'clients' && $filters['clients'] !== [], fn (Builder $query) => $query->whereIn('client_id', array_map('intval', $filters['clients'])));
    }

    /**
     * @return array<string, int>
     */
    private function summary(Company $company): array
    {
        $month = [today()->startOfMonth(), today()];

        return [
            'staying' => $company->occupancies()->whereNull('check_out_date')->count(),
            'freeBeds' => Bed::query()
                ->where('is_active', true)
                ->whereHas('room', fn (Builder $rooms) => $rooms->where('company_id', $company->id)->where('status', 'active'))
                ->whereDoesntHave('currentOccupancy')
                ->count(),
            'checkedIn' => $company->occupancies()->whereBetween('check_in_date', $month)->count(),
            'checkedOut' => $company->occupancies()->whereBetween('check_out_date', $month)->count(),
        ];
    }
}
