<?php

namespace App\Http\Controllers;

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Every client renting in a property, with their contracts there: each
 * contract's terms, the rooms, shops and apartments it holds here, its
 * documents and every cheque with where it stands.
 */
class TenantContractController extends Controller
{
    /**
     * The stages a client's cheque moves through, in order.
     */
    private const CHEQUE_STAGES = ['pending', 'received', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled'];

    /**
     * Show the property's clients, each with their contracts (running and
     * draft ones first, then past ones), and figures for the property as a
     * whole. What a contract rents, its monthly value and the people staying
     * count this property only; its cheques, documents and invoices cover
     * the whole contract.
     */
    public function show(Request $request, Property $property): Response
    {
        $this->ensureSameCompany($request, $property);

        $property->load(['company:id,default_currency', 'propertyType:id,name,slug']);
        $here = fn (Builder|HasMany $lines) => $lines->where('contract_lines.property_id', $property->id);
        $contracts = Contract::query()
            ->whereHas('lines', $here)
            ->with([
                'client' => fn (BelongsTo $client) => $client->withTrashed(),
                'lines' => fn (HasMany $lines) => $here($lines)
                    ->with(['property:id,name,code', 'room:id,room_number,capacity', 'apartment:id,apartment_number', 'shop:id,shop_number'])
                    ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $stays->whereNull('check_out_date')])
                    ->orderBy('id'),
                'documents' => fn (HasMany $documents) => $documents->orderBy('id'),
                'renewedFrom:id,contract_number',
                'cheques' => fn (MorphMany $cheques) => $cheques
                    ->with([
                        'chequeStatus:id,name,slug,color,stage',
                        'replacement:id,replaces_id',
                        'payment:id,cheque_id,payment_number',
                        'rentalPayment:id,cheque_id,receipt_number,status',
                        ...ChequeController::historyRelations(),
                    ])
                    ->orderByRaw("case when purpose = 'security_deposit' then 0 else 1 end")
                    ->orderBy('sequence')
                    ->orderBy('id'),
            ])
            ->withCount(['occupancies as staying_count' => fn (Builder $stays) => $here($stays->whereNull('check_out_date'))])
            ->withSum(['invoices as invoiced' => fn (Builder $invoices) => $invoices->whereNot('status', 'void')], 'total')
            ->withSum(['invoices as balance' => fn (Builder $invoices) => $invoices->whereNot('status', 'void')], DB::raw('total - amount_paid'))
            ->orderByRaw("case status when 'active' then 0 when 'draft' then 1 else 2 end")
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get()
            ->each(fn (Contract $contract) => $contract->cheques->each(fn (Cheque $cheque) => $cheque->setRelation('chequeable', $contract)));
        $otherProperties = ContractLine::query()
            ->whereIn('contract_id', $contracts->modelKeys())
            ->where('property_id', '!=', $property->id)
            ->toBase()
            ->groupBy('contract_id')
            ->selectRaw('contract_id, count(distinct property_id) as properties')
            ->pluck('properties', 'contract_id');
        $live = $contracts->filter(fn (Contract $contract) => $contract->isEditable());

