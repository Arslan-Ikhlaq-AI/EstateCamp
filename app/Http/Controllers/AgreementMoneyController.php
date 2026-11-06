<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsExtraPayments;
use App\Http\Requests\ExtraPaymentReceiveRequest;
use App\Http\Requests\ExtraPaymentStatusRequest;
use App\Models\Commission;
use App\Models\Company;
use App\Models\Deposit;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The commissions and the security deposits taken with contracts and
 * short-term rentals, each on a page of its own: the route's `kind` says
 * which. Lists what came in, what was settled and what is left.
 */
class AgreementMoneyController extends Controller
{
    use FiltersByPeriod, ListsRecords, ReadsExtraPayments;

    /**
     * Settlements listed under the table.
     */
    private const SETTLEMENT_ROWS = 20;

    /**
     * How the money can have arrived, older records included.
     */
    private const LISTED_METHODS = ['cash', 'cheque', 'bank_transfer', 'card'];

    /**
     * List the money received in the period, with all that is still to arrive.
     */
    public function index(Request $request): Response
    {
        $kind = $request->route('kind');
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('ExtraPayments/Records', ['kind' => $kind, 'company' => null]);
        }

        $period = $this->periodFilter($request);
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = [
            ...$this->listFilters($request, ['standing' => Settlement::KINDS[$kind]::STANDINGS, 'method' => self::LISTED_METHODS]),
            'period' => $period['value'],
            'property' => (string) $properties->firstWhere('id', $request->integer('property'))?->id,
        ];
        $records = fn (?string $except = null) => $this->filteredQuery($kind, $company, $filters, $period, $except);

        return Inertia::render('ExtraPayments/Records', [
            'kind' => $kind,
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'standing' => $this->facetOptions(Settlement::KINDS[$kind]::STANDINGS, $this->standingCounts($records('standing'))),
                'method' => $this->facetOptions(self::LISTED_METHODS, $this->countBy($records('method'), 'method')),
            ],
            'properties' => $properties,
            'summary' => $this->moneyFigures($records()),
            'settlements' => $this->settlementHistory([$kind => $records()], self::SETTLEMENT_ROWS),
            'records' => $this->inManageOrder($records())
                ->with(self::agreementMoneyRelations())
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Commission|Deposit $record) => self::agreementMoneyDetails($record, $kind)),
            'settlementMethods' => Settlement::METHODS,
        ]);
    }

    /**
     * Record that money left for later has arrived.
     */
    public function receive(ExtraPaymentReceiveRequest $request): RedirectResponse
    {
        $record = $request->record();

        $record->receive($request->date('received_on'), [
            'method' => $request->validated('method'),
            'cheque_number' => $request->validated('cheque_number'),
            'bank_name' => $request->validated('bank_name'),
            'cheque_date' => $request->validated('cheque_date'),
        ]);

        return back()->with('success', "{$record->getAttribute($record::NUMBER_COLUMN)} was received.");
    }

    /**
     * Cancel money that will not be paid, or count it again.
     */
    public function changeStatus(ExtraPaymentStatusRequest $request): RedirectResponse
    {
        $record = $request->record();
        $isCancelled = $request->boolean('cancelled');

        $record->changeStatus($isCancelled);

        return back()->with('success', $record->getAttribute($record::NUMBER_COLUMN).($isCancelled ? ' was cancelled.' : ' counts again.'));
    }

    /**
     * The company's records narrowed by the search and filters, leaving out
     * the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return Builder<Commission|Deposit>
     */
    private function filteredQuery(string $kind, Company $company, array $filters, array $period, ?string $except = null): Builder
    {
        $model = Settlement::KINDS[$kind];
        $search = $filters['search'];

        return $this->receivedIn($model::query()->where('company_id', $company->id), $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike($model::NUMBER_COLUMN, "%{$search}%")
                ->orWhereLike('cheque_number', "%{$search}%")
                ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%"))
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")->orWhereLike('code', "%{$search}%"))))
            ->when($except !== 'standing' && $filters['standing'] !== [], fn (Builder $query) => $query->standingIn($filters['standing']))
            ->when($except !== 'method' && $filters['method'] !== [], fn (Builder $query) => $query->whereIn('method', $filters['method']))
            ->when($filters['property'] !== '', fn (Builder $query) => $query->where('property_id', $filters['property']));
    }
}
