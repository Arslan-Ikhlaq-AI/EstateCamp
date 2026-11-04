<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Requests\LeaveDecisionRequest;
use App\Http\Requests\StaffLeaveRequest;
use App\Models\SalaryPayment;
use App\Models\StaffLeave;
use App\Models\StaffMember;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Leave: the requests staff send from their own page, waiting for someone
 * to approve them as paid or unpaid or to reject them; leave given to
 * someone without a request; and each leave with what it does to the
 * salary. Approved leave marks its days in attendance, and unpaid days come
 * off the payroll like absences (see StaffLeave).
 */
class StaffLeaveController extends Controller
{
    use DescribesStaff;

    /**
     * The lists the page can show: requests waiting, approved leave, leave
     * rejected or cancelled, and everything.
     */
    public const FILTERS = ['pending', 'approved', 'closed', 'all'];

    /**
     * List the company's leave (`status` one of FILTERS; requests waiting by
     * default, or everything when none are), with the month's leave days.
     */
    public function index(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $today = $company->localNow()->startOfDay();
        $month = $today->startOfMonth();
        $inList = fn (string $filter) => fn (Builder $query) => match ($filter) {
            'pending' => $query->where('status', 'pending'),
            'approved' => $query->where('status', 'approved'),
            'closed' => $query->whereIn('status', ['rejected', 'cancelled']),
            default => $query,
        };

        $counts = collect(self::FILTERS)->mapWithKeys(fn (string $filter) => [$filter => $company->staffLeaves()->where($inList($filter))->count()]);
        $filter = in_array($request->query('status'), self::FILTERS, true) ? $request->query('status') : ($counts['pending'] > 0 ? 'pending' : 'all');
        $leaveDays = $company->staffAttendances()
            ->whereDate('work_date', '>=', $month)
            ->whereDate('work_date', '<=', $month->endOfMonth())
            ->whereIn('status', ['leave', 'unpaid_leave'])
            ->toBase()
            ->groupBy('status')
            ->selectRaw('status, count(*) as aggregate')
            ->pluck('aggregate', 'status');

        return Inertia::render('Staff/Leave', [
            'filter' => $filter,
            'counts' => $counts,
            'leaves' => $company->staffLeaves()
                ->where($inList($filter))
                ->with(['staffMember' => fn ($query) => $query->withTrashed()->with(self::staffRelations()), 'decidedBy:id,name'])
                // Requests waiting come soonest first; the rest newest first.
                ->when($filter === 'pending', fn (Builder $query) => $query->orderBy('starts_on'), fn (Builder $query) => $query->orderByDesc('starts_on'))
                ->orderByDesc('id')
                ->paginate(25)
                ->withQueryString()
                ->through(fn (StaffLeave $leave) => [...self::leaveDetails($leave), 'staff' => self::personDetails($leave->staffMember)]),
            'summary' => [
                'pending' => $counts['pending'],
                'onLeaveToday' => $company->staffLeaves()->where('status', 'approved')->overlapping($today, $today)->distinct()->count('staff_member_id'),
                'month' => $month->format('Y-m'),
                'paidDays' => (int) ($leaveDays['leave'] ?? 0),
                'unpaidDays' => (int) ($leaveDays['unpaid_leave'] ?? 0),
            ],
            'canManage' => Gate::allows('leave.manage'),
        ]);
    }

