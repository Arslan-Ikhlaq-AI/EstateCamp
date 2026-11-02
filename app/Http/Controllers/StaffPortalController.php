<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A staff member's own pages: today's attendance, which they mark by
 * checking in and out, each month of their attendance, and their salaries
 * with whether each has been paid. Times are the company's local time.
 */
class StaffPortalController extends Controller
{
    use DescribesStaff;

    /**
     * Show the signed-in staff member's page, with the attendance of `month`
     * (YYYY-MM; this month by default, never before they joined).
     */
    public function index(Request $request): Response
    {
        $member = $request->user()->staffMember;

        if (! $member) {
            return Inertia::render('Staff/Me', ['staff' => null]);
        }

        $member->load(self::staffRelations());
        $today = $member->company->localNow()->startOfDay();
        $months = $this->attendanceMonths($member, $today, $request->query('month'));
        $monthStart = CarbonImmutable::createFromFormat('!Y-m', $months['month']);
        $marks = $this->marksIn($member, $monthStart);

        return Inertia::render('Staff/Me', [
            'currency' => $member->company->default_currency,
            'staff' => [
                ...StaffMemberController::summaryDetails($member),
                'documents' => $member->identityDocuments(),
                'salary' => StaffMemberController::salaryStructure($member),
            ],
            'today' => $this->todayDetails($member, $today),
            'attendance' => [
                ...$months,
                'days' => $monthStart->daysInMonth,
                'marks' => $marks->map(fn (StaffAttendance $mark) => ['day' => $mark->work_date->day, ...self::markDetails($mark)]),
                'counts' => collect(StaffAttendance::STATUSES)->mapWithKeys(fn (string $status) => [$status => $marks->where('status', $status)->count()]),
            ],
            'salaries' => $member->salaryPayments()
                ->orderByDesc('period')
                ->limit(12)
                ->get()
                ->map(fn (SalaryPayment $salary) => PayrollController::salaryDetails($salary)),
        ]);
    }

    /**
     * Show the signed-in staff member's attendance: today's mark (made with
     * the check-in and check-out buttons), the totals of `month` (YYYY-MM;
     * this month by default, never before they joined) and each of its days
     * they were employed so far, newest first.
     */
    public function attendance(Request $request): Response
    {
        $member = $request->user()->staffMember;

        if (! $member) {
            return Inertia::render('Staff/MyAttendance', ['staff' => null]);
        }

        $member->load(self::staffRelations());
        $today = $member->company->localNow()->startOfDay();
        $months = $this->attendanceMonths($member, $today, $request->query('month'));
        $monthStart = CarbonImmutable::createFromFormat('!Y-m', $months['month']);
        $marks = $this->marksIn($member, $monthStart)->keyBy(fn (StaffAttendance $mark) => $mark->work_date->toDateString());
        $firstDay = max($monthStart->toDateString(), $member->joined_on->toDateString());
        $lastDay = min($monthStart->endOfMonth()->toDateString(), $today->toDateString(), $member->left_on?->toDateString() ?? $today->toDateString());

        $days = collect($firstDay <= $lastDay ? CarbonPeriod::create($firstDay, $lastDay)->toArray() : [])
            ->map(function (CarbonInterface $day) use ($marks) {
                $mark = $marks->get($day->toDateString());

                return [
                    'date' => $day->toDateString(),
                    'status' => $mark?->status,
                    'checkIn' => StaffAttendance::shortTime($mark?->check_in),
                    'checkOut' => StaffAttendance::shortTime($mark?->check_out),
                    'minutes' => $mark?->minutesWorked(),
                    'note' => $mark?->note,
                ];
            })
            ->reverse()
            ->values();

        return Inertia::render('Staff/MyAttendance', [
            'staff' => StaffMemberController::summaryDetails($member),
            'today' => $this->todayDetails($member, $today),
            'attendance' => [
                ...$months,
                'days' => $days,
                'counts' => collect(StaffAttendance::STATUSES)
                    ->mapWithKeys(fn (string $status) => [$status => $days->where('status', $status)->count()])
                    ->put('unmarked', $days->whereNull('status')->count()),
                'minutes' => $days->sum('minutes'),
                'timedDays' => $days->whereNotNull('minutes')->count(),
            ],
        ]);
    }