        return Inertia::render('Properties/TenantContracts', [
            'currency' => $property->company->default_currency,
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'code' => $property->code,
                'type' => $property->propertyType?->name,
                'typeSlug' => $property->propertyType?->slug,
                'area' => $property->area,
                'city' => $property->city,
            ],
            'clients' => $contracts
                ->groupBy('client_id')
                ->map(fn (Collection $clientContracts) => $this->clientDetails($clientContracts, $otherProperties))
                ->sortBy([['liveContracts', 'desc'], ['monthly', 'desc'], ['name', 'asc']])
                ->values()
                ->all(),
            'summary' => [
                'clients' => $live->pluck('client_id')->unique()->count(),
                'contracts' => array_combine(Contract::STATUSES, array_map(fn (string $status) => $contracts->where('status', $status)->count(), Contract::STATUSES)),
                'units' => $this->unitTotals($this->heldLines($live)),
                'monthly' => round($live->sum(fn (Contract $contract) => $contract->monthlyValue()), 2),
                'deposits' => round((float) $live->sum('security_deposit'), 2),
                'invoiced' => round((float) $contracts->sum('invoiced'), 2),
                'balance' => round((float) $contracts->sum('balance'), 2),
                'cheques' => $this->chequeSummary($contracts->flatMap->cheques),
            ],
            'chequeStatuses' => ChequeController::statusOptions(),
            'banks' => ChequeController::knownBanks($property->company),
        ]);
    }

    /**
     * A client with how to reach them, what their running and draft
     * contracts hold here now, and each of their contracts in full.
     *
     * @param  Collection<int, Contract>  $contracts
     * @param  Collection<int, int>  $otherProperties
     * @return array<string, mixed>
     */
    private function clientDetails(Collection $contracts, Collection $otherProperties): array
    {
        /** @var Client $client */
        $client = $contracts->first()->client;
        $live = $contracts->filter(fn (Contract $contract) => $contract->isEditable());

        return [
            'id' => $client->id,
            'name' => $client->name,
            'type' => $client->client_type,
            'status' => $client->status,
            'contactPerson' => $client->contact_person_name,
            'phone' => $client->phone,
            'email' => $client->email,
            'tradeLicenseNumber' => $client->trade_license_number,
            'taxRegistrationNumber' => $client->tax_registration_number,
            'idType' => $client->id_type,
            'idNumber' => $client->id_number,
            'nationality' => $client->nationality,
            'address' => $client->address,
            'liveContracts' => $live->count(),
            'units' => $this->unitTotals($this->heldLines($live)),
            'monthly' => round($live->sum(fn (Contract $contract) => $contract->monthlyValue()), 2),
            'balance' => round((float) $contracts->sum('balance'), 2),
            'contracts' => $contracts->map(fn (Contract $contract) => $this->contractDetails($contract, (int) $otherProperties->get($contract->id, 0)))->values()->all(),
        ];
    }

    /**
     * A contract with its terms, the units it rents here, its documents and
     * its cheques. `otherProperties` counts the other properties it rents in.
     *
     * @return array<string, mixed>
     */
    private function contractDetails(Contract $contract, int $otherProperties): array
    {
        return [
            ...ContractController::listDetails($contract),
            'ejariNumber' => $contract->ejari_number,
            'paymentTermsDays' => $contract->payment_terms_days,
            'securityDeposit' => $contract->security_deposit === null ? null : (float) $contract->security_deposit,
            'signedOn' => $contract->signed_on?->toDateString(),
            'terminatedOn' => $contract->terminated_on?->toDateString(),
            'terminationReason' => $contract->termination_reason,
            'notes' => $contract->notes,
            'renewedFrom' => $contract->renewedFrom ? ['id' => $contract->renewedFrom->id, 'number' => $contract->renewedFrom->contract_number] : null,
            'otherProperties' => $otherProperties,
            'holds' => $this->unitTotals($contract->lines),
            'invoiced' => round((float) $contract->invoiced, 2),
            'lines' => $contract->lines->map(fn (ContractLine $line) => [
                ...ContractController::lineDetails($line),
                'capacity' => $line->bedCapacity(),
                'staying' => $line->staying_count,
                'housesOccupants' => $line->housesOccupants(),
            ])->all(),
            'documents' => $contract->documents->map(fn (ContractDocument $document) => ContractController::documentDetails($document))->all(),
            'cheques' => $contract->cheques->map(fn (Cheque $cheque) => ChequeController::details($cheque))->all(),
            'chequeSummary' => $this->chequeSummary($contract->cheques),
        ];
    }

    /**
     * The lines of running and draft contracts that have not ended yet: what
     * the clients hold now or have booked.
     *
     * @param  Collection<int, Contract>  $contracts
     * @return Collection<int, ContractLine>
     */
    private function heldLines(Collection $contracts): Collection
    {
        return $contracts->flatMap->lines->filter(fn (ContractLine $line) => $line->end_date->gte(today()))->values();
    }

    /**
     * How many rooms, beds, shops and apartments the lines rent. A room
     * counts once, whether taken whole or a few beds at a time.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return array{rooms: int, beds: int, shops: int, apartments: int}
     */
    private function unitTotals(Collection $lines): array
    {
        return [
            'rooms' => $lines->whereIn('unit_type', ['bed', 'room'])->pluck('room_id')->filter()->unique()->count(),
            'beds' => (int) $lines->sum(fn (ContractLine $line) => $line->bedCapacity()),
            'shops' => $lines->where('unit_type', 'shop')->count(),
            'apartments' => $lines->where('unit_type', 'apartment')->count(),
        ];
    }

    /**
     * How many cheques are at each stage and what they come to, and those
     * past their date but not yet collected or deposited.
     *
     * @param  Collection<int, Cheque>  $cheques
     * @return array{stages: array<string, array{count: int, amount: float}>, overdue: array{count: int, amount: float}}
     */
    private function chequeSummary(Collection $cheques): array
    {
        $figures = fn (Collection $some) => ['count' => $some->count(), 'amount' => round((float) $some->sum('amount'), 2)];

        return [
            'stages' => array_combine(self::CHEQUE_STAGES, array_map(fn (string $stage) => $figures($cheques->where('status', $stage)), self::CHEQUE_STAGES)),
            'overdue' => $figures($cheques->filter(fn (Cheque $cheque) => $cheque->isOverdue())),
        ];
    }
}