    /**
     * The page for giving one of the staff leave without a request: everyone
     * still employed but the signed-in user, `staff` (an id) chosen when given.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $staff = $this->inStaffOrder($company->staffMembers()->current()->with(self::staffRelations()))
            ->when($request->user()->staffMember, fn (Builder $query, StaffMember $own) => $query->whereKeyNot($own->id))
            ->get();
        $chosen = $request->integer('staff');

        return Inertia::render('Staff/LeaveForm', [
            'mode' => 'give',
            'currency' => $company->default_currency,
            'types' => StaffLeave::TYPES,
            'staff' => $staff->map(fn (StaffMember $member) => [
                ...self::personDetails($member),
                'joinedOn' => $member->joined_on->toDateString(),
                'leftOn' => $member->left_on?->toDateString(),
                'grossSalary' => $member->grossSalary(),
            ]),
            'defaults' => ['staff_member_id' => $staff->contains('id', $chosen) ? $chosen : null],
            'today' => $company->localNow()->toDateString(),
        ]);
    }

    /**
     * Give one of the staff leave, approved as paid or unpaid as it is saved.
     */
    public function store(StaffLeaveRequest $request): RedirectResponse
    {
        $member = $request->member();
        $leave = StaffLeave::record($member, $request->safe()->only(['type', 'starts_on', 'ends_on', 'reason']), $request->user(), isRequest: false);
        $leave->approve($request->boolean('is_paid'), null, $request->user());

        return to_route('leave.show', $leave)->with('success', $this->approvedMessage($leave, "{$member->full_name} was given"));
    }

    /**
     * Show one leave: who it is for, its days month by month with what
     * unpaid leave would take off each month's salary, their other leave
     * that year, and the decision, or the buttons to make it.
     */
    public function show(Request $request, StaffLeave $staffLeave): Response
    {
        $this->ensureSameCompany($request, $staffLeave);

        $staffLeave->load(['staffMember' => fn ($query) => $query->withTrashed()->with(self::staffRelations()), 'requestedBy:id,name', 'decidedBy:id,name']);
        $member = $staffLeave->staffMember;
        $gross = $member->grossSalary();
        $salaries = $member->salaryPayments()
            ->whereDate('period', '>=', $staffLeave->starts_on->copy()->startOfMonth())
            ->whereDate('period', '<=', $staffLeave->ends_on->copy()->startOfMonth())
            ->get()
            ->keyBy(fn (SalaryPayment $salary) => $salary->period->format('Y-m'));
        $year = $staffLeave->starts_on->year;
        $others = $member->leaves()->whereKeyNot($staffLeave->id)->with('decidedBy:id,name')->orderByDesc('starts_on')->get();
        $approvedThatYear = $others->where('status', 'approved')->filter(fn (StaffLeave $leave) => $leave->starts_on->year === $year);
        $isOwn = $member->user_id !== null && $member->user_id === $request->user()->id;

        return Inertia::render('Staff/LeaveShow', [
            'currency' => $member->company->default_currency,
            'leave' => [...self::leaveDetails($staffLeave), 'requestedBy' => $staffLeave->requestedBy?->name],
            'staff' => [...StaffMemberController::summaryDetails($member), 'isRemoved' => $member->trashed()],
            'months' => $staffLeave->months()->map(function (array $month) use ($gross, $salaries) {
                $salary = $salaries->get($month['month']->format('Y-m'));

                return [
                    'month' => $month['month']->format('Y-m'),
                    'days' => $month['days'],
                    'daysInMonth' => $month['daysInMonth'],
                    'dayPay' => round($gross / $month['daysInMonth'], 2),
                    'unpaidCost' => round($gross / $month['daysInMonth'] * $month['days'], 2),
                    'salary' => $salary ? ['status' => $salary->status, 'netPay' => (float) $salary->net_pay] : null,
                ];
            }),
            'history' => [
                'year' => $year,
                'paidDays' => (int) $approvedThatYear->where('is_paid', true)->sum('days'),
                'unpaidDays' => (int) $approvedThatYear->where('is_paid', false)->sum('days'),
                'recent' => $others->take(5)->map(fn (StaffLeave $leave) => self::leaveDetails($leave))->values(),
            ],
            'isOwn' => $isOwn,
            'canManage' => Gate::allows('leave.manage') && ! $isOwn && ! $member->trashed(),
        ]);
    }

