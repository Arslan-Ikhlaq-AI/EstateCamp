<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AgesReceivables;
use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\MeasuresBeds;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Http\Controllers\Concerns\ReadsCashFlow;
use App\Models\Company;
use App\Models\Contract;
use App\Models\MaintenanceJob;
use App\Models\Property;
use App\Models\Room;
use App\Models\StaffMember;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The company summary: everything at a glance for a period against the
 * one before it. Money in and out, how full the properties are, clients
 * and contracts, what is owed, cheques, maintenance and, for those who may
 * see them, staff and payroll, with each property side by side.
 */
class SummaryReportController extends Controller
{
    use AgesReceivables, FiltersByPeriod, MeasuresBeds, PreparesReports, ReadsCashFlow;

    /**
     * Contracts ending within this many days count as ending soon.
     */
    private const EXPIRY_WINDOW_DAYS = 60;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Summary', ['company' => null]);
        }

        $withStaff = Gate::allows('view-staff');
        $categories = $this->cashCategories($withStaff);
        $period = $this->periodFilter($request, 'this_month');
        $previous = $this->previousPeriod($period);
        $cash = fn (array $range) => $this->cashTotals($this->wherePeriod($this->cashLedger($company, $withStaff), 'date', $range), $categories);
        $rooms = $company->rooms()->get();

        return Inertia::render('Reports/Summary', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'period' => $period,
            'previousPeriod' => $previous,
            'canSeeStaff' => $withStaff,
            'cash' => $cash($period),
            'previousCash' => $previous ? $cash($previous) : null,
            'occupancy' => [
                'properties' => $company->properties()->count(),
                'rooms' => $rooms->count(),
                'beds' => $this->beds($rooms),
                'rentRoll' => $this->rentRoll($rooms),
                'potentialRent' => $this->potentialRent($rooms),
                'checkIns' => $this->wherePeriod($company->occupancies(), 'check_in_date', $period)->count(),
                'checkOuts' => $this->wherePeriod($company->occupancies()->whereNotNull('check_out_date'), 'check_out_date', $period)->count(),
            ],
            'tenancy' => $this->tenancy($company, $period),
            'billing' => [
                'invoiced' => $this->totals($this->wherePeriod($company->invoices()->whereNot('status', 'void'), 'issue_date', $period), 'total'),
                'receivables' => $this->receivableTotals($company),
            ],
            'cheques' => [
                'cleared' => $this->totals($this->wherePeriod($company->cheques()->where('direction', 'received')->where('status', 'cleared'), 'cleared_on', $period)),
                'paid' => $this->totals($this->wherePeriod($company->cheques()->where('direction', 'issued')->where('status', 'cleared'), 'cleared_on', $period)),
                'bounced' => $this->totals($this->wherePeriod($company->cheques()->where('status', 'bounced'), 'bounced_on', $period)),
                'held' => $this->totals($company->cheques()->where('direction', 'received')->whereIn('status', ['received', 'deposited'])),
                'dueToPay' => $this->totals($company->cheques()->where('direction', 'issued')->whereIn('status', ['pending', 'issued'])->whereDate('cheque_date', '<=', today()->addDays(30))),
            ],
            'maintenance' => [
                'reported' => $this->wherePeriod($company->maintenanceJobs(), 'reported_on', $period)->count(),
                'completed' => $this->wherePeriod($company->maintenanceJobs()->inStage('completed'), 'completed_on', $period)->count(),
                'open' => $company->maintenanceJobs()->inStage(['open', 'in_progress'])->count(),
                'urgent' => $company->maintenanceJobs()->inStage(['open', 'in_progress'])->whereIn('priority', ['high', 'urgent'])->count(),
                'unpaid' => $this->totals($company->maintenanceJobs()->inStage('completed')->whereNull('paid_on')->where('amount', '>', 0)),
            ],
            'staff' => $withStaff ? $this->staff($company, $period) : null,
            'properties' => $this->properties($company, $rooms, $period),
        ]);
    }

    /**
     * How many records `$query` holds and what `$column` comes to.
     *
     * @param  Builder<*>|HasMany<*, *>  $query
     * @return array{count: int, amount: float}
     */
    private function totals(Builder|HasMany $query, string $column = 'amount'): array
    {
        return ['count' => (clone $query)->count(), 'amount' => round((float) (clone $query)->sum($column), 2)];
    }

    /**
     * Clients, contracts and individual rentals today, with the contracts
     * signed in the period.
     *
     * @param  array{from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function tenancy(Company $company, array $period): array
    {
        $contracts = $company->contracts()->where('status', 'active')->with('lines')->get();
        $rentals = $company->roomRentals()->active()->get(['id', 'monthly_rent']);

        return [
            'clients' => $company->clients()->where('status', 'active')->where('client_type', 'company')->count(),
            'contracts' => $contracts->count(),
            'contractValue' => round($contracts->sum(fn (Contract $contract) => $contract->monthlyValue()), 2),
            'endingSoon' => $contracts->filter(fn (Contract $contract) => $contract->end_date->lte(today()->addDays(self::EXPIRY_WINDOW_DAYS)))->count(),
            'signed' => $this->wherePeriod($company->contracts()->whereNotNull('signed_on'), 'signed_on', $period)->count(),
            'rentals' => $rentals->count(),
            'rentalValue' => round((float) $rentals->sum('monthly_rent'), 2),
        ];
    }

    /**
     * Staff today, who joined and left in the period, the salaries for the
     * period's months and attendance marked in it.
     *
     * @param  array{from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function staff(Company $company, array $period): array
    {
        $current = $company->staffMembers()->current()->get();
        $salaries = $this->wherePeriod($company->salaryPayments(), 'period', [
            'from' => $period['from'] === null ? null : substr($period['from'], 0, 7).'-01',
            'to' => $period['to'],
        ])->get(['status', 'net_pay']);
        $attendance = StaffReportController::attendanceCounts($company, $period);

        return [
            'headcount' => $current->count(),
            'onLeave' => $current->where('status', 'on_leave')->count(),
            'joined' => $this->wherePeriod($company->staffMembers(), 'joined_on', $period)->count(),
            'left' => $this->wherePeriod($company->staffMembers()->whereNotNull('left_on'), 'left_on', $period)->count(),
            'monthlyPayroll' => round($current->sum(fn (StaffMember $member) => $member->grossSalary()), 2),
            'net' => round((float) $salaries->sum('net_pay'), 2),
            'pending' => ['count' => $salaries->where('status', 'pending')->count(), 'amount' => round((float) $salaries->where('status', 'pending')->sum('net_pay'), 2)],
            'attendanceRate' => StaffReportController::attendanceRate($attendance),
        ];
    }

    /**
     * Each property side by side: its beds and rent today, and its
     * maintenance open today and paid in the period.
     *
     * @param  Collection<int, Room>  $rooms
     * @param  array{from: ?string, to: ?string}  $period
     * @return list<array<string, mixed>>
     */
    private function properties(Company $company, Collection $rooms, array $period): array
    {
        $open = $company->maintenanceJobs()->inStage(['open', 'in_progress'])->get(['id', 'property_id'])->countBy('property_id');
        $spend = $this->wherePeriod($company->maintenanceJobs()->whereNotNull('paid_on'), 'paid_on', $period)
            ->get(['property_id', 'amount'])
            ->groupBy('property_id')
            ->map(fn (Collection $jobs) => round((float) $jobs->sum(fn (MaintenanceJob $job) => (float) $job->amount), 2));

        return $company->properties()
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(function (Property $property) use ($rooms, $open, $spend) {
                $propertyRooms = $rooms->where('property_id', $property->id);

                return [
                    'id' => $property->id,
                    'name' => $property->name,
                    'code' => $property->code,
                    'rooms' => $propertyRooms->count(),
                    'beds' => $this->beds($propertyRooms),
                    'rentRoll' => $this->rentRoll($propertyRooms),
                    'openJobs' => $open->get($property->id, 0),
                    'maintenanceSpend' => $spend->get($property->id, 0.0),
                ];
            })
            ->all();
    }
}
