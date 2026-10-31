<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ReadsUnitHoldings;
use App\Http\Requests\BillingPaymentRequest;
use App\Models\Property;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Who holds each room, shop and apartment of a property over a period: a
 * client under contract, a company on a short-term rental without a
 * contract, or nobody. Units are taken whole.
 */
class RoomAllocationController extends Controller
{
    use FiltersByPeriod, ReadsUnitHoldings;

    /**
     * Show the property's rooms, shops and apartments with whoever holds
     * them in the chosen period (`?period=`, this month by default; any month
     * or range of days, past or future), what each was set up at and actually
     * brings in, and a summary of each kind. A holder counts when they hold
     * the unit on any day of the period, so a contract ending this month
     * leaves its unit available next month. The billing tab has each
     * holder's bill for the period (see billingAccounts()).
     */
    public function show(Request $request, Property $property): Response
    {
        $this->ensureSameCompany($request, $property);

        $period = $this->periodFilter($request, 'this_month');

        if ($period['kind'] === 'all') {
            $period = [...$this->resolvePeriod('this_month'), 'value' => '', 'default' => 'this_month'];
        }

        $from = CarbonImmutable::parse($period['from']);
        $to = CarbonImmutable::parse($period['to']);

        $property->load(['company:id,default_currency', 'propertyType:id,name,slug']);
        $kinds = $this->unitHoldings($property, $from, $to);

        return Inertia::render('Properties/Allocation', [
            'currency' => $property->company->default_currency,
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'code' => $property->code,
                'type' => $property->propertyType?->name,
                'typeSlug' => $property->propertyType?->slug,
                'area' => $property->area,
                'city' => $property->city,
            ],
            'period' => $period,
            'includesToday' => CarbonImmutable::today()->betweenIncluded($from, $to),
            ...$kinds,
            'summaries' => array_map(fn (array $rows) => $this->summary($rows, $from, $to), $kinds),
            'accounts' => $this->billingAccounts($property, $kinds, $from, $to),
            'collectionMethods' => BillingPaymentRequest::METHODS,
        ]);
    }

    /**
     * For one kind of unit in the period: how many units each kind of holder
     * has, how many are empty (and of those, available to let) and how many
     * come free during it; the standard rent of the let and available units;
     * what contracts and short-term rentals pay a month under the latest holdings
     * and how that compares with the standard rent; and the rent due for the
     * period, each holding charged for the days of each month it covers.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array{total: int, contract: int, short_term: int, empty: int, available: int, freeing: int, clients: array{contract: int, short_term: int}, standardRent: array{let: float, available: float}, rent: array{contract: float, short_term: float, overall: float}, difference: float, expected: float}
     */
    private function summary(array $rows, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = collect($rows);
        $holdings = $rows->pluck('holdings')->flatten(1);
        $let = $rows->whereNotIn('allocation', ['empty']);
        $available = $rows->where('allocation', 'empty')->where('inService', true);
        $latest = $holdings->where('isLatest', true);
        $clients = fn (string $category) => $holdings->where('category', $category)->pluck('client.id')->unique()->count();
        $rent = fn (string $category) => round($latest->where('category', $category)->sum('monthly'), 2);
        $overall = round($latest->sum('monthly'), 2);
        $standardLet = round($let->sum('standardRent'), 2);

        return [
            'total' => $rows->count(),
            'contract' => $rows->where('allocation', 'contract')->count(),
            'short_term' => $rows->where('allocation', 'short_term')->count(),
            'empty' => $rows->where('allocation', 'empty')->count(),
            'available' => $available->count(),
            'freeing' => $rows->whereNotNull('freeFrom')->count(),
            'clients' => ['contract' => $clients('contract'), 'short_term' => $clients('short_term')],
            'standardRent' => ['let' => $standardLet, 'available' => round($available->sum('standardRent'), 2)],
            'rent' => ['contract' => $rent('contract'), 'short_term' => $rent('short_term'), 'overall' => $overall],
            'difference' => round($overall - $standardLet, 2),
            'expected' => round($holdings->sum(fn (array $holding) => $this->rentForDays($holding, $from, $to)), 2),
        ];
    }

    /**
     * What a holding comes to over the days it covers between `$from` and
     * `$to`: in each month, its monthly rent for that month's share of days.
     *
     * @param  array{startsOn: string, endsOn: ?string, monthly: float}  $holding
     */
    private function rentForDays(array $holding, CarbonImmutable $from, CarbonImmutable $to): float
    {
        $first = CarbonImmutable::parse(max($holding['startsOn'], $from->toDateString()));
        $last = CarbonImmutable::parse(min($holding['endsOn'] ?? $to->toDateString(), $to->toDateString()));
        $total = 0.0;

        if ($first->gt($last)) {
            return $total;
        }

        for ($month = $first->startOfMonth(); $month->lte($last); $month = $month->addMonthNoOverflow()) {
            $start = $first->gt($month) ? $first : $month;
            $end = $last->lt($month->endOfMonth()) ? $last : $month->endOfMonth()->startOfDay();
            $total += $holding['monthly'] * ((int) $start->diffInDays($end) + 1) / $month->daysInMonth;
        }

        return $total;
    }
}
