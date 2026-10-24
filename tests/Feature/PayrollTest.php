<?php

use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
});

/**
 * Mark `$member` with `$status` on each of `$days`.
 *
 * @param  list<string>  $days
 */
function markAttendance(StaffMember $member, string $status, array $days): void
{
    foreach ($days as $day) {
        StaffAttendance::factory()->for($member)->create(['company_id' => $member->company_id, 'work_date' => $day, 'status' => $status]);
    }
}

test('saves a day\'s attendance sheet, replacing what was marked before', function () {
    $member = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2026-01-01']);
    $newcomer = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2026-10-21']);
    $stranger = StaffMember::factory()->create();
    $sheet = fn (StaffMember $person, array $entry = []) => ['work_date' => '2026-10-20', 'entries' => [['staff_member_id' => $person->id, 'status' => 'present', ...$entry]]];

    $this->actingAs($this->admin)
        ->post(route('attendance.store'), $sheet($member, ['check_in' => '19:00', 'check_out' => '07:00']))
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('attendance.store'), $sheet($member, ['status' => 'absent', 'note' => 'No call, no show']))
        ->assertSessionHasNoErrors();

    $attendance = StaffAttendance::sole();

    expect($attendance->status)->toBe('absent')
        ->and($attendance->check_in)->toBeNull()
        ->and($attendance->note)->toBe('No call, no show')
        ->and($attendance->recorded_by)->toBe($this->admin->id);

    $this->actingAs($this->admin)->post(route('attendance.store'), [...$sheet($member), 'work_date' => '2026-10-23'])->assertSessionHasErrors('work_date');
    $this->actingAs($this->admin)->post(route('attendance.store'), $sheet($newcomer))->assertSessionHasErrors('entries.0.staff_member_id');
    $this->actingAs($this->admin)->post(route('attendance.store'), $sheet($stranger))->assertSessionHasErrors('entries.0.staff_member_id');
    $this->actingAs($this->admin)->post(route('attendance.store'), $sheet($member, ['status' => 'sleeping']))->assertSessionHasErrors('entries.0.status');

    $this->actingAs($this->admin)
        ->get(route('attendance.index', ['date' => '2026-10-20', 'workplace' => "property:{$this->property->id}"]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/Attendance')
            ->has('sheet', 1)
            ->where('sheet.0.id', $member->id)
            ->where('sheet.0.attendance.status', 'absent')
        );

    $this->actingAs($this->admin)
        ->get(route('attendance.index', ['view' => 'month', 'month' => '2026-10']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('register.days', 31)
            ->has('register.rows', 2)
            ->where('register.rows', function ($rows) use ($member) {
                $row = collect($rows)->firstWhere('id', $member->id);

                return $row['marks'][20] === 'absent' && $row['counts']['absent'] === 1;
            })
        );
});

test('works out each salary for the days employed, less absences', function () {
    // September 2026 has 30 days, so a salary of 3,000 is 100 a day.
    $full = StaffMember::factory()->atProperty($this->property)->create(['full_name' => 'Full month', 'joined_on' => '2025-01-01', 'basic_salary' => 2500, 'transport_allowance' => 500]);
    $joiner = StaffMember::factory()->atProperty($this->property)->create(['full_name' => 'Joined mid-month', 'joined_on' => '2026-09-11', 'basic_salary' => 3000]);
    $leaver = StaffMember::factory()->for($this->company)->left('2026-09-10')->create(['full_name' => 'Left mid-month', 'joined_on' => '2025-01-01', 'basic_salary' => 3000]);
    StaffMember::factory()->for($this->company)->left('2026-08-31')->create(['full_name' => 'Left before']);
    StaffMember::factory()->create(['full_name' => 'Another company']);

    markAttendance($full, 'absent', ['2026-09-03', '2026-09-17']);
    markAttendance($full, 'half_day', ['2026-09-08']);
    markAttendance($full, 'leave', ['2026-09-09']);
    markAttendance($full, 'day_off', ['2026-09-04']);
    // Outside the month, so not counted.
    markAttendance($full, 'absent', ['2026-10-01']);

    $this->actingAs($this->admin)
        ->post(route('payroll.store'), ['month' => '2026-09'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('payroll.index', ['month' => '2026-09']));

    $salary = fn (StaffMember $member) => SalaryPayment::where('staff_member_id', $member->id)->sole();

    expect(SalaryPayment::count())->toBe(3)
        ->and($salary($full)->only(['payable_days', 'days_in_month', 'status']))->toBe(['payable_days' => 30, 'days_in_month' => 30, 'status' => 'pending'])
        ->and((float) $salary($full)->earned_salary)->toBe(3000.0)
        ->and((float) $salary($full)->absence_deduction)->toBe(250.0)
        ->and((float) $salary($full)->net_pay)->toBe(2750.0)
        ->and($salary($full)->attendance_counts)->toMatchArray(['absent' => 2, 'half_day' => 1, 'leave' => 1, 'day_off' => 1])
        ->and($salary($joiner)->payable_days)->toBe(20)
        ->and((float) $salary($joiner)->net_pay)->toBe(2000.0)
        ->and($salary($leaver)->payable_days)->toBe(10)
        ->and((float) $salary($leaver)->net_pay)->toBe(1000.0);

    $this->actingAs($this->admin)
        ->get(route('payroll.index', ['month' => '2026-09']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/Payroll')
            ->has('salaries', 3)
            ->where('summary.net', 5750)
            ->where('summary.pending.count', 3)
            ->where('notPrepared', 0)
        );
});

test('preparing again picks up new attendance and staff, keeping additions and paid salaries', function () {
    $full = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2025-01-01', 'basic_salary' => 3000]);
    $paid = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2025-01-01', 'basic_salary' => 3000, 'salary_payment_method' => 'cash']);

    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-09'])->assertSessionHasNoErrors();

    $fullSalary = SalaryPayment::where('staff_member_id', $full->id)->sole();
    $paidSalary = SalaryPayment::where('staff_member_id', $paid->id)->sole();

    $this->actingAs($this->admin)
        ->put(route('payroll.update', $fullSalary), ['additions' => 300, 'deductions' => 5000])
        ->assertSessionHasErrors('deductions');

    $this->actingAs($this->admin)
        ->put(route('payroll.update', $fullSalary), ['additions' => 300, 'deductions' => 100, 'note' => 'Overtime, less advance'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('payroll.pay', $paidSalary), ['paid_on' => '2026-10-01'])
        ->assertSessionHasNoErrors();

    expect((float) $fullSalary->refresh()->net_pay)->toBe(3200.0)
        ->and($paidSalary->refresh()->isPaid())->toBeTrue()
        ->and($paidSalary->payment_method)->toBe('cash')
        ->and($paidSalary->paid_by)->toBe($this->admin->id);

    markAttendance($full, 'absent', ['2026-09-14']);
    markAttendance($paid, 'absent', ['2026-09-14']);
    $paid->update(['basic_salary' => 9000]);
    $newcomer = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2026-09-21', 'basic_salary' => 3000]);

    $this->actingAs($this->admin)
        ->get(route('payroll.index', ['month' => '2026-09']))
        ->assertInertia(fn (Assert $page) => $page->where('notPrepared', 1));

    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-09'])->assertSessionHasNoErrors();

    expect((float) $fullSalary->refresh()->net_pay)->toBe(3100.0)
        ->and((float) $fullSalary->additions)->toBe(300.0)
        ->and($fullSalary->note)->toBe('Overtime, less advance')
        ->and((float) $paidSalary->refresh()->net_pay)->toBe(3000.0)
        ->and((float) SalaryPayment::where('staff_member_id', $newcomer->id)->sole()->net_pay)->toBe(1000.0);

    $this->actingAs($this->admin)->put(route('payroll.update', $paidSalary), ['additions' => 50])->assertSessionHasErrors('salary');
    $this->actingAs($this->admin)->post(route('payroll.pay', $paidSalary), ['paid_on' => '2026-10-02'])->assertSessionHasErrors('salary');

    $this->actingAs($this->admin)
        ->post(route('payroll.pay-all'), ['month' => '2026-09', 'paid_on' => '2026-10-02', 'payment_method' => 'bank_transfer', 'reference' => 'WPS-202609'])
        ->assertSessionHasNoErrors();

    expect(SalaryPayment::where('status', 'pending')->count())->toBe(0)
        ->and($fullSalary->refresh()->reference)->toBe('WPS-202609')
        ->and($paidSalary->refresh()->paid_on->toDateString())->toBe('2026-10-01');

    $this->actingAs($this->admin)->post(route('payroll.pay-all'), ['month' => '2026-09', 'paid_on' => '2026-10-02'])->assertSessionHasErrors('salary');

    $this->actingAs($this->admin)->post(route('payroll.unpay', $fullSalary))->assertSessionHasNoErrors();

    expect($fullSalary->refresh()->isPaid())->toBeFalse()
        ->and($fullSalary->paid_on)->toBeNull();
});

test('a payroll cannot be prepared for a month still to come, nor another company\'s salary touched', function () {
    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => '2026-11'])->assertSessionHasErrors('month');
    $this->actingAs($this->admin)->post(route('payroll.store'), ['month' => 'September'])->assertSessionHasErrors('month');

    $stranger = StaffMember::factory()->create(['joined_on' => '2025-01-01']);
    SalaryPayment::prepareMonth($stranger->company, now()->subMonth());
    $salary = SalaryPayment::sole();

    $this->actingAs($this->admin)->put(route('payroll.update', $salary), ['additions' => 100])->assertNotFound();
    $this->actingAs($this->admin)->post(route('payroll.pay', $salary), ['paid_on' => '2026-10-01'])->assertNotFound();
    $this->actingAs($this->admin)->post(route('payroll.unpay', $salary))->assertNotFound();

    $this->actingAs($this->admin)
        ->get(route('payroll.index', ['month' => '2026-09']))
        ->assertInertia(fn (Assert $page) => $page->has('salaries', 0));
});
