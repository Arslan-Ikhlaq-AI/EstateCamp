<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AgesReceivables;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The receivables report, as of today: what each client and individual
 * tenant owes, aged by how long it has been due, every open invoice and
 * rent in arrears, and the cheques held against it.
 */
class ReceivablesReportController extends Controller
{
    use AgesReceivables, PreparesReports;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Receivables', ['company' => null]);
        }

        $invoices = $this->openInvoices($company);
        $rent = $this->rentArrears($company);
        $cheques = ChequeController::summary($company);

        return Inertia::render('Reports/Receivables', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'asOf' => today()->toDateString(),
            'buckets' => self::AGING_BUCKETS,
            'totals' => [
                'invoices' => $this->bucketTotals($invoices->map(fn (array $invoice) => [$invoice['bucket'] => $invoice['balance']])),
                'rent' => $this->bucketTotals($rent->pluck('buckets')),
            ],
            'parties' => $this->parties($invoices, $rent),
            'invoices' => $invoices,
            'rentals' => $rent,
            'cheques' => [
                'inHand' => $cheques['inHand'],
                'toDeposit' => $cheques['toDeposit'],
                'atBank' => $cheques['atBank'],
                'bounced' => $cheques['bounced'],
            ],
        ]);
    }

    /**
     * Amounts summed by aging bucket, every bucket present.
     *
     * @param  Collection<int, array<string, float>>  $amounts
     * @return array<string, float>
     */
    private function bucketTotals(Collection $amounts): array
    {
        $totals = array_fill_keys(self::AGING_BUCKETS, 0.0);

        foreach ($amounts as $byBucket) {
            foreach ($byBucket as $bucket => $amount) {
                $totals[$bucket] = round($totals[$bucket] + $amount, 2);
            }
        }

        return $totals;
    }

    /**
     * Everyone who owes something, the most owed first: their open invoices
     * and rent in arrears together, by aging bucket.
     *
     * @param  Collection<int, array<string, mixed>>  $invoices
     * @param  Collection<int, array<string, mixed>>  $rent
     * @return list<array{id: int, name: string, type: string, invoices: int, rentals: int, buckets: array<string, float>, total: float, oldestDue: string}>
     */
    private function parties(Collection $invoices, Collection $rent): array
    {
        $owed = $invoices
            ->map(fn (array $invoice) => [
                'id' => $invoice['clientId'],
                'name' => $invoice['client'],
                'type' => $invoice['clientType'],
                'invoices' => 1,
                'rentals' => 0,
                'amounts' => [$invoice['bucket'] => $invoice['balance']],
                'due' => $invoice['dueDate'],
            ])
            ->concat($rent->map(fn (array $rental) => [
                'id' => $rental['clientId'],
                'name' => $rental['client'],
                'type' => 'individual',
                'invoices' => 0,
                'rentals' => 1,
                'amounts' => $rental['buckets'],
                'due' => $rental['dueSince'],
            ]));

        return $owed
            ->groupBy('id')
            ->map(function (Collection $entries) {
                $buckets = $this->bucketTotals($entries->pluck('amounts'));

                return [
                    'id' => $entries->first()['id'],
                    'name' => $entries->first()['name'],
                    'type' => $entries->first()['type'],
                    'invoices' => $entries->sum('invoices'),
                    'rentals' => $entries->sum('rentals'),
                    'buckets' => $buckets,
                    'total' => round(array_sum($buckets), 2),
                    'oldestDue' => $entries->min('due'),
                ];
            })
            ->sortBy([['total', 'desc'], ['name', 'asc']])
            ->values()
            ->all();
    }
}
