<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\ClientRequest;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Invoice;
use App\Models\Occupancy;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    use ListsRecords;

    /**
     * List the company's clients with their contracts, people housed and balance.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Clients/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['types' => Client::TYPES, 'status' => Client::STATUSES]);

        return Inertia::render('Clients/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'types' => $this->facetOptions(Client::TYPES, $this->countBy($this->filteredQuery($company, $filters, except: 'types'), 'client_type')),
                'status' => $this->facetOptions(Client::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
            ],
            'summary' => $this->summary($company),
            'clients' => $this->filteredQuery($company, $filters)
                ->withCount([
                    'contracts as active_contracts_count' => fn (Builder $contracts) => $contracts->where('status', 'active'),
                    'occupants as staying_count' => fn (Builder $occupants) => $occupants->whereHas('currentStay'),
                ])
                ->withSum(['invoices as balance' => fn (Builder $invoices) => $invoices->whereNot('status', 'void')], DB::raw('total - amount_paid'))
                ->orderBy('name')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Client $client) => [
                    'id' => $client->id,
                    'name' => $client->name,
                    'type' => $client->client_type,
                    'status' => $client->status,
                    'contactPerson' => $client->contact_person_name,
                    'phone' => $client->phone,
                    'email' => $client->email,
                    'activeContracts' => $client->active_contracts_count,
                    'staying' => $client->staying_count,
                    'balance' => round((float) $client->balance, 2),
                ]),
        ]);
    }

    /**
     * Show the form for adding a client.
     */
    public function create(Request $request): Response
    {
        $this->currentCompany($request);

        return Inertia::render('Clients/Form', ['client' => null, ...$this->formOptions()]);
    }

    /**
     * Save a new client.
     */
    public function store(ClientRequest $request): RedirectResponse
    {
        $client = $this->currentCompany($request)->clients()->create($request->clientAttributes());

        return to_route('clients.show', $client)->with('success', "{$client->name} was added.");
    }

    /**
     * Show a client with their contracts, the people staying for them, and
     * their invoices and payments.
     */
    public function show(Request $request, Client $client): Response
    {
        $this->ensureSameCompany($request, $client);

        $contracts = $client->contracts()
            ->with('lines.room:id,capacity')
            ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $stays->whereNull('check_out_date')])
            ->withSum(['invoices as balance' => fn (Builder $invoices) => $invoices->whereNot('status', 'void')], DB::raw('total - amount_paid'))
            ->orderByDesc('start_date')
            ->get()
            ->each(fn (Contract $contract) => $contract->setRelation('client', $client));
        $stays = Occupancy::query()
            ->whereNull('check_out_date')
            ->whereHas('occupant', fn (Builder $occupants) => $occupants->where('client_id', $client->id))
            ->with(['occupant:id,full_name,employee_number', 'bed.room.property:id,name,code', 'contractLine.contract:id,contract_number'])
            ->orderBy('check_in_date')
            ->get();
        $invoices = $client->invoices()->with('contract:id,contract_number')->orderByDesc('issue_date')->orderByDesc('id')->limit(12)->get();
        $payments = $client->payments()->orderByDesc('received_on')->orderByDesc('id')->limit(8)->get();
        $holdings = ContractLine::query()
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->where('client_id', $client->id)->whereIn('status', ['draft', 'active']))
            ->with(['property:id,name,code', 'room:id,room_number,capacity', 'apartment:id,apartment_number', 'shop:id,shop_number', 'contract:id,contract_number,status'])
            ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $stays->whereNull('check_out_date')])
            ->orderBy('property_id')
            ->orderBy('id')
            ->get();
        $documents = ContractDocument::query()
            ->whereHas('contract', fn (Builder $contracts) => $contracts->where('client_id', $client->id))
            ->with('contract:id,contract_number')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Clients/Show', [
            'currency' => $client->company->default_currency,
            'client' => [
                'id' => $client->id,
                ...$client->only([
                    'name', 'client_type', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'tax_registration_number',
                    'id_type', 'id_number', 'nationality', 'address', 'status', 'notes',
                ]),
                'balance' => $client->outstandingBalance(),
                'occupants' => $client->occupants()->count(),
            ],
            'contracts' => $contracts->map(fn (Contract $contract) => ContractController::listDetails($contract)),
            'holdings' => $holdings->map(fn (ContractLine $line) => [
                ...ContractController::lineDetails($line),
                'capacity' => $line->bedCapacity(),
                'staying' => $line->staying_count,
                'housesOccupants' => $line->housesOccupants(),
                'contract' => ['id' => $line->contract->id, 'number' => $line->contract->contract_number, 'status' => $line->contract->status],
            ]),
            'documents' => $documents->map(fn (ContractDocument $document) => [
                ...ContractController::documentDetails($document),
                'contract' => ['id' => $document->contract->id, 'number' => $document->contract->contract_number],
            ]),
            'stays' => $stays->map(fn (Occupancy $stay) => [
                'id' => $stay->id,
                'occupant' => ['id' => $stay->occupant->id, 'name' => $stay->occupant->full_name, 'employeeNumber' => $stay->occupant->employee_number],
                'property' => $stay->bed->room->property->only(['id', 'name', 'code']),
                'roomNumber' => $stay->bed->room->room_number,
                'bedLabel' => $stay->bed->label,
                'contractNumber' => $stay->contractLine->contract->contract_number,
                'checkInDate' => $stay->check_in_date->toDateString(),
            ]),
            'invoices' => $invoices->map(fn (Invoice $invoice) => InvoiceController::listDetails($invoice)),
            'payments' => $payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'number' => $payment->payment_number,
                'receivedOn' => $payment->received_on->toDateString(),
                'method' => $payment->method,
                'status' => $payment->status,
                'amount' => (float) $payment->amount,
            ]),
        ]);
    }

    /**
     * Show the form for editing a client.
     */
    public function edit(Request $request, Client $client): Response
    {
        $this->ensureSameCompany($request, $client);

        return Inertia::render('Clients/Form', [
            'client' => [
                'id' => $client->id,
                ...$client->only([
                    'client_type', 'name', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'tax_registration_number',
                    'id_type', 'id_number', 'nationality', 'address', 'status', 'notes',
                ]),
            ],
            ...$this->formOptions(),
        ]);
    }

    /**
     * Save changes to a client.
     */
    public function update(ClientRequest $request, Client $client): RedirectResponse
    {
        $client->update($request->clientAttributes());

        return to_route('clients.show', $client)->with('success', "{$client->name} was updated.");
    }

    /**
     * @return array<string, list<string>>
     */
    private function formOptions(): array
    {
        return ['types' => Client::TYPES, 'statuses' => Client::STATUSES, 'idTypes' => Client::ID_TYPES];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<Client, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->clients()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('contact_person_name', "%{$search}%")
                ->orWhereLike('email', "%{$search}%")
                ->orWhereLike('phone', "%{$search}%")
                ->orWhereLike('trade_license_number', "%{$search}%")
                ->orWhereLike('id_number', "%{$search}%")))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query->whereIn('client_type', $filters['types']))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $openInvoices = fn () => $company->invoices()->whereNot('status', 'void')->whereColumn('amount_paid', '<', 'total');

        return [
            'clients' => $company->clients()->count(),
            'companies' => $company->clients()->where('client_type', 'company')->count(),
            'individuals' => $company->clients()->where('client_type', 'individual')->count(),
            'activeContracts' => $company->contracts()->where('status', 'active')->count(),
            'staying' => $company->occupancies()->whereNull('check_out_date')->count(),
            'receivable' => round((float) $openInvoices()->sum(DB::raw('total - amount_paid')), 2),
            'overdue' => round((float) $openInvoices()->whereDate('due_date', '<', today())->sum(DB::raw('total - amount_paid')), 2),
        ];
    }
}
