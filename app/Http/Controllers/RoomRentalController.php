<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\RoomRentalEndRequest;
use App\Http\Requests\RoomRentalRequest;
use App\Models\Cheque;
use App\Models\Client;
use App\Models\Company;
use App\Models\RentalPayment;
use App\Models\Room;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Short-term rentals: whole rooms rented to companies or people for a few
 * months without a contract, with where each tenant's rent stands, their
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
            'types' => Client::TYPES,
            'status' => RoomRental::STATUSES,
            'standing' => RoomRental::STANDINGS,
            'properties' => $properties->pluck('code')->all(),
        ]);
        $propertyIds = $properties->whereIn('code', $filters['properties'])->modelKeys();
        $standings = $this->standings($company);
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'properties'), 'property_id');
        $standingCounts = $this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'standing')->pluck('id')
            ->countBy(fn (int $id) => $standings[$id]['standing'] ?? 'paid_up');
        $clientTypes = $company->clients()->withTrashed()->pluck('client_type', 'id');
        $typeCounts = $this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'types')->pluck('client_id')
            ->countBy(fn (int $clientId) => $clientTypes[$clientId] ?? 'company');

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
                'types' => $this->facetOptions(Client::TYPES, $typeCounts),
                'status' => $this->facetOptions(RoomRental::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $propertyIds, $standings, except: 'status'), 'status')),
                'standing' => $this->facetOptions(RoomRental::STANDINGS, $standingCounts),
                'properties' => $properties->map(fn ($property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])->values(),
            ],
            'summary' => $this->summary($company, $standings),
            'rentals' => $rentals,
        ]);
    }

    /**
     * Show the form for renting rooms short-term to a company or a person.
     * `?room=` opens it on a room, `?property=` on a property, `?client=` on
     * a renter on file and `?type=individual` on a person.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $rooms = RoomRental::roomsToRent($company);
        $room = $rooms->firstWhere('id', $request->integer('room'));
        $propertyId = $room?->property_id ?? $rooms->firstWhere('property_id', $request->integer('property'))?->property_id;
        $clients = $company->clients()->where('status', 'active')->orderBy('name')->get(['id', 'name', 'phone', 'client_type', 'id_number']);
        $client = $clients->firstWhere('id', $request->integer('client'));

        return Inertia::render('Rentals/Form', [
            'rental' => null,
            'currency' => $company->default_currency,
            'defaults' => [
                'client_type' => $client?->client_type ?? ($request->query('type') === 'individual' ? 'individual' : 'company'),
                'client_id' => $client?->id,
                'property_id' => $propertyId,
                'room_ids' => $room ? [$room->id] : [],
            ],
            'clients' => $clients->map(fn (Client $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'phone' => $client->phone,
                'type' => $client->client_type,
                'idNumber' => $client->id_number,
            ]),
            'idTypes' => Client::ID_TYPES,
            'properties' => $rooms->groupBy('property_id')->map(fn (Collection $rooms) => [
                ...$rooms->first()->property->only(['id', 'name', 'code']),
                'rooms' => $rooms->map(fn (Room $room) => [
                    'id' => $room->id,
                    'number' => $room->room_number,
                    'block' => $room->block,
                    'floor' => $room->floor_number,
                    'capacity' => $room->capacity,
                    'rent' => $room->monthly_rent === null ? null : (float) $room->monthly_rent,
                ])->values(),
            ])->values(),
            'maxMonths' => RoomRental::MAX_TERM_MONTHS,
            'paymentMethods' => RoomRental::FIRST_PAYMENT_METHODS,
            'banks' => ChequeController::knownBanks($company),
        ]);
    }

    /**
     * Rent the rooms to the company or person; a new one is added as a
     * client. Unless the first payment is left for later, the first month's rent,
     * and any deposit, are recorded as paid today by transfer, or their
     * cheques go to the cheque register.
     */
    public function store(RoomRentalRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $rental = DB::transaction(function () use ($request, $company) {
            $client = $request->validated('client_mode') === 'new'
                ? $this->newClient($company, $request->validated('client_type'), $request->validated('new_client'))
                : $company->clients()->findOrFail($request->integer('client_id'));

            $rental = new RoomRental($request->terms());
            $rental->forceFill([
                'company_id' => $company->id,
                'rental_number' => RoomRental::nextNumber($company->id),
                'client_id' => $client->id,
                'property_id' => $request->integer('property_id'),
                'status' => 'active',
                'created_by' => $request->user()->id,
            ])->save();
            $rental->rooms()->attach($request->validated('room_ids'), ['company_id' => $company->id]);
            $rental->recountRooms();

            if ($request->validated('first_payment') === 'now') {
                $this->recordFirstPayment($rental, $request);
            }

            return $rental;
        });

        $rooms = $rental->rooms()->orderBy('room_number')->pluck('room_number');
        $isPaidByCheque = $request->validated('payment_method') === 'cheque';
        $paid = match (true) {
            $request->validated('first_payment') !== 'now' => ' Record their first payment.',
            $isPaidByCheque && $rental->security_deposit > 0 => ' The cheques for the first month’s rent and the deposit are in the cheque register.',
            $isPaidByCheque => ' The cheque for the first month’s rent is in the cheque register.',
            $rental->security_deposit > 0 => ' The first month’s rent and the deposit are recorded as paid.',
            default => ' The first month’s rent is recorded as paid.',
        };

        return to_route('rentals.show', $rental)
            ->with('success', "{$rental->rental_number} was created: {$rental->client->name} rents ".Str::plural('room', $rooms->count()).' '.$rooms->join(', ')." until {$rental->end_date->format('j M Y')}.{$paid}");
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
            'client:id,name,client_type,contact_person_name,phone,email,id_type,id_number,nationality',
            'createdBy:id,name',
            'payments' => fn (HasMany $payments) => $payments->with('receivedBy:id,name')->orderByDesc('paid_on')->orderByDesc('id'),
        ]);
        $standing = $roomRental->rentStanding();
        $cheques = $roomRental->cheques()->with([...ChequeController::detailRelations(), ...ChequeController::historyRelations()])->orderByDesc('cheque_date')->orderByDesc('id')->get();

        return Inertia::render('Rentals/Show', [
            'currency' => $roomRental->company->default_currency,
            'rental' => [
                ...self::listDetails($roomRental, $standing),
                'client' => $roomRental->client->only(['id', 'name', 'client_type', 'contact_person_name', 'phone', 'email', 'id_type', 'id_number', 'nationality']),
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
                    'months' => $roomRental->termMonths() ?? 1,
                    'start_date' => $roomRental->start_date->toDateString(),
                    'monthly_rent' => (float) $roomRental->monthly_rent,
                    'security_deposit' => (float) $roomRental->security_deposit,
                ],
            ],
            'currency' => $roomRental->company->default_currency,
            'defaults' => null,
            'clients' => [],
            'idTypes' => [],
            'properties' => [],
            'maxMonths' => RoomRental::MAX_TERM_MONTHS,
            'paymentMethods' => [],
            'banks' => [],
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

        $roomRental->fill($terms)->save();
        $roomRental->recountRooms();

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
            'client:id,name,phone,client_type',
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'rooms' => fn ($query) => $query->withTrashed()->select(['rooms.id', 'room_number', 'capacity'])->orderBy('room_number'),
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
            'tenant' => $rental->client ? [...$rental->client->only(['id', 'name', 'phone']), 'type' => $rental->client->client_type] : null,
            'property' => $rental->property?->only(['id', 'name', 'code']),
            'rooms' => $rental->rooms->map(fn (Room $room) => ['id' => $room->id, 'number' => $room->room_number, 'capacity' => $room->capacity])->values()->all(),
            'months' => $rental->termMonths(),
            'termOver' => $rental->isActive() && $rental->end_date?->lt(today()) === true,
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
     * part paid, unpaid or still to come. A running rental shows every month
     * of its term; an open-ended one ends with the next month to fall due.
     *
     * @param  array<string, mixed>  $standing
     * @return list<array{start: string, end: string, amount: float, paid: float, status: string}>
     */
    private function statement(RoomRental $rental, array $standing): array
    {
        $today = CarbonImmutable::today();
        $through = $rental->lastDay() ?? $today->addMonthNoOverflow();
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
     * Headline figures: rentals running and the rooms they hold, their
     * monthly rent, rent owed and overdue, deposits held and what was
     * collected this month.
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
            'rooms' => DB::table('room_rental_rooms')->whereIn('room_rental_id', $active()->select('room_rentals.id'))->count(),
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
                ->orWhereHas('rooms', fn (Builder $rooms) => $rooms->whereLike('room_number', "%{$search}%"))))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query->whereHas('client', fn (Builder $clients) => $clients->withTrashed()->whereIn('client_type', $filters['types'])))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query->whereIn('property_id', $propertyIds))
            ->when($except !== 'standing' && $filters['standing'] !== [], fn (Builder $query) => $query->whereKey($standingIds()));
    }

    /**
     * The first month's rent, and the deposit when there is one: receipts
     * paid today by transfer, or a cheque for each into the cheque register.
     */
    private function recordFirstPayment(RoomRental $rental, RoomRentalRequest $request): void
    {
        $purposes = array_filter(['rent' => (float) $rental->monthly_rent, 'deposit' => (float) $rental->security_deposit]);

        foreach ($purposes as $purpose => $amount) {
            if ($request->validated('payment_method') === 'cheque') {
                $rental->receiveCheque([
                    'purpose' => $purpose,
                    'cheque_date' => $request->validated('cheque_date'),
                    'amount' => $amount,
                    'cheque_number' => $request->validated($purpose === 'deposit' ? 'deposit_cheque_number' : 'cheque_number'),
                    'bank_name' => $request->validated('bank_name'),
                    'account_holder' => $rental->client->name,
                ], $request->user());

                continue;
            }

            $rental->recordPayment(['paid_on' => today(), 'amount' => $amount, 'purpose' => $purpose, 'method' => $request->validated('payment_method'), 'reference' => $request->validated('payment_reference')], $request->user());
        }
    }

    /**
     * Add a new client from the rental form: a company or a person by name
     * and phone (and a person's ID), with whichever other details were given.
     *
     * @param  array{name: string, phone: string, contact_person_name?: ?string, email?: ?string, trade_license_number?: ?string, tax_registration_number?: ?string, id_type?: ?string, id_number?: ?string, nationality?: ?string, address?: ?string}  $details
     */
    private function newClient(Company $company, string $type, array $details): Client
    {
        $optional = fn (string $key) => filled($details[$key] ?? null) ? trim($details[$key]) : null;

        $client = new Client([
            'client_type' => $type,
            'name' => trim($details['name']),
            'phone' => trim($details['phone']),
            'contact_person_name' => $optional('contact_person_name'),
            'email' => $optional('email'),
            'trade_license_number' => $optional('trade_license_number'),
            'tax_registration_number' => $optional('tax_registration_number'),
            'id_type' => $optional('id_type'),
            'id_number' => $optional('id_number'),
            'nationality' => $optional('nationality'),
            'address' => $optional('address'),
            'status' => 'active',
        ]);
        $client->forceFill(['company_id' => $company->id])->save();

        return $client;
    }
}
