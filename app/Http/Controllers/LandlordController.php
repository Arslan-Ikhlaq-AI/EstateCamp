<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\LandlordRequest;
use App\Models\Company;
use App\Models\HeadLease;
use App\Models\Cheque;
use App\Models\Landlord;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LandlordController extends Controller
{
    use ListsRecords;

    /**
     * List the company's landlords with their running leases.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Landlords/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['types' => Landlord::TYPES]);
        $activeLeases = fn (Builder $leases) => $leases->where('status', 'active');

        return Inertia::render('Landlords/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'types' => $this->facetOptions(Landlord::TYPES, $this->countBy($this->filteredQuery($company, $filters, except: 'types'), 'landlord_type')),
            ],
            'summary' => $this->summary($company),
            'landlords' => $this->filteredQuery($company, $filters)
                ->withCount(['headLeases as active_leases_count' => $activeLeases])
                ->withSum(['headLeases as active_annual_rent' => $activeLeases], 'annual_rent')
                ->orderBy('name')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Landlord $landlord) => [
                    'id' => $landlord->id,
                    'name' => $landlord->name,
                    'type' => $landlord->landlord_type,
                    'contactPerson' => $landlord->contact_person_name,
                    'phone' => $landlord->phone,
                    'email' => $landlord->email,
                    'activeLeases' => $landlord->active_leases_count,
                    'annualRent' => (float) $landlord->active_annual_rent,
                ]),
        ]);
    }

    /**
     * Show the form for adding a landlord.
     */
    public function create(Request $request): Response
    {
        $this->currentCompany($request);

        return Inertia::render('Landlords/Form', ['landlord' => null, 'types' => Landlord::TYPES]);
    }

    /**
     * Save a new landlord.
     */
    public function store(LandlordRequest $request): RedirectResponse
    {
        $landlord = $this->currentCompany($request)->landlords()->create($request->validated());

        return to_route('landlords.show', $landlord)->with('success', "{$landlord->name} was added.");
    }

    /**
     * Show a landlord with their leases and the next cheques due to them.
     */
    public function show(Request $request, Landlord $landlord): Response
    {
        $this->ensureSameCompany($request, $landlord);

        $leases = $landlord->headLeases()->with('property:id,name,code')->orderByDesc('start_date')->get();

        $cheques = fn () => Cheque::query()
            ->where('chequeable_type', (new HeadLease)->getMorphClass())
            ->whereIn('chequeable_id', $leases->modelKeys());
        $upcoming = $cheques()
            ->whereIn('status', ['pending', 'issued'])
            ->with(ChequeController::detailRelations())
            ->orderBy('cheque_date')
            ->limit(8)
            ->get();

        return Inertia::render('Landlords/Show', [
            'currency' => $landlord->company->default_currency,
            'landlord' => [
                'id' => $landlord->id,
                ...$landlord->only([
                    'name', 'landlord_type', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'id_number',
                    'tax_registration_number', 'bank_name', 'account_name', 'iban', 'address', 'notes',
                ]),
            ],
            'leases' => $leases->map(fn (HeadLease $lease) => [
                'id' => $lease->id,
                'number' => $lease->lease_number,
                'property' => $lease->property->only(['id', 'name', 'code']),
                'startDate' => $lease->start_date->toDateString(),
                'endDate' => $lease->end_date->toDateString(),
                'annualRent' => (float) $lease->annual_rent,
                'status' => $lease->status,
            ]),
            'upcomingCheques' => $upcoming->map(fn (Cheque $cheque) => ChequeController::details($cheque)),
            'chequeTotals' => [
                'paidThisYear' => round((float) $cheques()->where('status', 'cleared')->whereYear('cleared_on', today()->year)->sum('amount'), 2),
                'toPay' => round((float) $cheques()->whereIn('status', ['pending', 'issued'])->sum('amount'), 2),
                'toWrite' => $cheques()->where('status', 'pending')->whereDate('cheque_date', '<=', today()->addDays(30))->count(),
                'bounced' => $cheques()->where('status', 'bounced')->whereDoesntHave('replacement')->count(),
            ],
        ]);
    }

    /**
     * Show the form for editing a landlord.
     */
    public function edit(Request $request, Landlord $landlord): Response
    {
        $this->ensureSameCompany($request, $landlord);

        return Inertia::render('Landlords/Form', [
            'landlord' => [
                'id' => $landlord->id,
                ...$landlord->only([
                    'landlord_type', 'name', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'id_number',
                    'tax_registration_number', 'bank_name', 'account_name', 'iban', 'address', 'notes',
                ]),
            ],
            'types' => Landlord::TYPES,
        ]);
    }

    /**
     * Save changes to a landlord.
     */
    public function update(LandlordRequest $request, Landlord $landlord): RedirectResponse
    {
        $landlord->update($request->validated());

        return to_route('landlords.show', $landlord)->with('success', "{$landlord->name} was updated.");
    }

    /**
     * The company's landlords narrowed by the search and filters, leaving out
     * the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Landlord, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->landlords()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('contact_person_name', "%{$search}%")
                ->orWhereLike('email', "%{$search}%")
                ->orWhereLike('phone', "%{$search}%")))
            ->when($except !== 'types' && $filters['types'] !== [], fn (Builder $query) => $query->whereIn('landlord_type', $filters['types']));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $activeLeases = $company->headLeases()->where('status', 'active');
        $nextPayment = $company->cheques()
            ->where('direction', 'issued')
            ->whereIn('status', ['pending', 'issued'])
            ->whereHasMorph('chequeable', [HeadLease::class], fn (Builder $leases) => $leases->where('status', 'active'))
            ->with('chequeable.landlord:id,name')
            ->orderBy('cheque_date')
            ->first();

        return [
            'landlords' => $company->landlords()->count(),
            'activeLeases' => (clone $activeLeases)->count(),
            'annualRent' => (float) (clone $activeLeases)->sum('annual_rent'),
            'nextPayment' => $nextPayment ? [
                'dueDate' => $nextPayment->cheque_date->toDateString(),
                'amount' => (float) $nextPayment->amount,
                'landlord' => $nextPayment->chequeable->landlord->name,
            ] : null,
        ];
    }
}
