<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The staff and payroll report: who works where and in what role, who
 * joined and left over a period, the salaries for the period's months,
 * attendance by person, and identity documents to renew. Only for those
 * who may see the staff.
 */
class StaffReportController extends Controller
{
    use DescribesStaff, FiltersByPeriod, PreparesReports;

    /**
     * Workplaces in the order the report lists them, each kind by name.
     */
    private const WORKPLACE_ORDER = ['head_office', 'office', 'property'];

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Staff', ['company' => null]);
        }

        $period = $this->periodFilter($request, 'this_month');
        $staff = $this->inStaffOrder($company->staffMembers())->with(self::staffRelations())->get();
        $current = $staff->reject(fn (StaffMember $member) => $member->hasLeft());
        $salaries = $this->salariesIn($company, $period)->get();
        $attendance = self::attendanceCounts($company, $period);

        return Inertia::render('Reports/Staff', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'period' => $period,
            'summary' => [
                'headcount' => $current->count(),
                'onLeave' => $current->where('status', 'on_leave')->count(),
                'joined' => $this->wherePeriod($company->staffMembers(), 'joined_on', $period)->count(),
                'left' => $this->wherePeriod($company->staffMembers()->whereNotNull('left_on'), 'left_on', $period)->count(),
                'monthlyPayroll' => round($current->sum(fn (StaffMember $member) => $member->grossSalary()), 2),
                'net' => round((float) $salaries->sum('net_pay'), 2),
                'paid' => ['count' => $salaries->where('status', 'paid')->count(), 'amount' => round((float) $salaries->where('status', 'paid')->sum('net_pay'), 2)],
                'pending' => ['count' => $salaries->where('status', 'pending')->count(), 'amount' => round((float) $salaries->where('status', 'pending')->sum('net_pay'), 2)],
                'attendance' => [...$attendance, 'rate' => self::attendanceRate($attendance)],
            ],
            'workplaces' => $current
                ->groupBy(fn (StaffMember $member) => $member->workplaceKey())
                ->map(fn (Collection $members) => [
                    ...self::personDetails($members->first())['workplace'],
                    'headcount' => $members->count(),
                    'payroll' => round($members->sum(fn (StaffMember $member) => $member->grossSalary()), 2),
                ])
                ->sortBy([fn (array $first, array $second) => array_search($first['type'], self::WORKPLACE_ORDER, true) <=> array_search($second['type'], self::WORKPLACE_ORDER, true), ['name', 'asc']])
                ->values()
                ->all(),
            // Staff come in the staff pages' order, so their roles do too: head office, regional, then site roles.
            'roles' => $current
                ->groupBy('staff_role_id')
                ->map(fn (Collection $members) => [
                    ...$members->first()->role->only(['id', 'name', 'slug', 'level']),
                    'headcount' => $members->count(),
                    'payroll' => round($members->sum(fn (StaffMember $member) => $member->grossSalary()), 2),
                ])
                ->values()
                ->all(),
            'payroll' => $salaries
                ->groupBy(fn (SalaryPayment $salary) => $salary->period->format('Y-m'))
                ->map(fn (Collection $month, string $key) => [
                    'month' => $key,
                    'staff' => $month->count(),
                    'gross' => round((float) $month->sum('gross_salary'), 2),
                    'deductions' => round((float) $month->sum('absence_deduction') + (float) $month->sum('deductions'), 2),
                    'additions' => round((float) $month->sum('additions'), 2),
                    'net' => round((float) $month->sum('net_pay'), 2),
                    'paid' => round((float) $month->where('status', 'paid')->sum('net_pay'), 2),
                    'pending' => round((float) $month->where('status', 'pending')->sum('net_pay'), 2),
                ])
                ->sortKeys()
                ->values()
                ->all(),
            'people' => $this->attendanceByPerson($company, $staff, $period),
            'documents' => $current
                ->flatMap(fn (StaffMember $member) => collect($member->identityDocuments())
                    ->filter(fn (array $document) => $document['days'] !== null && $document['days'] <= StaffMember::DOCUMENT_WARNING_DAYS)
                    ->map(fn (array $document) => [...$document, 'staff' => self::personDetails($member)]))
                ->sortBy('days')
                ->values()
                ->all(),
        ]);
    }

    /**
     * Attendance marked for the company's staff in a period, by status,
     * every status present.
     *
     * @param  array{from: ?string, to: ?string}  $period
     * @return array<string, int>
     */
    public static function attendanceCounts(Company $company, array $period): array
    {
        $marked = $company->staffAttendances()
            ->when($period['from'], fn ($query, string $from) => $query->whereDate('work_date', '>=', $from))
            ->when($period['to'], fn ($query, string $to) => $query->whereDate('work_date', '<=', $to))
            ->toBase()
            ->groupBy('status')
            ->selectRaw('status, count(*) as aggregate')
            ->pluck('aggregate', 'status');

        return collect(StaffAttendance::STATUSES)->mapWithKeys(fn (string $status) => [$status => (int) ($marked[$status] ?? 0)])->all();
    }

    /**
     * The share of working days worked, a half day counting as half; leave
     * and days off are left out. Null when no working day was marked.
     *
     * @param  array<string, int>  $counts
     */
    public static function attendanceRate(array $counts): ?float
    {
        $workingDays = $counts['present'] + $counts['half_day'] + $counts['absent'];

        return $workingDays > 0 ? round(($counts['present'] + $counts['half_day'] / 2) / $workingDays * 100, 1) : null;
    }

    /**
     * The salaries for the months the period touches.
     *
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<SalaryPayment, Company>
     */
    private function salariesIn(Company $company, array $period): HasMany
    {
        return $this->wherePeriod($company->salaryPayments(), 'period', [
            'from' => $period['from'] === null ? null : substr($period['from'], 0, 7).'-01',
            'to' => $period['to'],
        ]);
    }

    /**
     * Each person's attendance in the period, for those employed in it (or
     * with attendance marked in it), in the order staff pages list them.
     *
     * @param  Collection<int, StaffMember>  $staff
     * @param  array{from: ?string, to: ?string}  $period
     * @return list<array<string, mixed>>
     */
    private function attendanceByPerson(Company $company, Collection $staff, array $period): array
    {
        $marks = $this->wherePeriod($company->staffAttendances(), 'work_date', $period)
            ->toBase()
            ->groupBy('staff_member_id', 'status')
            ->selectRaw('staff_member_id, status, count(*) as aggregate')
            ->get()
            ->groupBy('staff_member_id');
        $from = $period['from'] ?? '0000-01-01';
        $to = $period['to'] ?? today()->toDateString();

        return $staff
            ->filter(fn (StaffMember $member) => $marks->has($member->id)
                || ($member->joined_on->toDateString() <= $to && ($member->left_on === null || $member->left_on->toDateString() >= $from)))
            ->map(function (StaffMember $member) use ($marks) {
                $counts = collect(StaffAttendance::STATUSES)
                    ->mapWithKeys(fn (string $status) => [$status => (int) ($marks->get($member->id, collect())->firstWhere('status', $status)?->aggregate ?? 0)])
                    ->all();

                return [
                    ...self::personDetails($member),
                    'counts' => $counts,
                    'marked' => array_sum($counts),
                    'rate' => self::attendanceRate($counts),
                ];
            })
            ->values()
            ->all();
    }
}
