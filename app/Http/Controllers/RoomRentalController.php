<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\RoomRentalEndRequest;
use App\Http\Requests\RoomRentalRequest;
use App\Models\Bed;
use App\Models\Cheque;
use App\Models\Client;
use App\Models\Company;
use App\Models\Occupant;
use App\Models\RentalPayment;
use App\Models\Room;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Individual rentals: beds and rooms rented straight to individuals
 * without a contract, with where each tenant's rent stands, their
 * receipts and cheques, and moving them out.
 */
class RoomRentalController extends Controller
{
    use ListsRecords;

    /**
     * Months of rent the statement on a rental's page shows, newest last.
     */
    private const STATEMENT_MONTHS = 24;

    /**
     * List the rentals: running ones first, most overdue on top.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Rentals/Index', ['company' => null]);
        }

        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = $this->listFilters($request, [
            'status' => RoomRental::STATUSES,
            'standing' => RoomRental::STANDINGS,
            'unit' => RoomRental::UNIT_TYPES,
            'properties' => $properties->pluck('code')->all(),
        ]);
        $propertyIds = $properties->whereIn('code', $filters['properties'])->modelKeys();
        $standings = $this->standings($company);
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'properties'), 'property_id');
        $standingCounts = $this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'standing')->pluck('id')
            ->countBy(fn (int $id) => $standings[$id]['standing'] ?? 'paid_up');

        $rentals = $this->inStandingOrder($this->filteredQuery($company, $filters, $propertyIds, $standings), $standings)
            ->with(self::listRelations())
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->paginate($filters['perPage'])
            ->withQueryString()
            ->through(fn (RoomRental $rental) => self::listDetails($rental, $standings[$rental->id] ?? $rental->rentStanding()));

        return Inertia::render('Rentals/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(RoomRental::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'status'), 'status')),
                'standing' => $this->facetOptions(RoomRental::STANDINGS, $standingCounts),
                'unit' => $this->facetOptions(RoomRental::UNIT_TYPES, $this->countBy($this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'unit'), 'unit_type')),
                'properties' => $properties->map(fn ($property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])->values(),
            ],
            'summary' => $this->summary($company, $standings),
            'rentals' => $rentals,
        ]);
    }

    /**
     * Show the form for renting a bed or room to an individual. `?room=`
     * opens it on a room.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);

        return Inertia::render('Rentals/Form', [
            'rental' => null,
            'currency' => $company->default_currency,
            'defaults' => ['room_id' => $request->integer('room') ?: null, 'client_id' => $request->integer('client') ?: null],
            'tenants' => $company->clients()
                ->where('client_type', 'individual')
                ->where('status', 'active')
                ->whereDoesntHave('occupants', fn (Builder $occupants) => $occupants->whereHas('currentStay'))
                ->with(['occupants' => fn (HasMany $occupants) => $occupants->orderBy('id')->select(['id', 'client_id', 'gender'])])
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'id_type', 'id_number'])
                ->map(fn (Client $client) => [
                    'id' => $client->id,
                    'name' => $client->name,
                    'phone' => $client->phone,
                    'idNumber' => $client->id_number,
                    'gender' => $client->occupants->first()?->gender,
                ]),
            'rooms' => RoomRental::roomsToRent($company)->map(fn (Room $room) => [
                'id' => $room->id,
                'number' => $room->room_number,
                'block' => $room->block,
                'floor' => $room->floor_number,
                'capacity' => $room->capacity,
                'genderPolicy' => $room->gender_policy,
                'rentPerBed' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
                'property' => $room->property->only(['id', 'name', 'code']),
                'beds' => $room->beds->map(fn (Bed $bed) => ['id' => $bed->id, 'label' => $bed->label])->values(),
                'canRentWhole' => $room->beds->count() === $room->active_beds_count,
            ]),
            'idTypes' => Client::ID_TYPES,
        ]);
    }

    /**
     * Rent the bed or room and check the tenant in. A new tenant is added
     * as an individual client, and as the occupant of the bed.
     */
    public function store(RoomRentalRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $bed = Bed::query()->with('room')->findOrFail($request->integer('bed_id'));

        $rental = DB::transaction(function () use ($request, $company, $bed) {
            $client = $request->validated('client_mode') === 'new'
                ? $this->newTenant($company, $request->validated('new_client'))
                : $company->clients()->findOrFail($request->integer('client_id'));

            $occupant = $client->occupants()->whereDoesntHave('currentStay')->orderBy('id')->first()
                ?? $this->occupantFor($client, $request->tenantGender());

            $rental = new RoomRental($request->terms());
            $rental->forceFill([
                'company_id' => $company->id,
                'rental_number' => RoomRental::nextNumber($company->id),
                'client_id' => $client->id,
                'occupant_id' => $occupant->id,
                'property_id' => $bed->room->property_id,
                'room_id' => $bed->room_id,
                'bed_id' => $bed->id,
                'unit_type' => $request->validated('unit_type'),
                'status' => 'active',
                'created_by' => $request->user()->id,
            ])->save();

            $rental->checkIn();

            return $rental;
        });

        return to_route('rentals.show', $rental)
            ->with('success', "{$rental->rental_number} was created and {$rental->client->name} is checked into room {$bed->room->room_number}, bed {$bed->label}. Record their first payment.");
    }

