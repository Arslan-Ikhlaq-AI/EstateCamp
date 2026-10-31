<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * What each property earned and spent over a range of days, day by day,
 * from the money that actually moved (as in ReadsCashFlow).
 *
 * Earned: client payments towards contracts, shared among the properties
 * a contract rents in by each one's part of its monthly rent; what
 * short-term rentals paid, without the security deposits, which are held
 * and not earned; and extra income, such as a provider's share. Spent:
 * the landlord's and the maintenance contractors' cheques that cleared,
 * maintenance bills paid and one-off payments made. A client payment that
 * no contract can be found for has no property.
 */
trait ReadsPropertyMoney
{
    /**
     * Where a property's revenue comes from, and what it spends on.
     */
    public const MONEY_KINDS = [
        'revenue' => ['contract_rent', 'short_term', 'extra_income'],
        'expense' => ['landlord', 'contracts', 'bills', 'others'],
    ];

    /**
     * Money moved for each property, kind and day from `$from` to `$to`.
     *
     * @return Collection<int, array{property: ?int, side: string, kind: string, date: string, amount: float}>
     */
    protected function propertyMoney(Company $company, string $from, string $to): Collection
    {
        $inRange = fn (QueryBuilder $query, string $column) => $query->whereDate($column, '>=', $from)->whereDate($column, '<=', $to);
        $row = fn (string $side, string $kind) => fn (object $row) => [
            'property' => $row->property_id === null ? null : (int) $row->property_id,
            'side' => $side,
            'kind' => $kind,
            'date' => substr((string) $row->date, 0, 10),
            'amount' => (float) $row->total,
        ];
        $byProperty = fn (QueryBuilder $query, string $property, string $date, string $amount) => $query
            ->groupBy($property, $date)
            ->selectRaw("{$property} as property_id, {$date} as date, sum({$amount}) as total")
            ->get();

        $shortTerm = $byProperty($inRange(DB::table('rental_payments'), 'rental_payments.paid_on')
            ->join('room_rentals', 'room_rentals.id', '=', 'rental_payments.room_rental_id')
            ->where('rental_payments.company_id', $company->id)
            ->where('rental_payments.status', 'cleared')
            ->where('rental_payments.purpose', '!=', 'deposit'), 'room_rentals.property_id', 'rental_payments.paid_on', 'rental_payments.amount');

        $extraIncome = $byProperty($inRange(DB::table('extra_incomes'), 'received_on')
            ->where('company_id', $company->id)
            ->where('status', 'received'), 'property_id', 'received_on', 'amount');

        $issuedCheques = fn (string $type, string $table) => $byProperty($inRange(DB::table('cheques'), 'cheques.cleared_on')
            ->join($table, fn ($join) => $join->on("{$table}.id", '=', 'cheques.chequeable_id')->where('cheques.chequeable_type', $type))
            ->where('cheques.company_id', $company->id)
            ->where('cheques.direction', 'issued')
            ->where('cheques.status', 'cleared'), "{$table}.property_id", 'cheques.cleared_on', 'cheques.amount');

        $bills = $byProperty($inRange(DB::table('maintenance_jobs'), 'paid_on')
            ->where('company_id', $company->id)
            ->whereNull('deleted_at')
            ->where('amount', '>', 0), 'property_id', 'paid_on', 'amount');

        $others = $byProperty($inRange(DB::table('other_payments'), 'payment_date')
            ->where('company_id', $company->id)
            ->where('status', 'paid'), 'property_id', 'payment_date', 'amount');

        return $this->contractRent($company, $from, $to)
            ->concat($shortTerm->map($row('revenue', 'short_term')))
            ->concat($extraIncome->map($row('revenue', 'extra_income')))
            ->concat($issuedCheques('head_lease', 'head_leases')->map($row('expense', 'landlord')))
            ->concat($issuedCheques('maintenance_contract', 'maintenance_contracts')->map($row('expense', 'contracts')))
            ->concat($bills->map($row('expense', 'bills')))
            ->concat($others->map($row('expense', 'others')))
            ->values();
    }

    /**
     * What clients paid towards contracts, by property and day. What a
     * payment settled goes to the contract of each invoice it paid; what it
     * paid beyond them, as credit, to the contract it was collected for.
     * Each contract's money is shared among its properties.
     *
     * @return Collection<int, array{property: ?int, side: string, kind: string, date: string, amount: float}>
     */
    private function contractRent(Company $company, string $from, string $to): Collection
    {
        $payments = fn () => DB::table('payments')
            ->where('payments.company_id', $company->id)
            ->where('payments.status', 'cleared')
            ->whereDate('payments.received_on', '>=', $from)
            ->whereDate('payments.received_on', '<=', $to);

        $settled = $payments()
            ->join('payment_allocations', 'payment_allocations.payment_id', '=', 'payments.id')
            ->join('invoices', 'invoices.id', '=', 'payment_allocations.invoice_id')
            ->groupBy('invoices.contract_id', 'payments.received_on')
            ->selectRaw('invoices.contract_id as contract_id, payments.received_on as date, sum(payment_allocations.amount) as total')
            ->get();

        $allocated = DB::table('payment_allocations')->groupBy('payment_id')->selectRaw('payment_id, sum(amount) as amount');
        $credit = $payments()
            ->leftJoinSub($allocated, 'allocated', 'allocated.payment_id', '=', 'payments.id')
            ->whereRaw('payments.amount > coalesce(allocated.amount, 0)')
            ->groupBy('payments.contract_id', 'payments.received_on')
            ->selectRaw('payments.contract_id as contract_id, payments.received_on as date, sum(payments.amount - coalesce(allocated.amount, 0)) as total')
            ->get();

        $shares = $this->contractShares($company);

        return $settled->concat($credit)->flatMap(function (object $row) use ($shares) {
            $money = fn (?int $property, float $amount) => [
                'property' => $property,
                'side' => 'revenue',
                'kind' => 'contract_rent',
                'date' => substr((string) $row->date, 0, 10),
                'amount' => $amount,
            ];
            $split = $row->contract_id === null ? null : ($shares[(int) $row->contract_id] ?? null);

            if ($split === null) {
                return [$money(null, (float) $row->total)];
            }

            return array_map(fn (int $property, float $share) => $money($property, (float) $row->total * $share), array_keys($split), $split);
        });
    }

    /**
     * Each contract's properties and the part of its money each one takes:
     * its lines' share of the contract's monthly rent, or of its lines when
     * no rent is set.
     *
     * @return array<int, array<int, float>>
     */
    private function contractShares(Company $company): array
    {
        return DB::table('contract_lines')
            ->where('company_id', $company->id)
            ->groupBy('contract_id', 'property_id')
            ->selectRaw('contract_id, property_id, sum(monthly_rate) as rent, count(*) as line_count')
            ->get()
            ->groupBy('contract_id')
            ->map(function (Collection $properties) {
                $rent = (float) $properties->sum('rent');
                $lines = (int) $properties->sum('line_count');

                return $properties->mapWithKeys(fn (object $property) => [
                    (int) $property->property_id => $rent > 0 ? (float) $property->rent / $rent : (int) $property->line_count / $lines,
                ])->all();
            })
            ->all();
    }
}
