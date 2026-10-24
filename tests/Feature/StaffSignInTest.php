<?php

use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use App\Models\StaffRole;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Support\Facades\Hash;
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
function staffSignIn(string $access, bool $appAccess = false, array $attributes = []): User
{
    $member = StaffMember::factory()->atProperty(test()->property)->create(['joined_on' => '2025-01-01', 'email' => fake()->unique()->safeEmail(), ...$attributes]);
    $member->syncSignIn(true, $access, $appAccess, 'password');

    return $member->user;
}

/**
 * A cleaner added on the staff form, with a sign-in.
 *
 * @return array<string, mixed>
 */
function signInInput(array $overrides = []): array
{
    return [
        'full_name' => 'Hari Prasad Adhikari',
        'gender' => 'male',
        'email' => 'hari@horizonfm.test',
        'work_level' => 'site',
        'staff_role_id' => StaffRole::where('slug', 'cleaner')->value('id'),
        'property_id' => test()->property->id,
        'employment_type' => 'full_time',
        'joined_on' => '2024-03-01',
        'status' => 'active',
        'basic_salary' => 1500,
        'can_sign_in' => true,
        'access' => 'self',
        'password' => 'Camp-Cleaner-2026',
        ...$overrides,
    ];
}

test('gives a staff member a sign-in from their form, keeps its password, and removes it', function () {
    $this->actingAs($this->admin)->post(route('staff.store'), signInInput(['password' => null]))->assertSessionHasErrors('password');
    $this->actingAs($this->admin)->post(route('staff.store'), signInInput(['email' => $this->admin->email]))->assertSessionHasErrors('email');

    $this->actingAs($this->admin)->post(route('staff.store'), signInInput())->assertSessionHasNoErrors();

    $member = StaffMember::sole();
    $user = $member->user;

    expect($user->email)->toBe('hari@horizonfm.test')
        ->and($user->name)->toBe('Hari Prasad Adhikari')
        ->and($user->company_id)->toBe($this->company->id)
        ->and($user->is_admin)->toBeFalse()
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and(Hash::check('Camp-Cleaner-2026', $user->password))->toBeTrue()
        ->and($member->access)->toBe('self');

    // Saving again without a password keeps it, and the account follows the name and email.
    $this->actingAs($this->admin)
        ->put(route('staff.update', $member), signInInput(['full_name' => 'Hari Adhikari', 'email' => 'hari.a@horizonfm.test', 'password' => null, 'access' => 'supervisor']))
        ->assertSessionHasNoErrors();

    expect($user->refresh()->only(['name', 'email']))->toBe(['name' => 'Hari Adhikari', 'email' => 'hari.a@horizonfm.test'])
        ->and(Hash::check('Camp-Cleaner-2026', $user->password))->toBeTrue()
        ->and($member->refresh()->access)->toBe('supervisor');

    $this->actingAs($this->admin)->put(route('staff.update', $member), signInInput(['can_sign_in' => false, 'password' => null]))->assertSessionHasNoErrors();

    expect(User::find($user->id))->toBeNull()
        ->and($member->refresh()->only(['user_id', 'access']))->toBe(['user_id' => null, 'access' => null]);
});

test('a sign-in for their own pages only opens their attendance and pay', function () {
    $user = staffSignIn('self');

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('my.index'));

    foreach (['properties.index', 'staff.index', 'attendance.index', 'payroll.index', 'maintenance.index', 'configuration.company'] as $routeName) {
        $this->actingAs($user)->get(route($routeName))->assertForbidden();
    }

    $this->actingAs($user)
        ->get(route('my.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/Me')
            ->where('staff.id', $user->staffMember->id)
            ->where('auth.access', ['app' => false, 'staff' => 'self', 'self' => true])
            ->where('notifications', [])
            ->missing('auth.user.staff_member')
        );
});

test('a supervisor sees every staff member and marks attendance, but cannot change staff or pay', function () {
    $user = staffSignIn('supervisor');
    $colleague = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2025-01-01']);
    SalaryPayment::prepareMonth($this->company, now()->subMonth());

    $this->actingAs($user)->get(route('staff.index'))->assertOk();
    $this->actingAs($user)->get(route('staff.show', $colleague))->assertOk()->assertInertia(fn (Assert $page) => $page->where('canManage', false));
    $this->actingAs($user)->get(route('payroll.index', ['month' => '2026-09']))->assertOk()->assertInertia(fn (Assert $page) => $page->has('salaries', 2)->where('canManage', false));

    $this->actingAs($user)
        ->post(route('attendance.store'), ['work_date' => '2026-10-22', 'entries' => [['staff_member_id' => $colleague->id, 'status' => 'absent']]])
        ->assertSessionHasNoErrors();

    expect(StaffAttendance::where('staff_member_id', $colleague->id)->value('status'))->toBe('absent');

    $this->actingAs($user)->get(route('staff.create'))->assertForbidden();
    $this->actingAs($user)->get(route('staff.edit', $colleague))->assertForbidden();
    $this->actingAs($user)->post(route('payroll.store'), ['month' => '2026-09'])->assertForbidden();
    $this->actingAs($user)->post(route('payroll.pay', SalaryPayment::first()), ['paid_on' => '2026-10-01'])->assertForbidden();
    $this->actingAs($user)->get(route('properties.index'))->assertForbidden();
});

