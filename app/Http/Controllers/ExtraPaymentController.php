<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsExtraPayments;
use App\Models\Commission;
use App\Models\Company;
use App\Models\Contract;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\RoomRental;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The overview of the extra payments: commissions, then deposits, then
 * extra income, by property, with how much of each was settled, how, and
 * what is left. None of this money is part of payments, revenue or reports.
 */
class ExtraPaymentController extends Controller
{
    use FiltersByPeriod, ListsRecords, ReadsExtraPayments;

    /**
     * Latest records shown of each kind.
     */
    private const LATEST_ROWS = 5;

    /**
     * Settlements listed under the three sections.
     */
    private const SETTLEMENT_ROWS = 15;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('ExtraPayments/Overview', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = [
            ...$this->listFilters($request, ['standing' => Commission::STANDINGS]),
            'period' => $period['value'],
            'property' => (string) $properties->firstWhere('id', $request->integer('property'))?->id,
        ];
        $records = fn (string $kind, ?string $except = null) => $this->filteredQuery($kind, $company, $filters, $period, $except);
        $standingCounts = collect(array_keys(Settlement::KINDS))
            ->flatMap(fn (string $kind) => $this->standingCounts($records($kind, 'standing'))->map(fn (int $count, string $standing) => compact('standing', 'count'))->values())
            ->groupBy('standing')
            ->map(fn ($rows) => $rows->sum('count'));

        return Inertia::render('ExtraPayments/Overview', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => ['standing' => $this->facetOptions(Commission::STANDINGS, $standingCounts)],
            'properties' => $properties,
            'commissions' => $this->agreementSection('commission', $records('commission')),
            'deposits' => $this->agreementSection('deposit', $records('deposit')),
            'extraIncome' => [
                'figures' => $this->moneyFigures($records('extra_income')),
                'rows' => $this->inManageOrder($records('extra_income'))
                    ->with(['property:id,name,code', 'settlements' => fn ($query) => $query->with('createdBy:id,name')->orderBy('settled_on')->orderBy('id')])
                    ->limit(self::LATEST_ROWS)
                    ->get()
                    ->map(fn (ExtraIncome $income) => ExtraIncomeController::details($income)),
            ],
            'settlements' => $this->settlementHistory(collect(Settlement::KINDS)->keys()->mapWithKeys(fn (string $kind) => [$kind => $records($kind)])->all(), self::SETTLEMENT_ROWS),
            'settlementMethods' => Settlement::METHODS,
        ]);
    }

    /**
     * An agreement's commission and deposit, as its pages show them.
     *
     * @return array{commission: ?array<string, mixed>, deposit: ?array<string, mixed>}
     */
    public static function ofAgreement(Contract|RoomRental $agreement): array
    {
        $details = fn (string $kind, Commission|Deposit|null $record) => $record ? self::agreementMoneyDetails($record->load(self::agreementMoneyRelations()), $kind) : null;

        return [
            'commission' => $details('commission', $agreement->commission()->first()),
            'deposit' => $details('deposit', $agreement->deposit()->first()),
        ];
    }

    /**
     * One kind's figures and its latest records.
     *
     * @param  Builder<Commission|Deposit>  $records
     * @return array<string, mixed>
     */
    private function agreementSection(string $kind, Builder $records): array
    {
        return [
            'figures' => $this->moneyFigures($records),
            'rows' => $this->inManageOrder(clone $records)
                ->with(self::agreementMoneyRelations())
                ->limit(self::LATEST_ROWS)
                ->get()
                ->map(fn (Commission|Deposit $record) => self::agreementMoneyDetails($record, $kind)),
        ];
    }

    /**
     * One kind's records narrowed by the filters, leaving out the filter
     * named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return Builder<Commission|Deposit|ExtraIncome>
     */
    private function filteredQuery(string $kind, Company $company, array $filters, array $period, ?string $except = null): Builder
    {
        return $this->receivedIn(Settlement::KINDS[$kind]::query()->where('company_id', $company->id), $period)
            ->when($except !== 'standing' && $filters['standing'] !== [], fn (Builder $query) => $query->standingIn($filters['standing']))
            ->when($filters['property'] !== '', fn (Builder $query) => $query->where('property_id', $filters['property']));
    }
}
