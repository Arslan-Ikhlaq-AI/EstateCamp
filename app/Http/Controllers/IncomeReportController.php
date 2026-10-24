<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Http\Controllers\Concerns\ReadsCashFlow;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The income and expenditure report, on a cash basis: what came in and
 * went out over a period by kind, against the period before it, a year of
 * it month by month, how it moved, who paid the most and who was paid the
 * most, beside what was invoiced in the period (rent and gas bills).
 */
class IncomeReportController extends Controller
{
    use FiltersByPeriod, PreparesReports, ReadsCashFlow;

    /**
     * Months in the month-by-month table, ending with the period's last month.
     */
    private const MONTHS = 12;

    /**
     * How many payers and payees the report names.
     */
    private const TOP_PARTIES = 8;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Income', ['company' => null]);
        }

        $withSalaries = Gate::allows('view-staff');
        $categories = $this->cashCategories($withSalaries);
        $period = $this->periodFilter($request, 'this_month');
        $previous = $this->previousPeriod($period);
        $inPeriod = fn () => $this->wherePeriod($this->cashLedger($company, $withSalaries), 'date', $period);
        $invoices = fn () => $this->wherePeriod($company->invoices()->whereNot('status', 'void'), 'issue_date', $period);

        return Inertia::render('Reports/Income', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'period' => $period,
            'previousPeriod' => $previous,
            'canSeeSalaries' => $withSalaries,
            'statement' => $this->cashTotals($inPeriod(), $categories),
            'previousStatement' => $previous ? $this->cashTotals($this->wherePeriod($this->cashLedger($company, $withSalaries), 'date', $previous), $categories) : null,
            'months' => $this->cashByMonth($company, $withSalaries, $this->monthsEndingWith($period['to'], self::MONTHS)),
            'methods' => $this->cashByMethod($inPeriod()),
            'payers' => $this->cashByParty($inPeriod(), 'in', self::TOP_PARTIES),
            'payees' => $this->cashByParty($inPeriod(), 'out', self::TOP_PARTIES),
            'invoiced' => [
                'count' => $invoices()->count(),
                'subtotal' => round((float) $invoices()->sum('subtotal'), 2),
                'vat' => round((float) $invoices()->sum('vat_amount'), 2),
                'total' => round((float) $invoices()->sum('total'), 2),
                'gas' => ['count' => $invoices()->where('kind', 'gas')->count(), 'total' => round((float) $invoices()->where('kind', 'gas')->sum('total'), 2)],
            ],
        ]);
    }
}
