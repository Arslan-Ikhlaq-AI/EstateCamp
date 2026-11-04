<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Requests\StaffLeaveRequest;
use App\Models\StaffLeave;
use App\Models\StaffMember;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A staff member's own leave: everything they asked for or were given and
 * what became of it, asking for more, and withdrawing a request that is
 * still waiting. Someone who manages leave decides each request.
 */
class MyLeaveController extends Controller
{
    use DescribesStaff;

    /**
     * Show the signed-in staff member's leave, newest first, with this
     * year's paid and unpaid days and their next leave.
     */
    public function index(Request $request): Response
    {
        $member = $request->user()->staffMember;

        if (! $member) {
            return Inertia::render('Staff/MyLeave', ['staff' => null]);
        }

        $member->load(self::staffRelations());
        $today = $member->company->localNow()->startOfDay();
        $leaves = $member->leaves()->with('decidedBy:id,name')->orderByDesc('starts_on')->orderByDesc('id')->get();
        $approvedThisYear = $leaves->where('status', 'approved')->filter(fn (StaffLeave $leave) => $leave->starts_on->year === $today->year);
        $next = $leaves->where('status', 'approved')->filter(fn (StaffLeave $leave) => $leave->ends_on->toDateString() >= $today->toDateString())->sortBy('starts_on')->first();

        return Inertia::render('Staff/MyLeave', [
            'staff' => StaffMemberController::summaryDetails($member),
            'today' => $today->toDateString(),
            'leaves' => $leaves->map(fn (StaffLeave $leave) => StaffLeaveController::leaveDetails($leave)),
            'summary' => [
                'year' => $today->year,
                'pending' => $leaves->where('status', 'pending')->count(),
                'paidDays' => (int) $approvedThisYear->where('is_paid', true)->sum('days'),
                'unpaidDays' => (int) $approvedThisYear->where('is_paid', false)->sum('days'),
                'next' => $next ? StaffLeaveController::leaveDetails($next) : null,
            ],
        ]);
    }

    /**
     * The page for asking for leave.
     */
    public function create(Request $request): Response
    {
        $member = $this->signedInMember($request);
        $member->load(self::staffRelations());

        return Inertia::render('Staff/LeaveForm', [
            'mode' => 'ask',
            'currency' => $member->company->default_currency,
            'types' => StaffLeave::TYPES,
            'staff' => [[
                ...self::personDetails($member),
                'joinedOn' => $member->joined_on->toDateString(),
                'leftOn' => $member->left_on?->toDateString(),
                'grossSalary' => $member->grossSalary(),
            ]],
            'defaults' => ['staff_member_id' => $member->id],
            'today' => $member->company->localNow()->toDateString(),
        ]);
    }

    /**
     * Send a leave request, to wait for a decision.
     */
    public function store(StaffLeaveRequest $request): RedirectResponse
    {
        $member = $this->signedInMember($request);

        StaffLeave::record($member, $request->safe()->only(['type', 'starts_on', 'ends_on', 'reason']), $request->user(), isRequest: true);

        return to_route('my.leave')->with('success', 'Your leave request was sent. It shows here as waiting until it is approved or rejected.');
    }

    /**
     * Withdraw a request of theirs that is still waiting.
     *
     * @throws ValidationException When the request was already decided.
     */
    public function cancel(Request $request, StaffLeave $staffLeave): RedirectResponse
    {
        $member = $this->signedInMember($request);

        abort_unless($staffLeave->staff_member_id === $member->id, 404);

        if (! $staffLeave->isPending()) {
            throw ValidationException::withMessages(['leave' => 'Only a request still waiting can be withdrawn. Ask your manager to cancel approved leave.']);
        }

        $staffLeave->cancel($request->user());

        return back()->with('success', 'Your leave request was withdrawn.');
    }

    /**
     * The staff record of the signed-in user; only staff ask for leave.
     */
    private function signedInMember(Request $request): StaffMember
    {
        $member = $request->user()->staffMember;

        abort_if($member === null, 403);

        return $member;
    }
}