    /**
     * Show a rental: where the rent stands, month by month, with the
     * tenant's receipts and cheques.
     */
    public function show(Request $request, RoomRental $roomRental): Response
    {
        $this->ensureSameCompany($request, $roomRental);

        $roomRental->load([
            ...self::listRelations(),
            'client:id,name,phone,email,nationality,id_type,id_number',
            'occupant:id,full_name,gender',
            'createdBy:id,name',
            'payments' => fn (HasMany $payments) => $payments->with('receivedBy:id,name')->orderByDesc('paid_on')->orderByDesc('id'),
        ]);
        $standing = $roomRental->rentStanding();
        $cheques = $roomRental->cheques()->with([...ChequeController::detailRelations(), ...ChequeController::historyRelations()])->orderByDesc('cheque_date')->orderByDesc('id')->get();

        return Inertia::render('Rentals/Show', [
            'currency' => $roomRental->company->default_currency,
            'rental' => [
                ...self::listDetails($roomRental, $standing),
                'client' => $roomRental->client->only(['id', 'name', 'phone', 'email', 'nationality', 'id_type', 'id_number']),
                'occupant' => ['id' => $roomRental->occupant->id, 'gender' => $roomRental->occupant->gender],
                'notes' => $roomRental->notes,
                'createdBy' => $roomRental->createdBy?->name,
                'createdAt' => $roomRental->created_at?->toDateString(),
                'deposit' => $roomRental->depositStanding(),
                'depositRefund' => $roomRental->deposit_refunded > 0 ? [
                    'amount' => (float) $roomRental->deposit_refunded,
                    'on' => $roomRental->deposit_refunded_on?->toDateString(),
                    'method' => $roomRental->deposit_refund_method,
                ] : null,
                'otherPaid' => $roomRental->paidFor('other'),
                'canChangeRent' => ! $roomRental->payments->contains(fn (RentalPayment $payment) => $payment->purpose === 'rent' && ! $payment->isVoid()),
            ],
            'statement' => $this->statement($roomRental, $standing),
            'payments' => $roomRental->payments->map(fn (RentalPayment $payment) => RentalPaymentController::details($payment)),
            'cheques' => $cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque)),
            'pendingCheques' => [
                'count' => $cheques->whereIn('status', ['received', 'deposited'])->count(),
                'amount' => round((float) $cheques->whereIn('status', ['received', 'deposited'])->sum('amount'), 2),
            ],
            'banks' => ChequeController::knownBanks($roomRental->company),
            'chequeStatuses' => ChequeController::statusOptions(),
            'methods' => RentalPayment::METHODS,
            'refundMethods' => RoomRental::REFUND_METHODS,
        ]);
    }

    /**
     * Show the form for changing a rental's terms.
     */
    public function edit(Request $request, RoomRental $roomRental): Response
    {
        $this->ensureSameCompany($request, $roomRental);

        $roomRental->load(self::listRelations());

        return Inertia::render('Rentals/Form', [
            'rental' => [
                ...self::listDetails($roomRental, $roomRental->rentStanding()),
                'canChangeRent' => ! $roomRental->payments()->where('purpose', 'rent')->where('status', 'cleared')->exists(),
                'form' => [
                    'monthly_rent' => (float) $roomRental->monthly_rent,
                    'security_deposit' => (float) $roomRental->security_deposit,
                    'start_date' => $roomRental->start_date->toDateString(),
                    'end_date' => $roomRental->end_date?->toDateString(),
                    'notes' => $roomRental->notes,
                ],
            ],
            'currency' => $roomRental->company->default_currency,
            'defaults' => null,
            'tenants' => [],
            'rooms' => [],
            'idTypes' => Client::ID_TYPES,
        ]);
    }

    /**
     * Save a rental's new terms. Once rent has been paid its amount and
     * start date stay as they are, so receipts keep meaning what they said.
     *
     * @throws ValidationException When the rent or start date change after rent was paid.
     */
    public function update(RoomRentalRequest $request, RoomRental $roomRental): RedirectResponse
    {
        $terms = $request->terms();
        $hasRentPaid = $roomRental->payments()->where('purpose', 'rent')->where('status', 'cleared')->exists();

        if ($hasRentPaid && ((float) $terms['monthly_rent'] !== (float) $roomRental->monthly_rent || $terms['start_date'] !== $roomRental->start_date->toDateString())) {
            throw ValidationException::withMessages(['monthly_rent' => 'Rent has already been paid on this rental, so its rent and start date stay as they are. To change the rent, move the tenant out and start a new rental.']);
        }

        DB::transaction(function () use ($roomRental, $terms) {
            $startChanged = $terms['start_date'] !== $roomRental->start_date->toDateString();
            $roomRental->fill($terms)->save();

            if ($startChanged) {
                $roomRental->occupancy()->whereNull('check_out_date')->update(['check_in_date' => $roomRental->start_date]);
                $roomRental->room->recalculateOccupancy();
            }
        });

        return to_route('rentals.show', $roomRental)->with('success', "{$roomRental->rental_number} was updated.");
    }

    /**
     * Move the tenant out, handing back any deposit.
     */
    public function end(RoomRentalEndRequest $request, RoomRental $roomRental): RedirectResponse
    {
        $refund = $request->filled('deposit_refunded') ? (float) $request->validated('deposit_refunded') : null;

        $roomRental->end($request->date('moved_out_on'), $refund, $request->validated('deposit_refund_method'), $request->validated('note'));

        $standing = $roomRental->rentStanding();
        $owing = $standing['arrears'] > 0 ? " {$roomRental->client->name} still owes {$standing['arrears']} in rent." : '';

        return back()->with('success', "{$roomRental->client->name} moved out and {$roomRental->rental_number} has ended.{$owing}");
    }

    /**
     * The relations listDetails() reads, for eager loading. Rooms are
     * loaded even once removed, so old rentals still say where they were.
     *
     * @return array<string, mixed>
     */
    public static function listRelations(): array
    {
        return [
            'client:id,name,phone',
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'room' => fn ($query) => $query->withTrashed()->select(['id', 'room_number', 'capacity']),
            'bed:id,label',
        ];
    }

    /**
     * One rental as the lists and its page show it, with where its rent stands.
     *
     * @param  array<string, mixed>  $standing  from RoomRental::rentStanding()
     * @return array<string, mixed>
     */
    public static function listDetails(RoomRental $rental, array $standing): array
    {
        return [
            'id' => $rental->id,
            'number' => $rental->rental_number,
            'status' => $rental->status,
            'unitType' => $rental->unit_type,
            'tenant' => $rental->client?->only(['id', 'name', 'phone']),
            'property' => $rental->property?->only(['id', 'name', 'code']),
            'room' => $rental->room ? ['id' => $rental->room->id, 'number' => $rental->room->room_number, 'capacity' => $rental->room->capacity] : null,
            'bed' => $rental->bed?->label,
            'monthlyRent' => (float) $rental->monthly_rent,
            'securityDeposit' => (float) $rental->security_deposit,
            'startDate' => $rental->start_date->toDateString(),
            'endDate' => $rental->end_date?->toDateString(),
            'movedOutOn' => $rental->moved_out_on?->toDateString(),
            'standing' => [
                ...$standing,
                'paidThrough' => $standing['paidThrough']?->toDateString(),
                'nextDue' => $standing['nextDue']?->toDateString(),
            ],
        ];
    }

    /**
     * Where the rent stands for each of the company's rentals, by id.
     *
     * @return array<int, array<string, mixed>>
     */
    private function standings(Company $company): array
    {
        return $company->roomRentals()
            ->withSum(['payments as rent_paid' => fn (Builder $payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
            ->get()
            ->mapWithKeys(fn (RoomRental $rental) => [$rental->id => $rental->rentStanding()])
            ->all();
    }

    /**
     * Running rentals first, and among them overdue, then due, then paid up.
     *
     * @param  HasMany<RoomRental, Company>  $query
     * @param  array<int, array<string, mixed>>  $standings
     * @return HasMany<RoomRental, Company>
     */
    private function inStandingOrder(HasMany $query, array $standings): HasMany
    {
        $query->orderByRaw("case when room_rentals.status = 'active' then 0 else 1 end");
        $cases = [];
        $bindings = [];

        foreach (['overdue', 'due'] as $rank => $standing) {
            $ids = array_keys(array_filter($standings, fn (array $row) => $row['standing'] === $standing));

            if ($ids !== []) {
                $cases[] = 'when room_rentals.id in ('.implode(',', array_fill(0, count($ids), '?')).") then {$rank}";
                array_push($bindings, ...$ids);
            }
        }

        return $cases === [] ? $query : $query->orderByRaw('case '.implode(' ', $cases).' else 2 end', $bindings);
    }

    /**
     * Each month of rent from the start (the latest STATEMENT_MONTHS), with
     * what it costs, what has been paid towards it and whether it is paid,
     * part paid, unpaid or still to come; the next month to fall due ends it.
     *
     * @param  array<string, mixed>  $standing
     * @return list<array{start: string, end: string, amount: float, paid: float, status: string}>
     */
    private function statement(RoomRental $rental, array $standing): array
    {
        $today = CarbonImmutable::today();
        $through = $rental->isActive() ? $today->addMonthNoOverflow() : ($rental->lastDay() ?? $today);
        $remaining = $standing['paid'];
        $lines = [];

        foreach ($rental->rentPeriods($through) as $period) {
            $paid = round(min($remaining, $period['amount']), 2);
            $remaining = round($remaining - $paid, 2);
            $isUpcoming = $period['start']->gt($today);

            $lines[] = [
                'start' => $period['start']->toDateString(),
                'end' => $period['end']->toDateString(),
                'amount' => $period['amount'],
                'paid' => $paid,
                'status' => match (true) {
                    $paid >= $period['amount'] => 'paid',
                    $isUpcoming => 'upcoming',
                    $paid > 0 => 'partial',
                    default => 'unpaid',
                },
            ];
        }

        return array_slice($lines, -self::STATEMENT_MONTHS);
    }

    /**
     * Headline figures: rentals running, their monthly rent, rent owed and
     * overdue, deposits held and what was collected this month.
     *
     * @param  array<int, array<string, mixed>>  $standings
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $standings): array
    {
        $active = fn () => $company->roomRentals()->active();
        $month = [today()->startOfMonth()->toDateString(), today()->endOfMonth()->toDateString()];
        $owed = collect($standings)->filter(fn (array $standing) => $standing['arrears'] > 0);
        $depositsPaid = (float) RentalPayment::query()
            ->where('company_id', $company->id)
            ->where('status', 'cleared')
            ->where('purpose', 'deposit')
            ->whereHas('rental', fn (Builder $rentals) => $rentals->where('status', 'active'))
            ->sum('amount');

        return [
            'active' => $active()->count(),
            'rooms' => $active()->where('unit_type', 'room')->count(),
            'monthlyRent' => round((float) $active()->sum('monthly_rent'), 2),
            'arrears' => ['count' => $owed->count(), 'amount' => round($owed->sum('arrears'), 2), 'overdue' => $owed->where('standing', 'overdue')->count()],
            'depositsHeld' => round($depositsPaid - (float) $active()->sum('deposit_refunded'), 2),
            'collectedThisMonth' => round((float) $company->rentalPayments()->where('status', 'cleared')->whereBetween('paid_on', $month)->sum('amount'), 2),
        ];
    }

    /**
     * The company's rentals narrowed by the search and filters, leaving out
     * the filter named in `$except`. The standing filter matches the
     * rentals whose rent stands that way today.
     *
     * @param  array<string, mixed>  $filters
     * @param  list<int>  $propertyIds
     * @param  array<int, array<string, mixed>>  $standings
     * @return HasMany<RoomRental, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $propertyIds, array $standings, ?string $except = null): HasMany
    {
        $search = $filters['search'];
        $standingIds = fn () => array_keys(array_filter($standings, fn (array $standing) => in_array($standing['standing'], $filters['standing'], true)));

        return $company->roomRentals()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('rental_number', "%{$search}%")
                ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")->orWhereLike('phone', "%{$search}%")->orWhereLike('id_number', "%{$search}%"))
                ->orWhereHas('room', fn (Builder $rooms) => $rooms->whereLike('room_number', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'unit' && $filters['unit'] !== [], fn (Builder $query) => $query->whereIn('unit_type', $filters['unit']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query->whereIn('property_id', $propertyIds))
            ->when($except !== 'standing' && $filters['standing'] !== [], fn (Builder $query) => $query->whereKey($standingIds()));
    }

    /**
     * Add a new individual client from the rental form.
     *
     * @param  array<string, mixed>  $details
     */
    private function newTenant(Company $company, array $details): Client
    {
        $client = new Client([
            'client_type' => 'individual',
            'name' => trim($details['name']),
            'contact_person_name' => trim($details['name']),
            'phone' => $details['phone'] ?? null,
            'email' => $details['email'] ?? null,
            'nationality' => $details['nationality'] ?? null,
            'id_type' => $details['id_type'],
            'id_number' => trim($details['id_number']),
            'status' => 'active',
        ]);
        $client->forceFill(['company_id' => $company->id])->save();

        return $client;
    }

    /**
     * The tenant as the person staying in the bed, from their client details.
     */
    private function occupantFor(Client $client, string $gender): Occupant
    {
        $idTaken = $client->id_number && Occupant::query()
            ->where('company_id', $client->company_id)
            ->where('id_type', $client->id_type)
            ->where('id_number', $client->id_number)
            ->exists();

        $occupant = new Occupant([
            'client_id' => $client->id,
            'full_name' => $client->name,
            'gender' => $gender,
            'nationality' => $client->nationality,
            'id_type' => $idTaken ? null : $client->id_type,
            'id_number' => $idTaken ? null : $client->id_number,
            'phone' => $client->phone,
        ]);
        $occupant->forceFill(['company_id' => $client->company_id])->save();

        return $occupant;
    }
}