    /**
     * Check in for today: the day is marked present from now.
     *
     * @throws ValidationException When today cannot be checked into.
     */
    public function checkIn(Request $request): RedirectResponse
    {
        $member = $this->signedInMember($request);
        $now = $member->company->localNow();
        $today = $now->startOfDay();
        $mark = $member->attendances()->whereDate('work_date', $today->toDateString())->first();

        if (! $this->canCheckIn($member, $today, $mark, $member->openShift($today))) {
            throw ValidationException::withMessages(['attendance' => match (true) {
                ! $member->isEmployedOn($today) => 'You are not employed on this day, so it cannot be checked into.',
                $member->openShift($today) !== null => 'Check out of your last shift first.',
                default => 'Today is already marked. Ask your supervisor if it needs changing.',
            }]);
        }

        $mark ??= (new StaffAttendance)->forceFill(['company_id' => $member->company_id, 'staff_member_id' => $member->id, 'work_date' => $today->toDateString()]);
        $mark->forceFill(['status' => 'present', 'check_in' => $now->format('H:i'), 'recorded_by' => $request->user()->id])->save();

        return back()->with('success', "You checked in at {$now->format('H:i')}.");
    }

    /**
     * Check out of the shift checked into today or, for a night shift, yesterday.
     *
     * @throws ValidationException When there is no shift to check out of.
     */
    public function checkOut(Request $request): RedirectResponse
    {
        $member = $this->signedInMember($request);
        $now = $member->company->localNow();
        $shift = $member->openShift($now->startOfDay());

        if (! $shift) {
            throw ValidationException::withMessages(['attendance' => 'You have not checked in yet.']);
        }

        $shift->forceFill(['check_out' => $now->format('H:i'), 'recorded_by' => $request->user()->id])->save();

        return back()->with('success', "You checked out at {$now->format('H:i')}.");
    }

    /**
     * Today on the staff member's own pages: what is marked, any shift still
     * open, and whether they can check in.
     *
     * @return array{date: string, isEmployed: bool, attendance: ?array<string, ?string>, openShift: ?array{date: string, checkIn: ?string}, canCheckIn: bool}
     */
    private function todayDetails(StaffMember $member, CarbonImmutable $today): array
    {
        $mark = $member->attendances()->whereDate('work_date', $today->toDateString())->first();
        $openShift = $member->openShift($today);

        return [
            'date' => $today->toDateString(),
            'isEmployed' => $member->isEmployedOn($today),
            'attendance' => $mark ? self::markDetails($mark) : null,
            'openShift' => $openShift ? ['date' => $openShift->work_date->toDateString(), 'checkIn' => StaffAttendance::shortTime($openShift->check_in)] : null,
            'canCheckIn' => $this->canCheckIn($member, $today, $mark, $openShift),
        ];
    }

    /**
     * The month of attendance to show from `$requested` (YYYY-MM): this month
     * when it is missing, and never before the month they joined or after this one.
     *
     * @return array{month: string, firstMonth: string, currentMonth: string}
     */
    private function attendanceMonths(StaffMember $member, CarbonImmutable $today, mixed $requested): array
    {
        $currentMonth = $today->format('Y-m');
        $firstMonth = min($member->joined_on->format('Y-m'), $currentMonth);

        return [
            'month' => max($firstMonth, min($currentMonth, $this->queryDate($requested, 'Y-m')?->format('Y-m') ?? $currentMonth)),
            'firstMonth' => $firstMonth,
            'currentMonth' => $currentMonth,
        ];
    }

    /**
     * Their attendance marks in the month starting `$monthStart`, by day.
     *
     * @return Collection<int, StaffAttendance>
     */
    private function marksIn(StaffMember $member, CarbonImmutable $monthStart): Collection
    {
        return $member->attendances()
            ->whereDate('work_date', '>=', $monthStart->toDateString())
            ->whereDate('work_date', '<=', $monthStart->endOfMonth()->toDateString())
            ->orderBy('work_date')
            ->get();
    }

    /**
     * Whether `$member` can check in today: they are employed, have no
     * shift still open, and today is not marked yet (or marked present
     * without a time in).
     */
    private function canCheckIn(StaffMember $member, CarbonImmutable $today, ?StaffAttendance $mark, ?StaffAttendance $openShift): bool
    {
        return $member->isEmployedOn($today)
            && $openShift === null
            && ($mark === null || ($mark->status === 'present' && $mark->check_in === null));
    }

    /**
     * The staff record of the signed-in user; only staff have attendance to mark.
     */
    private function signedInMember(Request $request): StaffMember
    {
        $member = $request->user()->staffMember;

        abort_if($member === null, 403);

        return $member;
    }

    /**
     * @return array{status: string, checkIn: ?string, checkOut: ?string, note: ?string}
     */
    private static function markDetails(StaffAttendance $mark): array
    {
        return [
            'status' => $mark->status,
            'checkIn' => StaffAttendance::shortTime($mark->check_in),
            'checkOut' => StaffAttendance::shortTime($mark->check_out),
            'note' => $mark->note,
        ];
    }
}
