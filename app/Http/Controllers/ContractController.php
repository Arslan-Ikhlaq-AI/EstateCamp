<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\ContractRequest;
use App\Http\Requests\ContractTerminationRequest;
use App\Models\Apartment;
use App\Models\Cheque;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Invoice;
use App\Models\Occupancy;
use App\Models\Property;
use App\Models\Room;
use App\Models\Shop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ContractController extends Controller
{
    use ListsRecords;

    /**
     * Request fields saved by hand rather than mass assigned.
     */
    private const RELATION_FIELDS = ['client_mode', 'client_id', 'new_client', 'lines', 'documents'];

    /**
     * List the company's contracts with their value, what they rent and who is staying.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Contracts/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['status' => Contract::STATUSES, 'types' => Client::TYPES]);
        $typeCounts = $this->filteredQuery($company, $filters, except: 'types')
            ->join('clients', 'clients.id', '=', 'contracts.client_id')
            ->toBase()
            ->groupBy('clients.client_type')
            ->selectRaw('clients.client_type as value, count(*) as aggregate')
            ->pluck('aggregate', 'value');

        return Inertia::render('Contracts/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(Contract::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
                'types' => array_map(fn (string $type) => ['value' => $type, 'count' => (int) $typeCounts->get($type, 0)], Client::TYPES),
            ],
            'summary' => $this->summary($company),
            'contracts' => $this->filteredQuery($company, $filters)
                ->with(['client:id,name,client_type', 'lines.room:id,capacity'])
                ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $stays->whereNull('check_out_date')])
                ->withSum(['invoices as balance' => fn (Builder $invoices) => $invoices->whereNot('status', 'void')], DB::raw('total - amount_paid'))
                ->orderByRaw("case status when 'active' then 0 when 'draft' then 1 else 2 end")
                ->orderByDesc('start_date')
                ->orderByDesc('contracts.id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Contract $contract) => self::listDetails($contract)),
        ]);
    }

    /**
     * Show the form for a new contract, with the client preselected when coming from one.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);

        return Inertia::render('Contracts/Form', [
            'contract' => null,
            'clientId' => $request->integer('client') ?: null,
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save a new draft contract with its lines and cheque schedule.
     */
    public function store(ContractRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $contract = DB::transaction(function () use ($request, $company) {
            $contract = new Contract($request->safe()->except(self::RELATION_FIELDS));
            $contract->forceFill([
                'company_id' => $company->id,
                'client_id' => $this->clientId($request, $company),
                'contract_number' => Contract::nextNumber($company->id, $request->date('start_date')),
                'status' => 'draft',
            ])->save();

            $this->syncLines($contract, $request->validated('lines'));
            $contract->syncUnitStatuses();
            $this->syncDocuments($contract, $request);
            $contract->syncCheques($request->chequeEntries(), $request->user());

            return $contract;
        });

        return to_route('contracts.show', $contract)->with('success', "Contract {$contract->contract_number} was saved as a draft. Activate it once it is signed.");
    }

    /**
     * Show a contract with its lines, the people staying under it and its invoices.
     */
    public function show(Request $request, Contract $contract): Response
    {
        $this->ensureSameCompany($request, $contract);

        $contract->load([
            'client:id,name,client_type',
            'lines' => fn (HasMany $lines) => $lines->orderBy('id'),
            'lines.property:id,name,code',
            'lines.room:id,room_number,capacity,gender_policy',
            'lines.apartment:id,apartment_number',
            'lines.shop:id,shop_number',
            'renewedFrom:id,contract_number',
            'renewal:id,renewed_from_id,contract_number',
            'documents' => fn (HasMany $documents) => $documents->orderBy('id'),
        ]);
        $stays = $contract->occupancies()
            ->with(['occupant:id,full_name,gender,employee_number', 'bed.room:id,room_number,property_id', 'bed.room.property:id,name'])
            ->orderByRaw('case when check_out_date is null then 0 else 1 end')
            ->orderByDesc('check_in_date')
            ->get();
        $current = $stays->whereNull('check_out_date');
        $invoices = $contract->invoices()->orderByDesc('period_start')->orderByDesc('id')->get();
        $period = $contract->status === 'active' ? $contract->nextBillingPeriod() : null;
        $cheques = $contract->cheques()
            ->with(['replacement:id,replaces_id', 'payment:id,cheque_id,payment_number'])
            ->orderByRaw("case when purpose = 'security_deposit' then 0 else 1 end")
            ->orderBy('sequence')
            ->orderBy('id')
            ->get()
            ->each(fn (Cheque $cheque) => $cheque->setRelation('chequeable', $contract));

        return Inertia::render('Contracts/Show', [
            'currency' => $contract->company->default_currency,
            'contract' => [
                ...self::listDetails($contract),
                'ejariNumber' => $contract->ejari_number,
                'paymentTermsDays' => $contract->payment_terms_days,
                'securityDeposit' => $contract->security_deposit === null ? null : (float) $contract->security_deposit,
                'signedOn' => $contract->signed_on?->toDateString(),
                'terminatedOn' => $contract->terminated_on?->toDateString(),
                'terminationReason' => $contract->termination_reason,
                'notes' => $contract->notes,
                'renewedFrom' => $contract->renewedFrom ? ['id' => $contract->renewedFrom->id, 'number' => $contract->renewedFrom->contract_number] : null,
                'renewal' => $contract->renewal ? ['id' => $contract->renewal->id, 'number' => $contract->renewal->contract_number] : null,
            ],
            'documents' => $contract->documents->map(fn (ContractDocument $document) => self::documentDetails($document)),
            'lines' => $contract->lines->map(fn (ContractLine $line) => [
                ...self::lineDetails($line),
                'staying' => $current->where('contract_line_id', $line->id)->count(),
                'capacity' => $line->bedCapacity(),
                'housesOccupants' => $line->housesOccupants(),
            ]),
            'stays' => $stays->map(fn (Occupancy $stay) => [
                'id' => $stay->id,
                'occupant' => [
                    'id' => $stay->occupant->id,
                    'name' => $stay->occupant->full_name,
                    'gender' => $stay->occupant->gender,
                    'employeeNumber' => $stay->occupant->employee_number,
                ],
                'propertyName' => $stay->bed->room->property->name,
                'roomNumber' => $stay->bed->room->room_number,
                'bedLabel' => $stay->bed->label,
                'checkInDate' => $stay->check_in_date->toDateString(),
                'checkOutDate' => $stay->check_out_date?->toDateString(),
            ]),
            'invoices' => $invoices->map(fn (Invoice $invoice) => InvoiceController::listDetails($invoice)),
            'totals' => [
                'invoiced' => round((float) $invoices->where('status', '!=', 'void')->sum('total'), 2),
                'paid' => round((float) $invoices->where('status', '!=', 'void')->sum('amount_paid'), 2),
            ],
            'nextPeriod' => $period ? ['start' => $period[0]->toDateString(), 'end' => $period[1]->toDateString()] : null,
            'cheques' => $cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque)),
            'banks' => ChequeController::knownBanks($contract->company),
            'chequeStats' => [
                'expected' => $cheques->whereNull('replaces_id')->whereNotIn('status', ['cancelled'])->count(),
                'inHand' => $cheques->whereIn('status', ['received', 'deposited', 'cleared'])->count(),
                'cleared' => (float) $cheques->where('status', 'cleared')->sum('amount'),
                'toDeposit' => $cheques->filter(fn (Cheque $cheque) => $cheque->status === 'received' && $cheque->cheque_date->lte(today()))->count(),
                'toCollect' => $cheques->filter(fn (Cheque $cheque) => $cheque->isDueNow())->count(),
                'bounced' => $cheques->filter(fn (Cheque $cheque) => $cheque->status === 'bounced' && $cheque->replacement === null)->count(),
            ],
            'can' => [
                'edit' => $contract->isEditable(),
                'activate' => $contract->status === 'draft' && $contract->lines->isNotEmpty(),
                'terminate' => $contract->isEditable(),
                'renew' => in_array($contract->status, ['active', 'ended'], true) && $contract->renewal === null,
                'invoice' => $period !== null,
                'checkIn' => $contract->status === 'active' && $contract->lines->contains(fn (ContractLine $line) => $line->housesOccupants()),
                'scheduleCheques' => $contract->isEditable() && $cheques->isEmpty() && $contract->lines->isNotEmpty(),
            ],
        ]);
    }

    /**
     * Show the form for editing a draft or running contract.
     */
    public function edit(Request $request, Contract $contract): Response|RedirectResponse
    {
        $this->ensureSameCompany($request, $contract);

        if (! $contract->isEditable()) {
            return to_route('contracts.show', $contract);
        }

        $contract->load([
            'client',
            'lines' => fn (HasMany $lines) => $lines->withCount('occupancies')->orderBy('id'),
            'documents' => fn (HasMany $documents) => $documents->orderBy('id'),
        ]);

        return Inertia::render('Contracts/Form', [
            'contract' => [
                'id' => $contract->id,
                'contract_number' => $contract->contract_number,
                'status' => $contract->status,
                ...$contract->only(['client_id', 'ejari_number', 'billing_cycle', 'payment_terms_days', 'security_deposit', 'notes']),
                'start_date' => $contract->start_date->toDateString(),
                'end_date' => $contract->end_date->toDateString(),
                'signed_on' => $contract->signed_on?->toDateString(),
                'lines' => $contract->lines->map(fn (ContractLine $line) => [
                    'id' => $line->id,
                    ...$line->only(['unit_type', 'property_id', 'room_id', 'apartment_id', 'shop_id', 'quantity', 'monthly_rate', 'billing_basis', 'vat_rate', 'description']),
                    'start_date' => $line->start_date->toDateString(),
                    'end_date' => $line->end_date->toDateString(),
                    'hasStays' => $line->occupancies_count > 0,
                ]),
                'documents' => $contract->documents->map(fn (ContractDocument $document) => self::documentDetails($document)),
                'client' => $contract->client->only([
                    'id', 'name', 'client_type', 'contact_person_name', 'phone', 'email', 'trade_license_number', 'id_type', 'id_number',
                ]),
                'staying' => $contract->occupancies()->whereNull('check_out_date')->count(),
                'balance' => (float) $contract->invoices()->whereNot('status', 'void')->sum(DB::raw('total - amount_paid')),
                'hasLockedCheques' => $contract->cheques()->whereNotIn('status', Cheque::EDITABLE_STATUSES)->exists(),
                'cheques' => $contract->cheques()->whereNull('replaces_id')->get()->map(fn (Cheque $cheque) => ChequeController::formDetails($cheque)),
            ],
            'clientId' => null,
            ...$this->formOptions($contract->company, $contract),
        ]);
    }

    /**
     * Save changes to a contract, its lines and its cheques.
     *
     * @throws ValidationException When the contract has ended, or a removed line has stays.
     */
    public function update(ContractRequest $request, Contract $contract): RedirectResponse
    {
        if (! $contract->isEditable()) {
            throw ValidationException::withMessages(['status' => 'An ended or terminated contract can no longer be changed.']);
        }

        $rebuilt = DB::transaction(function () use ($request, $contract) {
            $contract->fill($request->safe()->except(self::RELATION_FIELDS));
            $contract->forceFill(['client_id' => $this->clientId($request, $contract->company)])->save();

            $this->syncLines($contract, $request->validated('lines'));
            $contract->syncUnitStatuses();
            $this->syncDocuments($contract, $request);

            return $contract->syncCheques($request->chequeEntries(), $request->user());
        });

        return to_route('contracts.show', $contract)->with('success', $rebuilt
            ? "Contract {$contract->contract_number} was updated."
            : "Contract {$contract->contract_number} was updated. Its cheque schedule was kept because cheques have already been deposited; adjust them on the contract page.");
    }

    /**
     * Put a signed draft into force.
     */
    public function activate(Request $request, Contract $contract): RedirectResponse
    {
        $this->ensureSameCompany($request, $contract);

        $contract->activate();

        return back()->with('success', "Contract {$contract->contract_number} is now active.");
    }

    /**
     * End a contract early; everyone staying under it checks out on the termination date.
     */
    public function terminate(ContractTerminationRequest $request, Contract $contract): RedirectResponse
    {
        $contract->terminate($request->date('terminated_on'), $request->validated('termination_reason'));

        return back()->with('success', "Contract {$contract->contract_number} was terminated.");
    }

    /**
     * Start a draft for the next term, or open the renewal that already exists.
     */
    public function renew(Request $request, Contract $contract): RedirectResponse
    {
        $this->ensureSameCompany($request, $contract);

        if ($contract->renewal) {
            return to_route('contracts.show', $contract->renewal);
        }

        $renewal = $contract->startRenewal();
        $renewal->syncCheques([], $request->user());

        return to_route('contracts.edit', $renewal)
            ->with('success', "Draft renewal {$renewal->contract_number} was created from {$contract->contract_number}. Check the dates and rates, then save.");
    }

    /**
     * A contract as the lists show it.
     *
     * @return array<string, mixed>
     */
    public static function listDetails(Contract $contract): array
    {
        $lines = $contract->lines;

        return [
            'id' => $contract->id,
            'number' => $contract->contract_number,
            'status' => $contract->status,
            'client' => ['id' => $contract->client_id, 'name' => $contract->client?->name, 'type' => $contract->client?->client_type],
            'startDate' => $contract->start_date->toDateString(),
            'endDate' => $contract->end_date->toDateString(),
            'billingCycle' => $contract->billing_cycle,
            'monthlyValue' => $contract->monthlyValue(),
            'units' => [
                'beds' => (int) $lines->where('unit_type', 'bed')->sum('quantity'),
                'rooms' => $lines->where('unit_type', 'room')->count(),
                'apartments' => $lines->where('unit_type', 'apartment')->count(),
                'shops' => $lines->where('unit_type', 'shop')->count(),
            ],
            'staying' => $contract->staying_count,
            'balance' => $contract->balance === null ? null : round((float) $contract->balance, 2),
            'daysLeft' => (int) today()->diffInDays($contract->end_date, false),
        ];
    }

    /**
     * A contract line with a readable name for its unit.
     *
     * @return array<string, mixed>
     */
    public static function lineDetails(ContractLine $line): array
    {
        return [
            'id' => $line->id,
            'unitType' => $line->unit_type,
            'property' => $line->property->only(['id', 'name', 'code']),
            'roomNumber' => $line->room?->room_number,
            'roomId' => $line->room_id,
            'apartmentNumber' => $line->apartment?->apartment_number,
            'apartmentId' => $line->apartment_id,
            'shopNumber' => $line->shop?->shop_number,
            'shopId' => $line->shop_id,
            'quantity' => $line->quantity,
            'monthlyRate' => (float) $line->monthly_rate,
            'monthlyAmount' => round((float) $line->monthly_rate * $line->quantity, 2),
            'billingBasis' => $line->billing_basis,
            'vatRate' => (float) $line->vat_rate,
            'startDate' => $line->start_date->toDateString(),
            'endDate' => $line->end_date->toDateString(),
            'description' => $line->description,
        ];
    }

    /**
     * Create, update and remove lines to match the submitted list. A line
     * that people have stayed under cannot be removed; end it instead.
     *
     * @param  list<array<string, mixed>>  $lines
     *
     * @throws ValidationException When a removed line has stays.
     */
    private function syncLines(Contract $contract, array $lines): void
    {
        $existing = $contract->lines()->withCount('occupancies')->get()->keyBy('id');
        $keptIds = [];

        foreach ($lines as $attributes) {
            $line = $existing->get($attributes['id'] ?? null) ?? new ContractLine;
            $line->fill(collect($attributes)->except('id')->all());
            $line->forceFill(['company_id' => $contract->company_id, 'contract_id' => $contract->id])->save();
            $keptIds[] = $line->id;
        }

        foreach ($existing->except($keptIds) as $removed) {
            if ($removed->occupancies_count > 0) {
                throw ValidationException::withMessages(['lines' => 'A line that people have stayed under cannot be removed. Shorten its end date instead.']);
            }

            $removed->delete();
            $this->releaseUnit($removed);
        }
    }

    /**
     * The chosen client, or a new active client created from the details entered.
     */
    private function clientId(ContractRequest $request, Company $company): int
    {
        if ($request->validated('client_mode') !== 'new') {
            return $request->integer('client_id');
        }

        return $company->clients()->create([...array_filter($request->validated('new_client')), 'status' => 'active'])->id;
    }

    /**
     * Make the contract's documents match the submitted list: listed ones
     * are updated (keeping their file unless a new one is uploaded), new ones
     * are created and any left out are removed.
     */
    private function syncDocuments(Contract $contract, ContractRequest $request): void
    {
        $submitted = collect($request->validated('documents', []));
        $existing = $contract->documents()->get()->keyBy('id');

        $contract->documents()->whereNotIn('id', $submitted->pluck('id')->filter()->all())->delete();

        foreach ($submitted as $index => $input) {
            $attributes = Arr::only($input, ['document_type', 'title', 'document_number', 'issued_on', 'expires_on', 'notes']);
            $file = $request->file("documents.{$index}.file");

            if ($file) {
                $attributes['file_url'] = '/storage/'.$file->store("contracts/{$contract->id}", 'public');
            }

            $document = isset($input['id']) ? $existing->get($input['id']) : null;

            if ($document) {
                $document->update($attributes);
            } elseif ($file) {
                $contract->documents()->create($attributes);
            }
        }
    }

    /**
     * A contract document as the pages show it.
     *
     * @return array<string, mixed>
     */
    public static function documentDetails(ContractDocument $document): array
    {
        return [
            'id' => $document->id,
            ...$document->only(['document_type', 'title', 'document_number', 'notes', 'file_url']),
            'issued_on' => $document->issued_on?->toDateString(),
            'expires_on' => $document->expires_on?->toDateString(),
        ];
    }

    /**
     * An apartment or shop taken off a contract becomes vacant again, unless
     * another live contract still holds it.
     */
    private function releaseUnit(ContractLine $line): void
    {
        $unit = $line->apartment ?? $line->shop;

        if ($unit && in_array($unit->status, ['occupied', 'reserved'], true) && ! $line->unitHeldByAnotherContract()) {
            $unit->update(['status' => 'vacant']);
        }
    }

    /**
     * Clients, and each property's rentable units with their list prices and
     * how much of each other live contracts already hold, for the form.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company, ?Contract $contract = null): array
    {
        $held = ContractLine::query()
            ->where('company_id', $company->id)
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->when($contract, fn (Builder $query) => $query->whereNot('contract_id', $contract->id))
            ->get(['unit_type', 'room_id', 'apartment_id', 'shop_id', 'quantity']);
        $heldBeds = $held->where('unit_type', 'bed')->whereNotNull('room_id')->groupBy('room_id')->map->sum('quantity');
        $heldRooms = $held->where('unit_type', 'room')->pluck('room_id')->flip();
        $heldApartments = $held->whereNotNull('apartment_id')->pluck('apartment_id')->flip();
        $heldShops = $held->whereNotNull('shop_id')->pluck('shop_id')->flip();

        return [
            'clientTypes' => Client::TYPES,
            'idTypes' => Client::ID_TYPES,
            'documentTypes' => ContractDocument::TYPES,
            'currency' => $company->default_currency,
            'clients' => $company->clients()->where('status', 'active')->orderBy('name')->get(['id', 'name', 'client_type']),
            'properties' => $company->properties()
                ->with([
                    'rooms' => fn (HasMany $rooms) => $rooms->orderBy('room_number'),
                    'rooms.roomType:id,name,slug',
                    'apartments' => fn (HasMany $apartments) => $apartments->orderBy('apartment_number'),
                    'shops' => fn (HasMany $shops) => $shops->orderBy('shop_number'),
                ])
                ->orderBy('name')
                ->get()
                ->map(fn (Property $property) => [
                    'id' => $property->id,
                    'name' => $property->name,
                    'code' => $property->code,
                    'rooms' => $property->rooms->map(fn (Room $room) => [
                        'id' => $room->id,
                        'number' => $room->room_number,
                        'capacity' => $room->capacity,
                        'occupied' => $room->occupied_count,
                        'rate' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
                        'genderPolicy' => $room->gender_policy,
                        'status' => $room->status,
                        'type' => $room->roomType?->only(['name', 'slug']),
                        'contracted' => $heldRooms->has($room->id) ? $room->capacity : min($room->capacity, (int) $heldBeds->get($room->id, 0)),
                    ]),
                    'apartments' => $property->apartments->map(fn (Apartment $apartment) => [
                        'id' => $apartment->id,
                        'number' => $apartment->apartment_number,
                        'rate' => $apartment->monthly_rent === null ? null : (float) $apartment->monthly_rent,
                        'status' => $apartment->status,
                        'bedrooms' => $apartment->bedrooms,
                        'held' => $heldApartments->has($apartment->id),
                    ]),
                    'shops' => $property->shops->map(fn (Shop $shop) => [
                        'id' => $shop->id,
                        'number' => $shop->shop_number,
                        'rate' => $shop->monthly_rent === null ? null : (float) $shop->monthly_rent,
                        'status' => $shop->status,
                        'held' => $heldShops->has($shop->id),
                    ]),
                ]),
            'billingCycles' => array_keys(Contract::BILLING_CYCLES),
            'banks' => ChequeController::knownBanks($company),
            'unitTypes' => ContractLine::UNIT_TYPES,
            'billingBases' => ContractLine::BILLING_BASES,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<Contract, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->contracts()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('contracts.contract_number', "%{$search}%")
                ->orWhereLike('contracts.ejari_number', "%{$search}%")
                ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('contracts.status', $filters['status']))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query
                ->whereHas('client', fn (Builder $clients) => $clients->whereIn('client_type', $filters['types'])));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $active = $company->contracts()->where('status', 'active')->with('lines.room:id,capacity')->get();

        return [
            'active' => $active->count(),
            'drafts' => $company->contracts()->where('status', 'draft')->count(),
            'monthlyValue' => round($active->sum(fn (Contract $contract) => $contract->monthlyValue()), 2),
            'contractedBeds' => (int) $active->sum(fn (Contract $contract) => $contract->lines
                ->filter(fn (ContractLine $line) => $line->covers(today()))
                ->sum(fn (ContractLine $line) => $line->bedCapacity())),
            'staying' => $company->occupancies()->whereNull('check_out_date')->count(),
            'expiringSoon' => $active->filter(fn (Contract $contract) => $contract->end_date->lte(today()->addDays(60)))->count(),
        ];
    }
}
