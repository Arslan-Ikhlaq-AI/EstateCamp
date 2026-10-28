<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Every movement of the company's money in one list, for the payments
 * overview and the reports: what came in (client payments that cleared,
 * and receipts from individuals renting rooms) and what went out (landlord and
 * maintenance contractor cheques that cleared, maintenance bills paid,
 * one-off payments for a property, salaries paid and deposits handed back). Money still on its way, such as a cheque not yet cleared,
 * is left out until it moves.
 *
 * Each row has the same columns whatever it came from: category,
 * direction (in or out), record_id and parent_id (to link to it), date,
 * party, number, detail, method and amount.
 */
trait ReadsCashFlow
{
    /**
     * The kinds of money movement, by direction.
     */
    public const CASH_CATEGORIES = [
        'in' => ['client_payment', 'rental_payment'],
        'out' => ['landlord_rent', 'maintenance', 'salary', 'maintenance_contract', 'deposit_refund', 'other_payment'],
    ];

    /**
     * How money moves, as the ledger names it.
     */
    public const CASH_METHODS = ['cash', 'bank_transfer', 'cheque', 'card'];

    /**
     * The company's ledger as a query to narrow, total or page through.
     * Salaries are left out for those who may not see the payroll.
     */
    protected function cashLedger(Company $company, bool $withSalaries): QueryBuilder
    {
        $id = $company->id;

        $ledger = DB::table('payments')
            ->join('clients', 'clients.id', '=', 'payments.client_id')
            ->where('payments.company_id', $id)
            ->where('payments.status', 'cleared')
            ->select([
                DB::raw("'client_payment' as category"),
                DB::raw("'in' as direction"),
                'payments.id as record_id',
                'payments.client_id as parent_id',
                'payments.received_on as date',
                'clients.name as party',
                'payments.payment_number as number',
                'payments.reference as detail',
                'payments.method as method',
                'payments.amount',
            ])
            ->unionAll(DB::table('rental_payments')
                ->join('room_rentals', 'room_rentals.id', '=', 'rental_payments.room_rental_id')
                ->join('clients', 'clients.id', '=', 'room_rentals.client_id')
                ->where('rental_payments.company_id', $id)
                ->where('rental_payments.status', 'cleared')
                ->select([
                    DB::raw("'rental_payment'"),
                    DB::raw("'in'"),
                    'rental_payments.id',
                    'rental_payments.room_rental_id',
                    'rental_payments.paid_on',
                    'clients.name',
                    'rental_payments.receipt_number',
                    'room_rentals.rental_number',
                    'rental_payments.method',
                    'rental_payments.amount',
                ]))
            ->unionAll(DB::table('cheques')
                ->join('head_leases', fn ($join) => $join->on('head_leases.id', '=', 'cheques.chequeable_id')->where('cheques.chequeable_type', 'head_lease'))
                ->join('landlords', 'landlords.id', '=', 'head_leases.landlord_id')
                ->where('cheques.company_id', $id)
                ->where('cheques.direction', 'issued')
                ->where('cheques.status', 'cleared')
                ->select([
                    DB::raw("'landlord_rent'"),
                    DB::raw("'out'"),
                    'cheques.id',
                    'head_leases.id',
                    'cheques.cleared_on',
                    'landlords.name',
                    'cheques.cheque_number',
                    'head_leases.lease_number',
                    DB::raw("'cheque'"),
                    'cheques.amount',
                ]))
            ->unionAll(DB::table('cheques')
                ->join('maintenance_contracts', fn ($join) => $join->on('maintenance_contracts.id', '=', 'cheques.chequeable_id')->where('cheques.chequeable_type', 'maintenance_contract'))
                ->where('cheques.company_id', $id)
                ->where('cheques.direction', 'issued')
                ->where('cheques.status', 'cleared')
                ->select([
                    DB::raw("'maintenance_contract'"),
                    DB::raw("'out'"),
                    'cheques.id',
                    'maintenance_contracts.id',
                    'cheques.cleared_on',
                    'maintenance_contracts.vendor_name',
                    'cheques.cheque_number',
                    'maintenance_contracts.contract_number',
                    DB::raw("'cheque'"),
                    'cheques.amount',
                ]))
            ->unionAll(DB::table('maintenance_jobs')
                ->where('maintenance_jobs.company_id', $id)
                ->whereNull('maintenance_jobs.deleted_at')
                ->whereNotNull('maintenance_jobs.paid_on')
                ->where('maintenance_jobs.amount', '>', 0)
                ->select([
                    DB::raw("'maintenance'"),
                    DB::raw("'out'"),
                    'maintenance_jobs.id',
                    'maintenance_jobs.property_id',
                    'maintenance_jobs.paid_on',
                    'maintenance_jobs.vendor_name',
                    'maintenance_jobs.voucher_number',
                    'maintenance_jobs.title',
                    'maintenance_jobs.payment_method',
                    'maintenance_jobs.amount',
                ]))
            ->unionAll(DB::table('room_rentals')
                ->join('clients', 'clients.id', '=', 'room_rentals.client_id')
                ->where('room_rentals.company_id', $id)
                ->where('room_rentals.deposit_refunded', '>', 0)
                ->select([
                    DB::raw("'deposit_refund'"),
                    DB::raw("'out'"),
                    'room_rentals.id',
                    'room_rentals.client_id',
                    'room_rentals.deposit_refunded_on',
                    'clients.name',
                    'room_rentals.rental_number',
                    DB::raw('cast(null as varchar(255))'),
                    'room_rentals.deposit_refund_method',
                    'room_rentals.deposit_refunded',
                ]))
            ->unionAll(DB::table('other_payments')
                ->where('other_payments.company_id', $id)
                ->where('other_payments.status', 'paid')
                ->select([
                    DB::raw("'other_payment'"),
                    DB::raw("'out'"),
                    'other_payments.id',
                    'other_payments.property_id',
                    'other_payments.payment_date',
                    'other_payments.paid_to',
                    'other_payments.payment_number',
                    'other_payments.title',
                    'other_payments.method',
                    'other_payments.amount',
                ]));

        if ($withSalaries) {
            $ledger->unionAll(DB::table('salary_payments')
                ->join('staff_members', 'staff_members.id', '=', 'salary_payments.staff_member_id')
                ->where('salary_payments.company_id', $id)
                ->where('salary_payments.status', 'paid')
                ->select([
                    DB::raw("'salary'"),
                    DB::raw("'out'"),
                    'salary_payments.id',
                    'salary_payments.staff_member_id',
                    'salary_payments.paid_on',
                    'staff_members.full_name',
                    'staff_members.employee_number',
                    'salary_payments.reference',
                    'salary_payments.payment_method',
                    'salary_payments.net_pay',
                ]));
        }

        return DB::query()->fromSub($ledger, 'ledger');
    }