test('a staff admin adds staff and pays salaries, and opens the rest of the app only with access to it', function () {
    $staffAdmin = staffSignIn('admin');
    $officeAdmin = staffSignIn('admin', appAccess: true);

    $this->actingAs($staffAdmin)->get(route('staff.create'))->assertOk();
    $this->actingAs($staffAdmin)->post(route('payroll.store'), ['month' => '2026-09'])->assertSessionHasNoErrors();
    $this->actingAs($staffAdmin)->get(route('properties.index'))->assertForbidden();
    $this->actingAs($officeAdmin)->get(route('properties.index'))->assertOk();

    // Only someone who uses the rest of the app can open it to another sign-in.
    $this->actingAs($staffAdmin)->post(route('staff.store'), signInInput(['app_access' => true]))->assertSessionHasErrors('app_access');
    $this->actingAs($officeAdmin)->post(route('staff.store'), signInInput(['app_access' => true]))->assertSessionHasNoErrors();
});

test('checks in and out in the company\'s time, and a night shift checks out the next morning', function () {
    $user = staffSignIn('self');
    $member = $user->staffMember;

    $this->actingAs($user)->post(route('my.check-out'))->assertSessionHasErrors('attendance');
    $this->actingAs($user)->post(route('my.check-in'))->assertSessionHasNoErrors();
    $this->actingAs($user)->post(route('my.check-in'))->assertSessionHasErrors('attendance');

    $this->travel(3)->hours();
    $this->actingAs($user)->post(route('my.check-out'))->assertSessionHasNoErrors();

    $today = $member->attendances()->sole();

    expect($today->work_date->toDateString())->toBe('2026-10-22')
        ->and($today->status)->toBe('present')
        ->and(StaffAttendance::shortTime($today->check_in))->toBe('14:00')
        ->and(StaffAttendance::shortTime($today->check_out))->toBe('17:00')
        ->and($today->recorded_by)->toBe($user->id);

    // 19:00 in Dubai on the 23rd, then 07:00 on the 24th.
    $this->travelTo(now()->setDate(2026, 10, 23)->setTime(15, 0));
    $this->actingAs($user)->post(route('my.check-in'))->assertSessionHasNoErrors();
    $this->travelTo(now()->setDate(2026, 10, 24)->setTime(3, 0));

    $this->actingAs($user)
        ->get(route('my.index'))
        ->assertInertia(fn (Assert $page) => $page->where('today.date', '2026-10-24')->where('today.openShift.date', '2026-10-23')->where('today.canCheckIn', false));

    $this->actingAs($user)->post(route('my.check-out'))->assertSessionHasNoErrors();

    $nightShift = $member->attendances()->whereDate('work_date', '2026-10-23')->sole();

    expect(StaffAttendance::shortTime($nightShift->check_in))->toBe('19:00')
        ->and(StaffAttendance::shortTime($nightShift->check_out))->toBe('07:00')
        ->and($member->attendances()->whereDate('work_date', '2026-10-24')->exists())->toBeFalse();

    // A day the supervisor marked otherwise cannot be checked into.
    StaffAttendance::factory()->for($member)->create(['company_id' => $member->company_id, 'work_date' => '2026-10-24', 'status' => 'day_off']);

    $this->actingAs($user)->post(route('my.check-in'))->assertSessionHasErrors('attendance');
});

test('shows a staff member their own month of attendance and only their own salaries', function () {
    $user = staffSignIn('self', attributes: ['basic_salary' => 3000]);
    StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2025-01-01']);
    StaffAttendance::factory()->for($user->staffMember)->create(['company_id' => $this->company->id, 'work_date' => '2026-09-14', 'status' => 'absent']);
    SalaryPayment::prepareMonth($this->company, now()->subMonth());
    SalaryPayment::where('staff_member_id', $user->staffMember->id)->sole()->markPaid(now(), 'cash', null);

    $this->actingAs($user)
        ->get(route('my.index', ['month' => '2026-09']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('attendance.month', '2026-09')
            ->where('attendance.counts.absent', 1)
            ->has('salaries', 1)
            ->where('salaries.0.status', 'paid')
            ->where('salaries.0.netPay', 2900)
        );

    // A month before they joined opens on the month they joined.
    $this->actingAs($user)
        ->get(route('my.index', ['month' => '2019-01']))
        ->assertInertia(fn (Assert $page) => $page->where('attendance.month', '2025-01'));
});

test('a staff member who has left is signed out', function () {
    $user = staffSignIn('self', attributes: ['status' => 'resigned', 'left_on' => '2026-10-21']);

    $this->actingAs($user)
        ->get(route('my.index'))
        ->assertRedirect(route('login'))
        ->assertSessionHas('status');

    $this->assertGuest();
});
