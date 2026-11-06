<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsCashFlow;
use App\Models\Company;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\Property;
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
 * one ledger; for the whole company or, with `?property=`, one property.
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

        $withSalaries = Gate::allows('salaries.view');
        $categories = $this->cashCategories($withSalaries);
        $period = $this->periodFilter($request, 'this_month');
        $previous = $this->previousPeriod($period);
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $propertyId = $properties->firstWhere('id', $request->integer('property'))?->id;
        $filters = [
            ...$this->listFilters($request, ['direction' => ['in', 'out'], 'category' => $categories, 'method' => self::CASH_METHODS]),
            'period' => $period['value'],
            'property' => $propertyId,
        ];
        $ledger = fn () => $this->cashLedger($company, $withSalaries, $propertyId);
        $inPeriod = fn () => $this->wherePeriod($ledger(), 'date', $period);
        $totals = $this->cashTotals($inPeriod(), $categories);

        return Inertia::render('Payments/Overview', [
            'company' => ['currency' => $company->default_currency],
            'period' => $period,
            'previousPeriod' => $previous,
            'filters' => $filters,
            'properties' => $properties->map(fn (Property $property) => $property->only(['id', 'name', 'code']))->all(),
            'canSeeSalaries' => $withSalaries,
            'totals' => $totals,
            'previousTotals' => $previous ? $this->cashTotals($this->wherePeriod($ledger(), 'date', $previous), $categories) : null,
            'methods' => $this->cashByMethod($inPeriod()),
            'trend' => $this->trend($ledger(), $period),
            'outstanding' => $this->outstanding($company, $withSalaries, $propertyId),
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
     * Money in and out of `$ledger` for each of the twelve months up to the
     * period's last month (this month for all time).
     *
     * @param  array{to: ?string}  $period
     * @return list<array{month: string, in: float, out: float}>
     */
    private function trend(QueryBuilder $ledger, array $period): array
    {
        $end = CarbonImmutable::parse($period['to'] ?? today())->startOfMonth();
        $start = $end->subMonthsNoOverflow(self::TREND_MONTHS - 1);
        $days = $this->cashByDay($this->wherePeriod($ledger, 'date', [
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
     * this month's salaries still unpaid). At `$propertyId`, what a contract
     * owes counts for the part that property takes, as in the ledger.
     *
     * @return array<string, array{count: int, amount: float}>
     */
    private function outstanding(Company $company, bool $withSalaries, ?int $propertyId): array
    {
        $today = today();
        $atProperty = $propertyId !== null;
        $totals = fn ($query, $column = 'amount') => ['count' => (clone $query)->count(), 'amount' => round((float) (clone $query)->sum($column), 2)];
        $here = fn ($query) => $query->when($atProperty, fn ($query) => $query->where('property_id', $propertyId));
        $shares = fn () => $this->contractShares($company, $propertyId);

        $openInvoices = fn () => $company->invoices()
            ->whereIn('status', ['issued', 'partially_paid'])
            ->when($atProperty, fn ($query) => $query->joinSub($shares(), 'shares', 'shares.contract_id', '=', 'invoices.contract_id'));
        $stillOwed = DB::raw($atProperty ? '(total - amount_paid) * shares.share' : 'total - amount_paid');

        $rentOwed = $here($company->roomRentals())
            ->active()
            ->withSum(['payments as rent_paid' => fn ($payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
            ->get()
            ->map(fn (RoomRental $rental) => $rental->rentStanding())
            ->filter(fn (array $standing) => $standing['arrears'] > 0);

        $chequesToBank = $company->cheques()
            ->where('cheques.direction', 'received')
            ->whereIn('cheques.status', ['received', 'deposited'])
            ->whereDate('cheques.cheque_date', '<=', $today)
            ->when($atProperty, fn ($query) => $query
                ->leftJoinSub($shares(), 'shares', fn ($join) => $join->on('shares.contract_id', '=', 'cheques.chequeable_id')->where('cheques.chequeable_type', 'contract'))
                ->leftJoin('room_rentals', fn ($join) => $join->on('room_rentals.id', '=', 'cheques.chequeable_id')->where('cheques.chequeable_type', 'room_rental'))
                ->where(fn ($query) => $query->whereNotNull('shares.share')->orWhere('room_rentals.property_id', $propertyId)));

        $issuedCheques = fn (string $type, string $agreement) => $company->cheques()
            ->where('chequeable_type', $type)
            ->whereIn('status', ['pending', 'issued'])
            ->whereDate('cheque_date', '<=', $today->copy()->addDays(30))
            ->when($atProperty, fn ($query) => $query->whereHasMorph('chequeable', [$agreement], $here));

        return [
            'invoices' => ['count' => $openInvoices()->count(), 'amount' => round((float) $openInvoices()->sum($stillOwed), 2)],
            'overdueInvoices' => [
                'count' => $openInvoices()->whereDate('due_date', '<', $today)->count(),
                'amount' => round((float) $openInvoices()->whereDate('due_date', '<', $today)->sum($stillOwed), 2),
            ],
            'rentOwed' => ['count' => $rentOwed->count(), 'amount' => round($rentOwed->sum('arrears'), 2)],
            'chequesToBank' => $totals($chequesToBank, $atProperty ? DB::raw('cheques.amount * coalesce(shares.share, 1)') : 'amount'),
            'landlordCheques' => $totals($issuedCheques('head_lease', HeadLease::class)),
            'contractorCheques' => $totals($issuedCheques('maintenance_contract', MaintenanceContract::class)),
            'maintenanceBills' => $totals($here($company->maintenanceJobs())->inStage('completed')->whereNull('paid_on')->where('amount', '>', 0)),
            'salaries' => $withSalaries
                ? $totals($company->salaryPayments()
                    ->where('status', 'pending')
                    ->whereDate('period', '<=', $today->copy()->startOfMonth())
                    ->when($atProperty, fn ($query) => $query->whereHas('staffMember', $here)), 'net_pay')
                : null,
        ];
    }
}
