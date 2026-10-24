<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Requests\StaffAttendanceRequest;
use App\Models\Company;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Attendance: the sheet for marking one day, for one workplace or all of
 * them, and the month's register the payroll reads absences from.
 */
class StaffAttendanceController extends Controller
{
    use DescribesStaff;

    /**
     * Show one day's sheet (`view=day`, the default) or a month's register
     * (`view=month`). Days and months still to come open on today.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Staff/Attendance', ['company' => null]);
        }

        $today = $company->localNow()->startOfDay();
        $view = $request->query('view') === 'month' ? 'month' : 'day';
        $date = $this->queryDate($request->query('date'), 'Y-m-d')?->min($today) ?? $today;
        $month = $this->queryDate($request->query('month'), 'Y-m')?->startOfMonth()->min($today->startOfMonth()) ?? $today->startOfMonth();
        $workplaces = $this->workplaceOptions($company);
        $workplace = $workplaces->firstWhere('value', $request->query('workplace'))['value'] ?? null;

        $staff = fn (CarbonImmutable $from, CarbonImmutable $to) => $this->inStaffOrder($company->staffMembers()
            ->employedBetween($from, $to)
            ->when($workplace, fn (Builder $query) => $query->atWorkplace($workplace))
            ->with(self::staffRelations()))
            ->get();

        return Inertia::render('Staff/Attendance', [
            'company' => $company->only(['id', 'name']),
            'view' => $view,
            'date' => $date->toDateString(),
            'month' => $month->format('Y-m'),
            'today' => $today->toDateString(),
            'workplace' => $workplace,
            'workplaces' => $workplaces->filter(fn (array $option) => $option['isActive'] || $option['value'] === $workplace)->values(),
            'statuses' => StaffAttendance::STATUSES,
            ...($view === 'day' ? $this->daySheet($staff, $date) : $this->monthRegister($staff, $month)),
        ]);
    }

    /**
     * Save a day's sheet: each person marked gets that day's entry, replacing any earlier one.
     */
    public function store(StaffAttendanceRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $date = $request->date('work_date');
        $entries = collect($request->validated('entries'));
        $existing = $company->staffAttendances()
            ->whereIn('staff_member_id', $entries->pluck('staff_member_id'))
            ->whereDate('work_date', $date)
            ->get()
            ->keyBy('staff_member_id');

        DB::transaction(function () use ($entries, $existing, $company, $date, $request) {
            foreach ($entries as $entry) {
                $attendance = $existing->get($entry['staff_member_id']) ?? (new StaffAttendance)->forceFill([
                    'company_id' => $company->id,
                    'staff_member_id' => $entry['staff_member_id'],
                    'work_date' => $date,
                ]);

                $attendance->forceFill([
                    'status' => $entry['status'],
                    'check_in' => $entry['check_in'] ?? null,
                    'check_out' => $entry['check_out'] ?? null,
                    'note' => filled($entry['note'] ?? null) ? trim($entry['note']) : null,
                    'recorded_by' => $request->user()->id,
                ])->save();
            }
        });

        return back()->with('success', "Attendance for {$date->format('j M Y')} was saved for {$entries->count()} ".Str::plural('person', $entries->count()).'.');
    }

    /**
     * Everyone employed on `$date`, with what was marked for them.
     *
     * @param  Closure(CarbonImmutable, CarbonImmutable): Collection<int, StaffMember>  $staff
     * @return array<string, mixed>
     */
    private function daySheet(Closure $staff, CarbonImmutable $date): array
    {
        $people = $staff($date, $date);
        $marks = StaffAttendance::query()->whereIn('staff_member_id', $people->modelKeys())->whereDate('work_date', $date)->get()->keyBy('staff_member_id');

        return [
            'sheet' => $people->map(fn (StaffMember $member) => [
                ...self::personDetails($member),
                'attendance' => ($mark = $marks->get($member->id)) ? [
                    'status' => $mark->status,
                    'checkIn' => StaffAttendance::shortTime($mark->check_in),
                    'checkOut' => StaffAttendance::shortTime($mark->check_out),
                    'note' => $mark->note,
                ] : null,
            ])->values(),
        ];
    }

    /**
     * Everyone employed during the month starting `$month`, with what was
     * marked for them each day (by day of the month) and their totals.
     *
     * @param  Closure(CarbonImmutable, CarbonImmutable): Collection<int, StaffMember>  $staff
     * @return array<string, mixed>
     */
    private function monthRegister(Closure $staff, CarbonImmutable $month): array
    {
        $end = $month->endOfMonth()->startOfDay();
        $people = $staff($month, $end);
        $marks = StaffAttendance::query()
            ->whereIn('staff_member_id', $people->modelKeys())
            ->whereDate('work_date', '>=', $month)
            ->whereDate('work_date', '<=', $end)
            ->get(['staff_member_id', 'work_date', 'status'])
            ->groupBy('staff_member_id');

        return [
            'register' => [
                'days' => $month->daysInMonth,
                'rows' => $people->map(function (StaffMember $member) use ($marks) {
                    $own = $marks->get($member->id, collect());

                    return [
                        ...self::personDetails($member),
                        'joinedOn' => $member->joined_on->toDateString(),
                        'leftOn' => $member->left_on?->toDateString(),
                        'marks' => $own->mapWithKeys(fn (StaffAttendance $mark) => [$mark->work_date->day => $mark->status]),
                        'counts' => collect(StaffAttendance::STATUSES)->mapWithKeys(fn (string $status) => [$status => $own->where('status', $status)->count()]),
                    ];
                })->values(),
            ],
        ];
    }
}
