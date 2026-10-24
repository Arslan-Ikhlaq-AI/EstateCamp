<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\MaintenanceBillPaymentRequest;
use App\Models\Company;
use App\Models\MaintenanceJob;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Maintenance bills: what each finished job cost, paying the vendors, and
 * the payment voucher the company keeps for each payment.
 *
 * A bill's date is the day it was paid, or until then the day the work
 * finished (the day it was reported for work not finished yet); the period
 * filter matches it.
 */
class MaintenanceBillController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    public const STATUSES = ['unpaid', 'paid'];

    /**
     * List the bills: unpaid ones first, then the latest.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('MaintenanceBills/Index', ['company' => null]);
        }

        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, [
                'status' => self::STATUSES,
                'method' => MaintenanceJob::PAYMENT_METHODS,
                'properties' => $properties->pluck('code')->all(),
            ]),
            'period' => $period['value'],
        ];
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, $period, except: 'properties'), 'property_id');
        $statusCounts = $this->filteredQuery($company, $filters, $period, except: 'status')
            ->toBase()
            ->selectRaw('sum(case when paid_on is null then 1 else 0 end) as unpaid, sum(case when paid_on is null then 0 else 1 end) as paid')
            ->first();

        return Inertia::render('MaintenanceBills/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => array_map(fn (string $status) => ['value' => $status, 'count' => (int) ($statusCounts->{$status} ?? 0)], self::STATUSES),
                'method' => $this->facetOptions(MaintenanceJob::PAYMENT_METHODS, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'method')->whereNotNull('paid_on'), 'payment_method')),
                'properties' => $properties->map(fn ($property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])->values(),
            ],
            'summary' => $this->summary($company, $period),
            'bills' => $this->filteredQuery($company, $filters, $period)
                ->with([...MaintenanceJobController::listRelations(), 'paidBy:id,name'])
                ->orderByRaw('case when paid_on is null then 0 else 1 end')
                ->orderByDesc(DB::raw(self::billDate()))
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (MaintenanceJob $job) => self::details($job)),
            'paymentMethods' => MaintenanceJob::PAYMENT_METHODS,
        ]);
    }

    /**
     * Pay a bill and issue its voucher.
     */
    public function pay(MaintenanceBillPaymentRequest $request, MaintenanceJob $maintenanceJob): RedirectResponse
    {
        $maintenanceJob->markPaid($request->date('paid_on'), $request->validated('payment_method'), $request->validated('reference'), $request->user());

        return back()->with('success', "{$maintenanceJob->job_number} was paid; voucher {$maintenanceJob->voucher_number} was issued.");
    }

    /**
     * Undo a payment recorded by mistake.
     *
     * @throws ValidationException When the bill is not paid.
     */
    public function unpay(Request $request, MaintenanceJob $maintenanceJob): RedirectResponse
    {
        $this->ensureSameCompany($request, $maintenanceJob);

        if (! $maintenanceJob->isPaid()) {
            throw ValidationException::withMessages(['bill' => "{$maintenanceJob->job_number} is not paid yet."]);
        }

        $voucher = $maintenanceJob->voucher_number;
        $maintenanceJob->markUnpaid();

        return back()->with('success', "The payment of {$maintenanceJob->job_number} was undone".($voucher ? " and voucher {$voucher} cancelled." : '.'));
    }

    /**
     * A paid bill's payment voucher, ready to print and sign.
     */
    public function voucher(Request $request, MaintenanceJob $maintenanceJob): Response
    {
        $this->ensureSameCompany($request, $maintenanceJob);

        abort_unless($maintenanceJob->isPaid(), 404);

        $maintenanceJob->load([...MaintenanceJobController::listRelations(), 'paidBy:id,name']);
        $company = $maintenanceJob->company;

        return Inertia::render('MaintenanceBills/Voucher', [
            'currency' => $company->default_currency,
            'company' => $company->only(['name', 'legal_name', 'tax_registration_number', 'address_line_1', 'address_line_2', 'city', 'phone', 'email', 'logo_url']),
            'bill' => [
                ...self::details($maintenanceJob),
                'description' => $maintenanceJob->description,
            ],
        ]);
    }

    /**
     * One bill as the list and the voucher show it.
     *
     * @return array<string, mixed>
     */
    public static function details(MaintenanceJob $job): array
    {
        return [
            ...MaintenanceJobController::summaryDetails($job),
            'vendorPhone' => $job->vendor_phone,
            'invoiceNumber' => $job->invoice_number,
            'invoiceUrl' => $job->invoice_path ? route('maintenance.invoice', [$job, 'v' => $job->updated_at?->timestamp]) : null,
            'paidOn' => $job->paid_on?->toDateString(),
            'paymentMethod' => $job->payment_method,
            'paymentReference' => $job->payment_reference,
            'voucherNumber' => $job->voucher_number,
            'paidBy' => $job->relationLoaded('paidBy') ? $job->paidBy?->name : null,
        ];
    }

    /**
     * The day a bill counts on: paid, else finished, else reported.
     */
    private static function billDate(): string
    {
        return 'coalesce(maintenance_jobs.paid_on, maintenance_jobs.completed_on, maintenance_jobs.reported_on)';
    }

    /**
     * Headline figures. What is unpaid stands as of today; what was paid and
     * billed covers the chosen period, or this month when the list shows all time.
     *
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $period): array
    {
        $range = $period['kind'] === 'all' ? ['from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString()] : $period;
        $bills = fn () => $company->maintenanceJobs()->where('amount', '>', 0);
        $unpaid = $bills()->whereNull('paid_on');
        $paid = $this->wherePeriod($bills()->whereNotNull('paid_on'), 'paid_on', $range);
        $billed = $this->wherePeriod($bills(), DB::raw(self::billDate()), $range);

        return [
            'inPeriod' => $period['kind'] !== 'all',
            'unpaid' => ['count' => (clone $unpaid)->count(), 'amount' => round((float) (clone $unpaid)->sum('amount'), 2)],
            'paid' => ['count' => (clone $paid)->count(), 'amount' => round((float) (clone $paid)->sum('amount'), 2)],
            'billed' => ['count' => (clone $billed)->count(), 'amount' => round((float) (clone $billed)->sum('amount'), 2)],
            'vendors' => (clone $billed)->whereNotNull('vendor_name')->distinct()->count('vendor_name'),
        ];
    }

    /**
     * The company's bills (jobs with an amount) narrowed by the search and
     * filters, leaving out the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<MaintenanceJob, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $this->wherePeriod($company->maintenanceJobs()->where('amount', '>', 0), DB::raw(self::billDate()), $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('job_number', "%{$search}%")
                ->orWhereLike('title', "%{$search}%")
                ->orWhereLike('vendor_name', "%{$search}%")
                ->orWhereLike('invoice_number', "%{$search}%")
                ->orWhereLike('voucher_number', "%{$search}%")
                ->orWhereLike('payment_reference', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && count($filters['status']) === 1, fn (Builder $query) => $filters['status'][0] === 'paid' ? $query->whereNotNull('paid_on') : $query->whereNull('paid_on'))
            ->when($except !== 'method' && $filters['method'] !== [], fn (Builder $query) => $query->whereNotNull('paid_on')->whereIn('payment_method', $filters['method']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }
}