    /**
     * Approve a request as paid or unpaid.
     */
    public function approve(LeaveDecisionRequest $request, StaffLeave $staffLeave): RedirectResponse
    {
        $staffLeave->approve($request->boolean('is_paid'), $request->validated('decision_note'), $request->user());

        return back()->with('success', $this->approvedMessage($staffLeave, "{$staffLeave->staffMember->full_name}’s leave was approved:"));
    }

    /**
     * Turn a request down.
     */
    public function reject(LeaveDecisionRequest $request, StaffLeave $staffLeave): RedirectResponse
    {
        $staffLeave->reject($request->validated('decision_note'), $request->user());

        return back()->with('success', "{$staffLeave->staffMember->full_name}’s leave request was rejected. Nothing was marked in attendance.");
    }

    /**
     * Call off leave: a request still waiting, or approved leave, whose days
     * are cleared from attendance and whose months' salaries not yet paid
     * are worked out again.
     *
     * @throws ValidationException When the leave was rejected or cancelled already, or is the user's own.
     */
    public function cancel(Request $request, StaffLeave $staffLeave): RedirectResponse
    {
        $this->ensureSameCompany($request, $staffLeave);

        $member = $staffLeave->staffMember;

        if (! in_array($staffLeave->status, StaffLeave::ACTIVE_STATUSES, true)) {
            throw ValidationException::withMessages(['leave' => "This leave is {$staffLeave->status} already."]);
        }

        if ($member === null || ($member->user_id !== null && $member->user_id === $request->user()->id)) {
            throw ValidationException::withMessages(['leave' => $member === null ? 'This staff member was removed, so their leave cannot be changed.' : 'Someone else must cancel your own leave.']);
        }

        $wasApproved = $staffLeave->isApproved();
        $staffLeave->cancel($request->user());

        $message = $wasApproved
            ? "{$member->full_name}’s leave was cancelled and its days were cleared from attendance."
            : "{$member->full_name}’s leave request was cancelled.";

        return back()->with('success', $message.($wasApproved && $staffLeave->is_paid === false ? $this->paidMonthsNote($staffLeave) : ''));
    }

    /**
     * One leave as the leave pages list it.
     *
     * @return array<string, mixed>
     */
    public static function leaveDetails(StaffLeave $leave): array
    {
        return [
            'id' => $leave->id,
            'type' => $leave->type,
            'startsOn' => $leave->starts_on->toDateString(),
            'endsOn' => $leave->ends_on->toDateString(),
            'days' => $leave->days,
            'reason' => $leave->reason,
            'isRequest' => $leave->is_request,
            'status' => $leave->status,
            'isPaid' => $leave->is_paid,
            'decisionNote' => $leave->decision_note,
            'decidedBy' => $leave->decidedBy?->name,
            'decidedOn' => $leave->decided_at?->toDateString(),
            'requestedOn' => $leave->created_at->toDateString(),
        ];
    }

    /**
     * What approving `$leave` did, after `$lead`: how long it is, and for
     * unpaid leave, that its days come off the salary.
     */
    private function approvedMessage(StaffLeave $leave, string $lead): string
    {
        $days = "{$leave->days} ".Str::plural('day', $leave->days);
        $span = "{$leave->starts_on->format('j M Y')} to {$leave->ends_on->format('j M Y')}";

        return $leave->is_paid
            ? "{$lead} {$days} of paid leave, {$span}."
            : "{$lead} {$days} of unpaid leave, {$span}. Those days come off their salary.".$this->paidMonthsNote($leave);
    }

    /**
     * A warning for months of the leave whose salary is already paid and so did not change.
     */
    private function paidMonthsNote(StaffLeave $leave): string
    {
        $months = $leave->paidMonths()->map(fn (CarbonImmutable $month) => $month->format('F Y'));

        return $months->isEmpty() ? '' : " The salary for {$months->join(', ', ' and ')} is already paid, so it did not change; add a deduction there if needed.";
    }
}
