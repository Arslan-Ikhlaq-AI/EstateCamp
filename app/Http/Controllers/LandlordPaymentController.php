<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\LandlordPaymentRequest;
use App\Models\Company;
use App\Models\HeadLeasePayment;
use App\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The instalments the company owes its landlords, across every head lease.
 */
class LandlordPaymentController extends Controller
{
    use ListsRecords;

    /**
     * List the instalments: those still to pay first, soonest due on top.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('LandlordPayments/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['status' => HeadLeasePayment::STATUSES, 'due' => ['overdue', 'next_30_days'], 'properties' => null]);
        $propertyCounts = $this->filteredQuery($company, $filters, except: 'properties')
            ->join('head_leases', 'head_leases.id', '=', 'head_lease_payments.head_lease_id')
            ->toBase()
            ->groupBy('head_leases.property_id')
            ->selectRaw('head_leases.property_id as value, count(*) as aggregate')
            ->pluck('aggregate', 'value');
        $dueQuery = fn () => $this->filteredQuery($company, $filters, except: 'due')->where('status', 'scheduled');

        return Inertia::render('LandlordPayments/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(HeadLeasePayment::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
                'due' => [
                    ['value' => 'overdue', 'count' => $dueQuery()->whereDate('due_date', '<', today())->count()],
                    ['value' => 'next_30_days', 'count' => $dueQuery()->whereBetween('due_date', [today(), today()->addDays(30)])->count()],
                ],
                'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code'])
                    ->map(fn (Property $property) => ['value' => $property->code, 'label' => $property->name, 'count' => (int) $propertyCounts->get($property->id, 0)])
                    ->all(),
            ],
            'summary' => $this->summary($company),
            'payments' => $this->filteredQuery($company, $filters)
                ->with(['headLease:id,lease_number,property_id,landlord_id', 'headLease.property:id,name,code', 'headLease.landlord:id,name'])
                ->orderByRaw("case when status = 'scheduled' then 0 else 1 end")
                ->orderBy('due_date')
                ->orderBy('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (HeadLeasePayment $payment) => self::paymentDetails($payment)),
            'paymentStatuses' => HeadLeasePayment::STATUSES,
            'paymentMethods' => HeadLeasePayment::METHODS,
        ]);
    }

    /**
     * Record what happened to one instalment: paid, bounced, cancelled, or back to scheduled.
     */
    public function update(LandlordPaymentRequest $request, HeadLeasePayment $headLeasePayment): RedirectResponse
    {
        $attributes = $request->validated();

        if ($attributes['status'] !== 'paid') {
            $attributes['paid_on'] = null;
        }

        $headLeasePayment->update($attributes);

        $lease = $headLeasePayment->headLease;

        return back()->with('success', "Instalment {$headLeasePayment->installment_number} of {$lease->lease_number} is now {$this->statusWord($headLeasePayment->status)}.");
    }

    /**
     * One instalment as the lease and landlord-payment pages show it.
     *
     * @return array<string, mixed>
     */
    public static function paymentDetails(HeadLeasePayment $payment): array
    {
        $lease = $payment->headLease;

        return [
            'id' => $payment->id,
            'installmentNumber' => $payment->installment_number,
            'dueDate' => $payment->due_date->toDateString(),
            'amount' => (float) $payment->amount,
            'status' => $payment->status,
            'isOverdue' => $payment->isOverdue(),
            'paidOn' => $payment->paid_on?->toDateString(),
            'method' => $payment->payment_method,
            'chequeNumber' => $payment->cheque_number,
            'bankName' => $payment->bank_name,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'lease' => ['id' => $lease->id, 'number' => $lease->lease_number],
            'property' => $lease->property?->only(['id', 'name', 'code']),
            'landlord' => $lease->landlord?->only(['id', 'name']),
        ];
    }

    private function statusWord(string $status): string
    {
        return match ($status) {
            'paid' => 'paid',
            'bounced' => 'marked as bounced',
            'cancelled' => 'cancelled',
            default => 'scheduled',
        };
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return HasMany<HeadLeasePayment, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->headLeasePayments()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('head_lease_payments.cheque_number', "%{$search}%")
                ->orWhereLike('head_lease_payments.reference', "%{$search}%")
                ->orWhereHas('headLease', fn (Builder $leases) => $leases
                    ->whereLike('lease_number', "%{$search}%")
                    ->orWhereHas('landlord', fn (Builder $landlords) => $landlords->whereLike('name', "%{$search}%")))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('head_lease_payments.status', $filters['status']))
            ->when($except !== 'due' && $filters['due'] !== [], fn (Builder $query) => $query
                ->where('head_lease_payments.status', 'scheduled')
                ->where(function (Builder $query) use ($filters) {
                    if (in_array('overdue', $filters['due'], true)) {
                        $query->orWhereDate('head_lease_payments.due_date', '<', today());
                    }

                    if (in_array('next_30_days', $filters['due'], true)) {
                        $query->orWhereBetween('head_lease_payments.due_date', [today(), today()->addDays(30)]);
                    }
                }))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('headLease.property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }

    /**
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $scheduled = fn () => $company->headLeasePayments()->where('status', 'scheduled');

        return [
            'dueSoon' => [
                'count' => $scheduled()->whereBetween('due_date', [today(), today()->addDays(30)])->count(),
                'amount' => (float) $scheduled()->whereBetween('due_date', [today(), today()->addDays(30)])->sum('amount'),
            ],
            'overdue' => [
                'count' => $scheduled()->whereDate('due_date', '<', today())->count(),
                'amount' => (float) $scheduled()->whereDate('due_date', '<', today())->sum('amount'),
            ],
            'paidThisYear' => (float) $company->headLeasePayments()->where('status', 'paid')->whereYear('paid_on', today()->year)->sum('amount'),
            'remaining' => (float) $scheduled()->sum('amount'),
        ];
    }
}
