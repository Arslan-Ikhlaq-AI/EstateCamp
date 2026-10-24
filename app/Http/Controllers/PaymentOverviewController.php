<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsCashFlow;
use App\Models\Company;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The payments overview: money in and out over a period against the one
 * before it, a year of monthly cash flow, where the money came from and
 * went, what is waiting to be collected or paid, and every transaction in
 * one ledger.
 */
class PaymentOverviewController extends Controller
{
    use FiltersByPeriod, ListsRecords, ReadsCashFlow;

    /**
     * Months of cash flow the chart shows, ending with the period's last month.
     */
    private const TREND_MONTHS = 12;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Payments/Overview', ['company' => null]);
        }

        $withSalaries = Gate::allows('view-staff');
        $categories = $this->cashCategories($withSalaries);
        $period = $this->periodFilter($request, 'this_month');
        $previous = $this->previousPeriod($period);
        $filters = [
            ...$this->listFilters($request, ['direction' => ['in', 'out'], 'category' => $categories, 'method' => self::CASH_METHODS]),
            'period' => $period['value'],
        ];
        $inPeriod = fn () => $this->wherePeriod($this->cashLedger($company, $withSalaries), 'date', $period);
        $totals = $this->cashTotals($inPeriod(), $categories);

        return Inertia::render('Payments/Overview', [
            'company' => ['currency' => $company->default_currency],
            'period' => $period,
            'previousPeriod' => $previous,
            'filters' => $filters,
            'canSeeSalaries' => $withSalaries,
            'totals' => $totals,
            'previousTotals' => $previous ? $this->cashTotals($this->wherePeriod($this->cashLedger($company, $withSalaries), 'date', $previous), $categories) : null,
            'methods' => $this->cashByMethod($inPeriod()),
            'trend' => $this->trend($company, $withSalaries, $period),
            'outstanding' => $this->outstanding($company, $withSalaries),
            'facets' => [
                'direction' => $this->facetOptions(['in', 'out'], $this->countBy($this->narrow($inPeriod(), $filters, except: 'direction'), 'direction')),
                'category' => $this->facetOptions($categories, $this->countBy($this->narrow($inPeriod(), $filters, except: 'category'), 'category')),
                'method' => $this->facetOptions(self::CASH_METHODS, $this->countBy($this->narrow($inPeriod(), $filters, except: 'method'), 'method')),
            ],
            'transactions' => $this->narrow($inPeriod(), $filters)
                ->orderByDesc('date')
                ->orderBy('category')
                ->orderByDesc('record_id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (object $row) => [
                    'key' => "{$row->category}-{$row->record_id}",
                    'category' => $row->category,
                    'direction' => $row->direction,
                    'recordId' => (int) $row->record_id,
                    'parentId' => $row->parent_id === null ? null : (int) $row->parent_id,
                    'date' => substr((string) $row->date, 0, 10),
                    'party' => $row->party,
                    'number' => $row->number,
                    'detail' => $row->detail,
                    'method' => $row->method,
                    'amount' => round((float) $row->amount, 2),
                ]),
        ]);
    }

    /**
     * The ledger narrowed by the search and the filters, leaving out the
     * filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     */
    private function narrow(QueryBuilder $ledger, array $filters, ?string $except = null): QueryBuilder
    {
        $search = $filters['search'];

        return $ledger
            ->when($search !== '', fn (QueryBuilder $query) => $query->where(fn (QueryBuilder $query) => $query
                ->whereLike('party', "%{$search}%")
                ->orWhereLike('number', "%{$search}%")
                ->orWhereLike('detail', "%{$search}%")))
            ->when($except !== 'direction' && $filters['direction'] !== [], fn (QueryBuilder $query) => $query->whereIn('direction', $filters['direction']))
            ->when($except !== 'category' && $filters['category'] !== [], fn (QueryBuilder $query) => $query->whereIn('category', $filters['category']))
            ->when($except !== 'method' && $filters['method'] !== [], fn (QueryBuilder $query) => $query->whereIn('method', $filters['method']));
    }

    /**
     * Money in and out for each of the twelve months up to the period's
     * last month (this month for all time).
     *
     * @param  array{to: ?string}  $period
     * @return list<array{month: string, in: float, out: float}>
     */
    private function trend(Company $company, bool $withSalaries, array $period): array
    {
        $end = CarbonImmutable::parse($period['to'] ?? today())->startOfMonth();
        $start = $end->subMonthsNoOverflow(self::TREND_MONTHS - 1);
        $days = $this->cashByDay($this->wherePeriod($this->cashLedger($company, $withSalaries), 'date', [
            'from' => $start->toDateString(),
            'to' => $end->endOfMonth()->toDateString(),
        ]));

        $months = [];

        for ($month = $start; $month->lte($end); $month = $month->addMonthNoOverflow()) {
            $months[$month->format('Y-m')] = ['month' => $month->format('Y-m'), 'in' => 0.0, 'out' => 0.0];
        }

        foreach ($days as $day) {
            $key = substr($day['date'], 0, 7);

            if (isset($months[$key])) {
                $months[$key][$day['direction']] = round($months[$key][$day['direction']] + $day['total'], 2);
            }
        }

        return array_values($months);
    }

    /**
     * What is waiting today, whatever the period: money to collect (unpaid
     * invoices, rent owed by individuals, client cheques to bank) and money
     * to pay (landlord cheques in the next 30 days, maintenance bills and
     * this month's salaries still unpaid).
     *
     * @return array<string, array{count: int, amount: float}>
     */
    private function outstanding(Company $company, bool $withSalaries): array
    {
        $today = today();
        $totals = fn ($query, string $column = 'amount') => ['count' => (clone $query)->count(), 'amount' => round((float) (clone $query)->sum($column), 2)];
        $openInvoices = fn () => $company->invoices()->whereIn('status', ['issued', 'partially_paid']);

        $rentOwed = $company->roomRentals()
            ->active()
            ->withSum(['payments as rent_paid' => fn ($payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
            ->get()
            ->map(fn (RoomRental $rental) => $rental->rentStanding())
            ->filter(fn (array $standing) => $standing['arrears'] > 0);

        return [
            'invoices' => ['count' => $openInvoices()->count(), 'amount' => round((float) $openInvoices()->sum(DB::raw('total - amount_paid')), 2)],
            'overdueInvoices' => [
                'count' => $openInvoices()->whereDate('due_date', '<', $today)->count(),
                'amount' => round((float) $openInvoices()->whereDate('due_date', '<', $today)->sum(DB::raw('total - amount_paid')), 2),
            ],
            'rentOwed' => ['count' => $rentOwed->count(), 'amount' => round($rentOwed->sum('arrears'), 2)],
            'chequesToBank' => $totals($company->cheques()->where('direction', 'received')->whereIn('status', ['received', 'deposited'])->whereDate('cheque_date', '<=', $today)),
            'landlordCheques' => $totals($company->cheques()->where('chequeable_type', 'head_lease')->whereIn('status', ['pending', 'issued'])->whereDate('cheque_date', '<=', $today->copy()->addDays(30))),
            'contractorCheques' => $totals($company->cheques()->where('chequeable_type', 'maintenance_contract')->whereIn('status', ['pending', 'issued'])->whereDate('cheque_date', '<=', $today->copy()->addDays(30))),
            'maintenanceBills' => $totals($company->maintenanceJobs()->inStage('completed')->whereNull('paid_on')->where('amount', '>', 0)),
            'salaries' => $withSalaries
                ? $totals($company->salaryPayments()->where('status', 'pending')->whereDate('period', '<=', $today->copy()->startOfMonth()), 'net_pay')
                : null,
        ];
    }
}
