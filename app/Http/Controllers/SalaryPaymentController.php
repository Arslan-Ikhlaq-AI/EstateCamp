<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Models\Company;
use App\Models\SalaryPayment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Staff salaries as payments: every salary the payroll worked out, across
 * months, paid or still to pay. A period picks the salary months it covers
 * (this quarter shows July, August and September's salaries). Preparing,
 * adjusting and paying salaries stays on the payroll page.
 */
class SalaryPaymentController extends Controller
{
    use DescribesStaff, FiltersByPeriod, ListsRecords;

    /**
     * List the salaries, latest month first, then as the payroll orders staff.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('SalaryPayments/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, ['status' => SalaryPayment::STATUSES, 'method' => SalaryPayment::PAYMENT_METHODS]),
            'period' => $period['value'],
        ];
        $inPeriod = fn () => $this->filteredQuery($company, $filters, $period, except: 'all');

        return Inertia::render('SalaryPayments/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->facetOptions(SalaryPayment::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'status')),
                'method' => $this->facetOptions(SalaryPayment::PAYMENT_METHODS, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'method'), 'payment_method')),
            ],
            'summary' => [
                'net' => round((float) $inPeriod()->sum('net_pay'), 2),
                'deductions' => round((float) $inPeriod()->sum('absence_deduction') + (float) $inPeriod()->sum('deductions'), 2),
                'additions' => round((float) $inPeriod()->sum('additions'), 2),
                'paid' => ['count' => $inPeriod()->where('status', 'paid')->count(), 'amount' => round((float) $inPeriod()->where('status', 'paid')->sum('net_pay'), 2)],
                'pending' => ['count' => $inPeriod()->where('status', 'pending')->count(), 'amount' => round((float) $inPeriod()->where('status', 'pending')->sum('net_pay'), 2)],
                'staff' => $inPeriod()->distinct()->count('staff_member_id'),
                'months' => $inPeriod()->distinct()->count('period'),
            ],
            'salaries' => $this->filteredQuery($company, $filters, $period)
                ->with(['staffMember' => fn ($query) => $query->withTrashed()->with(self::staffRelations()), 'paidBy:id,name'])
                ->orderByDesc('period')
                ->orderByRaw("case status when 'pending' then 0 else 1 end")
                ->orderByDesc('net_pay')
                ->orderBy('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (SalaryPayment $salary) => [
                    ...PayrollController::salaryDetails($salary),
                    'staff' => self::personDetails($salary->staffMember),
                    'paidBy' => $salary->paidBy?->name,
                ]),
            'canManage' => Gate::allows('manage-staff'),
        ]);
    }

    /**
     * The company's salaries for months in the period, narrowed by the
     * search and filters, leaving out the filter named in `$except` (`all`
     * leaves out every filter but the period).
     *
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<SalaryPayment, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $except === 'all' ? '' : $filters['search'];

        return $this->wherePeriod($company->salaryPayments(), 'period', [
            'from' => $period['from'] === null ? null : substr($period['from'], 0, 7).'-01',
            'to' => $period['to'],
        ])
            ->when($search !== '', fn (Builder $query) => $query->whereHas('staffMember', fn (Builder $staff) => $staff
                ->withTrashed()
                ->where(fn (Builder $staff) => $staff->whereLike('full_name', "%{$search}%")->orWhereLike('employee_number', "%{$search}%"))))
            ->when(! in_array($except, ['status', 'all'], true) && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when(! in_array($except, ['method', 'all'], true) && $filters['method'] !== [], fn (Builder $query) => $query->whereIn('payment_method', $filters['method']));
    }
}