    /**
     * The categories a user can see in the ledger.
     *
     * @return list<string>
     */
    protected function cashCategories(bool $withSalaries): array
    {
        return array_values(array_filter(
            [...self::CASH_CATEGORIES['in'], ...self::CASH_CATEGORIES['out']],
            fn (string $category) => $withSalaries || $category !== 'salary',
        ));
    }

    /**
     * Totals of `$ledger` by category, every category present (zero when
     * nothing moved).
     *
     * @param  list<string>  $categories
     * @return array<string, array{count: int, amount: float}>
     */
    protected function cashTotals(QueryBuilder $ledger, array $categories): array
    {
        $rows = (clone $ledger)
            ->groupBy('category')
            ->selectRaw('category, count(*) as aggregate, sum(amount) as total')
            ->get()
            ->keyBy('category');

        return collect($categories)
            ->mapWithKeys(fn (string $category) => [$category => [
                'count' => (int) ($rows[$category]->aggregate ?? 0),
                'amount' => round((float) ($rows[$category]->total ?? 0), 2),
            ]])
            ->all();
    }

    /**
     * Money in and out of `$ledger` by how it moved, every method present.
     *
     * @return array<string, array<string, float>>
     */
    protected function cashByMethod(QueryBuilder $ledger): array
    {
        $rows = (clone $ledger)->groupBy('direction', 'method')->selectRaw('direction, method, sum(amount) as total')->get();

        return collect(['in', 'out'])
            ->mapWithKeys(fn (string $direction) => [$direction => collect(self::CASH_METHODS)
                ->mapWithKeys(fn (string $method) => [$method => round((float) $rows->where('direction', $direction)->where('method', $method)->sum('total'), 2)])
                ->all()])
            ->all();
    }

    /**
     * Who `$ledger` moved the most money from or to in `$direction`, most
     * first: each party's name, how many payments and how much.
     *
     * @return list<array{party: string, count: int, amount: float}>
     */
    protected function cashByParty(QueryBuilder $ledger, string $direction, int $limit): array
    {
        return (clone $ledger)
            ->where('direction', $direction)
            ->whereNotNull('party')
            ->groupBy('party')
            ->selectRaw('party, count(*) as aggregate, sum(amount) as total')
            ->orderByDesc('total')
            ->orderBy('party')
            ->limit($limit)
            ->get()
            ->map(fn (object $row) => ['party' => $row->party, 'count' => (int) $row->aggregate, 'amount' => round((float) $row->total, 2)])
            ->all();
    }

    /**
     * Money moved in each of `$months` (`Y-m`, oldest first), by category
     * and in and out together.
     *
     * @param  list<string>  $months
     * @return list<array{month: string, categories: array<string, float>, in: float, out: float}>
     */
    protected function cashByMonth(Company $company, bool $withSalaries, array $months): array
    {
        $rows = $this->cashLedger($company, $withSalaries)
            ->whereDate('date', '>=', "{$months[0]}-01")
            ->whereDate('date', '<=', CarbonImmutable::parse(end($months).'-01')->endOfMonth()->toDateString())
            ->groupBy('date', 'category', 'direction')
            ->selectRaw('date, category, direction, sum(amount) as total')
            ->get();

        $table = [];

        foreach ($months as $month) {
            $table[$month] = ['month' => $month, 'categories' => array_fill_keys($this->cashCategories($withSalaries), 0.0), 'in' => 0.0, 'out' => 0.0];
        }

        foreach ($rows as $row) {
            $month = substr((string) $row->date, 0, 7);

            if (isset($table[$month])) {
                $table[$month]['categories'][$row->category] = round($table[$month]['categories'][$row->category] + (float) $row->total, 2);
                $table[$month][$row->direction] = round($table[$month][$row->direction] + (float) $row->total, 2);
            }
        }

        return array_values($table);
    }

    /**
     * Money in and out for each day of `$ledger`.
     *
     * @return list<array{date: string, direction: string, total: float}>
     */
    protected function cashByDay(QueryBuilder $ledger): array
    {
        return (clone $ledger)
            ->groupBy('date', 'direction')
            ->selectRaw('date, direction, sum(amount) as total')
            ->get()
            ->map(fn (object $row) => ['date' => substr((string) $row->date, 0, 10), 'direction' => $row->direction, 'total' => (float) $row->total])
            ->all();
    }
}
