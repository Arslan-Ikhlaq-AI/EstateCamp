<?php

use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffLeave;
use App\Models\StaffMember;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Support\Collection;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // 10:00 in UTC is 14:00 in Dubai, the demo company's time zone.
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
});

/**
 * A camp worker with a sign-in of `$access`, returning the account they log in with.
 */
function leaveSignIn(string $access, array $attributes = []): User
{
    $member = StaffMember::factory()->atProperty(test()->property)->create(['joined_on' => '2025-01-01', 'email' => fake()->unique()->safeEmail(), ...$attributes]);
    $member->syncSignIn(true, $access, false, 'password');

    return $member->user;
}

/**
 * `$member`'s salary for the month starting on `$period`.
 */
function salaryFor(StaffMember $member, string $period): SalaryPayment
{
    return SalaryPayment::where('staff_member_id', $member->id)->whereDate('period', $period)->sole();
}

test('a staff member asks for leave, and approving it as unpaid takes those days off the salary', function () {
    // October 2026 has 31 days, so a salary of 3,100 is 100 a day.
    $user = leaveSignIn('self', ['basic_salary' => 3100]);
    $member = $user->staffMember;
    $request = fn (array $input) => $this->actingAs($user)->post(route('my.leave.store'), ['type' => 'annual', ...$input]);

    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-10'])->assertSessionHasNoErrors();

    $request(['type' => 'emergency', 'starts_on' => '2026-10-26', 'ends_on' => '2026-11-04', 'reason' => 'Family wedding'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('my.leave'));

    $leave = StaffLeave::sole();

    expect($leave->only(['staff_member_id', 'status', 'days', 'is_request', 'is_paid', 'requested_by']))
        ->toBe(['staff_member_id' => $member->id, 'status' => 'pending', 'days' => 10, 'is_request' => true, 'is_paid' => null, 'requested_by' => $user->id])
        ->and($member->attendances()->count())->toBe(0);

    $request(['starts_on' => '2026-11-01', 'ends_on' => '2026-11-10'])->assertSessionHasErrors('starts_on');
    $request(['starts_on' => '2024-12-20', 'ends_on' => '2025-01-05'])->assertSessionHasErrors('starts_on');
    $request(['starts_on' => '2026-12-10', 'ends_on' => '2026-12-01'])->assertSessionHasErrors('ends_on');
    $request(['starts_on' => '2026-12-01', 'ends_on' => '2027-12-31'])->assertSessionHasErrors('ends_on');

    $this->actingAs($this->admin)
        ->get(route('leave.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/Leave')
            ->where('filter', 'pending')
            ->where('counts.pending', 1)
            ->where('leaves.data.0.id', $leave->id)
            ->where('notifications', fn (Collection $notifications) => $notifications->contains(fn (array $notification) => $notification['type'] === 'leave_requested' && $notification['days'] === 4 && $notification['length'] === 10))
        );

    $this->actingAs($this->admin)
        ->post(route('leave.approve', $leave), ['is_paid' => false, 'decision_note' => 'Safe travels'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success');

    $october = salaryFor($member, '2026-10-01');

    expect($leave->fresh()->only(['status', 'is_paid', 'decision_note', 'decided_by']))->toBe(['status' => 'approved', 'is_paid' => false, 'decision_note' => 'Safe travels', 'decided_by' => $this->admin->id])
        ->and($member->attendances()->where('status', 'unpaid_leave')->where('staff_leave_id', $leave->id)->count())->toBe(10)
        ->and($october->attendance_counts)->toMatchArray(['unpaid_leave' => 6])
        ->and((float) $october->absence_deduction)->toBe(600.0)
        ->and((float) $october->net_pay)->toBe(2500.0);

    $this->actingAs($user)
        ->get(route('my.leave'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/MyLeave')
            ->where('leaves.0.status', 'approved')
            ->where('summary.unpaidDays', 10)
            ->where('summary.next.id', $leave->id)
            ->where('notifications.0.type', 'leave_approved')
            ->where('notifications.0.subject', 'unpaid')
        );

    $this->travelTo(now()->setDate(2026, 10, 27)->setTime(10, 0));
    $this->actingAs($user)->post(route('my.check-in'))->assertSessionHasErrors('attendance');
});

test('a manager gives leave without a request, and cancelling it clears its days and restores the salary', function () {
    $member = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2025-01-01', 'basic_salary' => 3100]);
    $give = fn (array $input) => $this->actingAs($this->admin)->post(route('leave.store'), ['staff_member_id' => $member->id, 'type' => 'annual', ...$input]);

    $give(['starts_on' => '2026-10-05', 'ends_on' => '2026-10-09'])->assertSessionHasErrors('is_paid');
    $give(['starts_on' => '2026-10-05', 'ends_on' => '2026-10-09', 'is_paid' => true])->assertSessionHasNoErrors();

    $paidLeave = StaffLeave::sole();

    expect($paidLeave->only(['status', 'is_paid', 'is_request', 'decided_by']))->toBe(['status' => 'approved', 'is_paid' => true, 'is_request' => false, 'decided_by' => $this->admin->id])
        ->and($member->attendances()->where('status', 'leave')->count())->toBe(5);

    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-09']);
    $this->actingAs($this->admin)->post(route('payroll.pay', salaryFor($member, '2026-09-01')), ['paid_on' => '2026-10-01']);
    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-10']);

    expect((float) salaryFor($member, '2026-10-01')->net_pay)->toBe(3100.0);

    // Two days in September, whose salary is paid already, and three in October.
    $give(['starts_on' => '2026-09-29', 'ends_on' => '2026-10-03', 'is_paid' => false])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', fn (string $message) => str_contains($message, 'September 2026 is already paid'));

    $unpaidLeave = StaffLeave::latest('id')->first();

    expect((float) salaryFor($member, '2026-09-01')->net_pay)->toBe(3100.0)
        ->and((float) salaryFor($member, '2026-10-01')->absence_deduction)->toBe(300.0);

    $give(['starts_on' => '2026-10-09', 'ends_on' => '2026-10-12', 'is_paid' => true])->assertSessionHasErrors('starts_on');

    $this->actingAs($this->admin)->post(route('leave.cancel', $unpaidLeave))->assertSessionHasNoErrors();

    expect($unpaidLeave->fresh()->status)->toBe('cancelled')
        ->and($member->attendances()->where('staff_leave_id', $unpaidLeave->id)->count())->toBe(0)
        ->and($member->attendances()->where('status', 'leave')->count())->toBe(5)
        ->and((float) salaryFor($member, '2026-10-01')->net_pay)->toBe(3100.0);

    $this->actingAs($this->admin)->post(route('leave.cancel', $unpaidLeave))->assertSessionHasErrors('leave');
});

test('a rejected request marks nothing, and staff withdraw only their own requests still waiting', function () {
    $user = leaveSignIn('self');
    $member = $user->staffMember;
    $toReject = StaffLeave::factory()->for($member)->create(['requested_by' => $user->id]);
    $waiting = StaffLeave::factory()->for($member)->create(['starts_on' => '2026-12-01', 'ends_on' => '2026-12-05', 'requested_by' => $user->id]);
    $colleagues = StaffLeave::factory()->for(StaffMember::factory()->atProperty($this->property))->create();

    $this->actingAs($this->admin)->post(route('leave.approve', $waiting))->assertSessionHasErrors('is_paid');
    $this->actingAs($this->admin)->post(route('leave.reject', $toReject), ['decision_note' => 'Too many away that week.'])->assertSessionHasNoErrors();

    expect($toReject->fresh()->only(['status', 'is_paid', 'decision_note']))->toBe(['status' => 'rejected', 'is_paid' => null, 'decision_note' => 'Too many away that week.'])
        ->and($member->attendances()->count())->toBe(0);

    $this->actingAs($this->admin)->post(route('leave.approve', $toReject), ['is_paid' => true])->assertSessionHasErrors('leave');

    $this->actingAs($user)->post(route('my.leave.cancel', $toReject))->assertSessionHasErrors('leave');
    $this->actingAs($user)->post(route('my.leave.cancel', $colleagues))->assertNotFound();
    $this->actingAs($user)->post(route('my.leave.cancel', $waiting))->assertSessionHasNoErrors();

    expect($waiting->fresh()->status)->toBe('cancelled')
        ->and($colleagues->fresh()->status)->toBe('pending');
});

test('a supervisor sees leave but cannot decide it, and no one decides or gives their own', function () {
    $self = leaveSignIn('self');
    $supervisor = leaveSignIn('supervisor');
    $staffAdmin = leaveSignIn('admin');
    $leave = StaffLeave::factory()->for(StaffMember::factory()->atProperty($this->property))->create();
    $own = StaffLeave::factory()->for($staffAdmin->staffMember)->create();
    $elsewhere = StaffLeave::factory()->create();
    $giveOwn = ['staff_member_id' => $staffAdmin->staffMember->id, 'type' => 'annual', 'starts_on' => '2026-12-01', 'ends_on' => '2026-12-05', 'is_paid' => true];

    $this->actingAs($self)->get(route('leave.index'))->assertForbidden();

    $this->actingAs($supervisor)->get(route('leave.index'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('canManage', false));
    $this->actingAs($supervisor)->get(route('leave.show', $leave))->assertOk()->assertInertia(fn (Assert $page) => $page->component('Staff/LeaveShow')->where('canManage', false));
    $this->actingAs($supervisor)->get(route('leave.create'))->assertForbidden();
    $this->actingAs($supervisor)->post(route('leave.approve', $leave), ['is_paid' => true])->assertForbidden();

    $this->actingAs($staffAdmin)->post(route('leave.approve', $own), ['is_paid' => true])->assertSessionHasErrors('leave');
    $this->actingAs($staffAdmin)->post(route('leave.cancel', $own))->assertSessionHasErrors('leave');
    $this->actingAs($staffAdmin)->post(route('leave.store'), $giveOwn)->assertSessionHasErrors('staff_member_id');
    $this->actingAs($staffAdmin)->post(route('leave.approve', $leave), ['is_paid' => true])->assertSessionHasNoErrors();

    expect($own->fresh()->status)->toBe('pending')
        ->and($leave->fresh()->status)->toBe('approved');

    $this->actingAs($this->admin)->get(route('leave.show', $elsewhere))->assertNotFound();
    $this->actingAs($this->admin)->post(route('leave.store'), [...$giveOwn, 'staff_member_id' => $elsewhere->staff_member_id])->assertSessionHasErrors('staff_member_id');
});
