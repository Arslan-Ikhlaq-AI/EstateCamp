<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\HeadLeaseRequest;
use App\Models\Company;
use App\Models\HeadLease;
use App\Models\HeadLeasePayment;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class HeadLeaseController extends Controller
{
    use ListsRecords;

    /**
     * List the company's head leases with what has been paid and what is due next.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('HeadLeases/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['status' => HeadLease::STATUSES, 'properties' => null]);
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, except: 'properties'), 'property_id');

        return Inertia::render('HeadLeases/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(HeadLease::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
                'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                    ->map(fn (Property $property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])
                    ->all(),
            ],
            'summary' => $this->summary($company),
            'leases' => $this->filteredQuery($company, $filters)
                ->with(['property:id,name,code', 'landlord:id,name'])
                ->withSum(['payments as paid_amount' => fn (Builder $payments) => $payments->where('status', 'paid')], 'amount')
                ->withMin(['payments as next_due_date' => fn (Builder $payments) => $payments->where('status', 'scheduled')], 'due_date')
                ->orderByDesc('start_date')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (HeadLease $lease) => [
                    ...$this->leaseDetails($lease),
                    'paidAmount' => (float) $lease->paid_amount,
                    'nextDueDate' => $lease->next_due_date ? substr($lease->next_due_date, 0, 10) : null,
                ]),
        ]);
    }

    /**
     * Show the form for adding a head lease. `?renew=<id>` starts a renewal
     * of that lease: the same property, landlord and terms for the next term.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $lease = null;
        $renewing = $request->integer('renew') ? $company->headLeases()->find($request->integer('renew')) : null;

        if ($renewing) {
            $termMonths = max(1, (int) round($renewing->start_date->floatDiffInMonths($renewing->end_date->copy()->addDay())));
            $start = $renewing->end_date->copy()->addDay();

            $lease = [
                ...$renewing->only(['property_id', 'landlord_id', 'annual_rent', 'payments_per_year', 'security_deposit', 'notice_period_days']),
                'renewed_from_id' => $renewing->id,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addMonthsNoOverflow($termMonths)->subDay()->toDateString(),
                'status' => 'draft',
            ];
        }

        return Inertia::render('HeadLeases/Form', [
            'lease' => null,
            'prefill' => $lease ?? [
                'property_id' => $request->integer('property') ?: null,
                'landlord_id' => $request->integer('landlord') ?: null,
            ],
            'renewing' => $renewing ? ['id' => $renewing->id, 'number' => $renewing->lease_number] : null,
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save a new head lease and build its payment schedule.
     */
    public function store(HeadLeaseRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $lease = DB::transaction(function () use ($request, $company) {
            $lease = new HeadLease($request->safe()->except(['property_id', 'landlord_id', 'renewed_from_id']));
            $lease->forceFill([
                ...$request->safe()->only(['property_id', 'landlord_id', 'renewed_from_id']),
                'company_id' => $company->id,
                'lease_number' => HeadLease::nextNumber($company->id, $request->date('start_date')),
            ])->save();

            $lease->rebuildSchedule();
            $lease->syncPropertyLease();

            return $lease;
        });

        return to_route('head-leases.show', $lease)
            ->with('success', "Lease {$lease->lease_number} was added with {$lease->payments()->count()} scheduled payments.");
    }

    /**
     * Show a head lease with its payment schedule.
     */
    public function show(Request $request, HeadLease $headLease): Response
    {
        $this->ensureSameCompany($request, $headLease);

        $headLease->load([
            'property:id,name,code',
            'landlord',
            'payments' => fn (HasMany $payments) => $payments->orderBy('installment_number'),
            'renewedFrom:id,lease_number',
            'renewal:id,renewed_from_id,lease_number',
        ]);
        $payments = $headLease->payments->each(fn (HeadLeasePayment $payment) => $payment->setRelation('headLease', $headLease));
        $scheduled = $payments->where('status', 'scheduled');
        $next = $scheduled->sortBy('due_date')->first();

        return Inertia::render('HeadLeases/Show', [
            'currency' => $headLease->company->default_currency,
            'lease' => [
                ...$this->leaseDetails($headLease),
                'securityDeposit' => $headLease->security_deposit === null ? null : (float) $headLease->security_deposit,
                'noticePeriodDays' => $headLease->notice_period_days,
                'notes' => $headLease->notes,
                'landlord' => [
                    ...$headLease->landlord->only(['id', 'name', 'phone', 'email', 'bank_name', 'iban']),
                ],
                'renewedFrom' => $headLease->renewedFrom ? ['id' => $headLease->renewedFrom->id, 'number' => $headLease->renewedFrom->lease_number] : null,
                'renewal' => $headLease->renewal ? ['id' => $headLease->renewal->id, 'number' => $headLease->renewal->lease_number] : null,
            ],
            'stats' => [
                'paid' => (float) $payments->where('status', 'paid')->sum('amount'),
                'outstanding' => (float) $scheduled->sum('amount'),
                'overdue' => $scheduled->filter(fn (HeadLeasePayment $payment) => $payment->isOverdue())->count(),
                'nextPayment' => $next ? ['dueDate' => $next->due_date->toDateString(), 'amount' => (float) $next->amount] : null,
            ],
            'payments' => $payments->map(fn (HeadLeasePayment $payment) => LandlordPaymentController::paymentDetails($payment)),
            'paymentStatuses' => HeadLeasePayment::STATUSES,
            'paymentMethods' => HeadLeasePayment::METHODS,
        ]);
    }

    /**
     * Show the form for editing a head lease.
     */
    public function edit(Request $request, HeadLease $headLease): Response
    {
        $this->ensureSameCompany($request, $headLease);

        return Inertia::render('HeadLeases/Form', [
            'lease' => [
                'id' => $headLease->id,
                'lease_number' => $headLease->lease_number,
                ...$headLease->only([
                    'property_id', 'landlord_id', 'renewed_from_id', 'ejari_number', 'annual_rent', 'payments_per_year',
                    'security_deposit', 'notice_period_days', 'status', 'notes',
                ]),
                'start_date' => $headLease->start_date->toDateString(),
                'end_date' => $headLease->end_date->toDateString(),
                'hasRecordedPayments' => $headLease->payments()->whereNot('status', 'scheduled')->exists(),
            ],
            'prefill' => null,
            'renewing' => null,
            ...$this->formOptions($headLease->company),
        ]);
    }

    /**
     * Save changes to a head lease. Changed financial terms rebuild the
     * schedule, unless cheques have already been recorded against it.
     */
    public function update(HeadLeaseRequest $request, HeadLease $headLease): RedirectResponse
    {
        $rebuilt = DB::transaction(function () use ($request, $headLease) {
            $headLease->fill($request->safe()->except(['property_id', 'landlord_id', 'renewed_from_id']));
            $headLease->forceFill($request->safe()->only(['property_id', 'landlord_id', 'renewed_from_id']))->save();

            $rebuilt = $headLease->wasChanged(['start_date', 'end_date', 'annual_rent', 'payments_per_year'])
                ? $headLease->rebuildSchedule()
                : null;

            $headLease->syncPropertyLease();

            return $rebuilt;
        });

        $message = match ($rebuilt) {
            true => "Lease {$headLease->lease_number} was updated and its payment schedule rebuilt.",
            false => "Lease {$headLease->lease_number} was updated. Its payment schedule was kept because payments are already recorded; adjust the instalments by hand.",
            null => "Lease {$headLease->lease_number} was updated.",
        };

        return to_route('head-leases.show', $headLease)->with('success', $message);
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code', 'ownership_type']),
            'landlords' => $company->landlords()->orderBy('name')->get(['id', 'name']),
            'statuses' => HeadLease::STATUSES,
            'paymentsPerYear' => HeadLease::PAYMENTS_PER_YEAR,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<HeadLease, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->headLeases()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('lease_number', "%{$search}%")
                ->orWhereLike('ejari_number', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))
                ->orWhereHas('landlord', fn (Builder $landlords) => $landlords->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $active = fn () => $company->headLeases()->where('status', 'active');
        $scheduled = fn () => $company->headLeasePayments()
            ->where('status', 'scheduled')
            ->whereHas('headLease', fn (Builder $leases) => $leases->where('status', 'active'));
        $next = $scheduled()->with('headLease:id,lease_number')->orderBy('due_date')->first();

        return [
            'activeLeases' => $active()->count(),
            'annualRent' => (float) $active()->sum('annual_rent'),
            'outstanding' => (float) $scheduled()->sum('amount'),
            'overdue' => $scheduled()->whereDate('due_date', '<', today())->count(),
            'nextPayment' => $next ? [
                'dueDate' => $next->due_date->toDateString(),
                'amount' => (float) $next->amount,
                'leaseNumber' => $next->headLease->lease_number,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function leaseDetails(HeadLease $lease): array
    {
        return [
            'id' => $lease->id,
            'number' => $lease->lease_number,
            'ejariNumber' => $lease->ejari_number,
            'property' => $lease->property->only(['id', 'name', 'code']),
            'landlordName' => $lease->landlord->name,
            'landlordId' => $lease->landlord_id,
            'startDate' => $lease->start_date->toDateString(),
            'endDate' => $lease->end_date->toDateString(),
            'annualRent' => (float) $lease->annual_rent,
            'paymentsPerYear' => $lease->payments_per_year,
            'installmentAmount' => round((float) $lease->annual_rent / $lease->payments_per_year, 2),
            'status' => $lease->status,
            'daysLeft' => (int) today()->diffInDays($lease->end_date, false),
        ];
    }
}
