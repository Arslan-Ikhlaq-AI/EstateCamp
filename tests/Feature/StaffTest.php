<?php

use App\Models\Company;
use App\Models\Property;
use App\Models\RegionalOffice;
use App\Models\StaffMember;
use App\Models\StaffRole;
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
    $this->role = fn (string $slug) => StaffRole::where('slug', $slug)->sole();
});

/**
 * A cleaner at the demo camp.
 *
 * @return array<string, mixed>
 */
function staffInput(array $overrides = []): array
{
    return [
        'full_name' => 'Hari Prasad Adhikari',
        'gender' => 'male',
        'nationality' => 'Nepali',
        'work_level' => 'site',
        'staff_role_id' => StaffRole::where('slug', 'cleaner')->value('id'),
        'property_id' => test()->property->id,
        'employment_type' => 'full_time',
        'joined_on' => '2024-03-01',
        'status' => 'active',
        'visa_expiry' => '2027-05-31',
        'basic_salary' => 1500,
        'transport_allowance' => 200,
        'salary_payment_method' => 'bank_transfer',
        'iban' => 'ae07 0331 2345 6789 0123 456',
        ...$overrides,
    ];
}

test('adds a cleaner at a camp with an employee number for the year they joined', function () {
    $this->actingAs($this->admin)
        ->post(route('staff.store'), staffInput())
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $member = StaffMember::sole();

    expect($member->employee_number)->toBe('EMP-2024-0001')
        ->and($member->company_id)->toBe($this->company->id)
        ->and($member->work_level)->toBe('site')
        ->and($member->property_id)->toBe($this->property->id)
        ->and($member->regional_office_id)->toBeNull()
        ->and($member->grossSalary())->toBe(1700.0)
        ->and((float) $member->housing_allowance)->toBe(0.0)
        ->and($member->iban)->toBe('AE070331234567890123456')
        ->and($member->created_by)->toBe($this->admin->id);
});

test('places staff at the head office or a regional office of their own company only', function () {
    $office = RegionalOffice::factory()->for($this->company)->create();
    $otherProperty = Property::factory()->create();
    $otherOffice = RegionalOffice::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('staff.store'), staffInput(['property_id' => $otherProperty->id]))
        ->assertSessionHasErrors('property_id');

    $this->actingAs($this->admin)
        ->post(route('staff.store'), staffInput(['work_level' => 'regional', 'regional_office_id' => $otherOffice->id]))
        ->assertSessionHasErrors('regional_office_id');

    $this->actingAs($this->admin)
        ->post(route('staff.store'), staffInput(['work_level' => 'regional', 'staff_role_id' => ($this->role)('regional_manager')->id, 'regional_office_id' => $office->id]))
        ->assertSessionHasNoErrors();

    // A property sent along with a head office placement is not kept.
    $this->actingAs($this->admin)
        ->post(route('staff.store'), staffInput(['full_name' => 'Maria Santos', 'work_level' => 'head_office', 'staff_role_id' => ($this->role)('head_of_hr_admin')->id]))
        ->assertSessionHasNoErrors();

    expect(StaffMember::where('full_name', 'Hari Prasad Adhikari')->sole()->regional_office_id)->toBe($office->id)
        ->and(StaffMember::where('full_name', 'Maria Santos')->sole()->only(['work_level', 'property_id', 'regional_office_id']))
        ->toBe(['work_level' => 'head_office', 'property_id' => null, 'regional_office_id' => null]);
});

test('someone who resigned needs the day they left, and someone working has none', function () {
    $member = StaffMember::factory()->atProperty($this->property)->create(['joined_on' => '2024-03-01']);

    $this->actingAs($this->admin)
        ->put(route('staff.update', $member), staffInput(['status' => 'resigned']))
        ->assertSessionHasErrors('left_on');

    $this->actingAs($this->admin)
        ->put(route('staff.update', $member), staffInput(['status' => 'resigned', 'left_on' => '2024-02-01']))
        ->assertSessionHasErrors('left_on');

    $this->actingAs($this->admin)
        ->put(route('staff.update', $member), staffInput(['status' => 'resigned', 'left_on' => '2026-10-15']))
        ->assertSessionHasNoErrors();

    expect($member->refresh()->left_on->toDateString())->toBe('2026-10-15');

    $this->actingAs($this->admin)
        ->put(route('staff.update', $member), staffInput(['status' => 'active', 'left_on' => '2026-10-15']))
        ->assertSessionHasNoErrors();

    expect($member->refresh()->left_on)->toBeNull()
        ->and($member->employee_number)->toStartWith('EMP-');
});

test('lists only the company\'s staff, filtered by role and workplace, with what their salaries come to', function () {
    $office = RegionalOffice::factory()->for($this->company)->create();
    StaffMember::factory()->atProperty($this->property)->create(['full_name' => 'Camp cleaner', 'staff_role_id' => ($this->role)('cleaner')->id, 'basic_salary' => 1500]);
    StaffMember::factory()->atOffice($office)->create(['full_name' => 'Regional manager', 'basic_salary' => 15000, 'housing_allowance' => 5000, 'passport_expiry' => '2026-11-10']);
    StaffMember::factory()->for($this->company)->left('2026-09-30')->create(['full_name' => 'Former accountant', 'basic_salary' => 8000, 'visa_expiry' => '2026-10-01']);
    StaffMember::factory()->create(['full_name' => 'Another company\'s guard']);

    $this->actingAs($this->admin)
        ->get(route('staff.index', ['roles' => ['cleaner'], 'workplace' => ["property:{$this->property->id}"]]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Staff/Index')
            ->has('staff.data', 1)
            ->where('staff.data.0.name', 'Camp cleaner')
            ->where('staff.data.0.workplace.name', $this->property->name)
            ->where('summary.active', 2)
            ->where('summary.left', 1)
            ->where('summary.monthlySalaries', 21500)
            ->where('summary.documents.expiring', 1)
            ->where('summary.documents.expired', 0)
        );

    $this->actingAs($this->admin)
        ->get(route('staff.index', ['documents' => ['expiring']]))
        ->assertInertia(fn (Assert $page) => $page->has('staff.data', 1)->where('staff.data.0.name', 'Regional manager')->where('staff.data.0.documentAlert', 'expiring'));
});

test('another company\'s staff member is not found', function () {
    $member = StaffMember::factory()->create();

    $this->actingAs($this->admin)->get(route('staff.show', $member))->assertNotFound();
    $this->actingAs($this->admin)->get(route('staff.edit', $member))->assertNotFound();
    $this->actingAs($this->admin)->put(route('staff.update', $member), staffInput())->assertNotFound();
});

test('every staff page opens for a member of the company', function () {
    $member = StaffMember::factory()->atProperty($this->property)->create();

    foreach ([
        route('staff.index') => 'Staff/Index',
        route('staff.create', ['property' => $this->property->id]) => 'Staff/Form',
        route('staff.show', $member) => 'Staff/Show',
        route('staff.edit', $member) => 'Staff/Form',
        route('attendance.index') => 'Staff/Attendance',
        route('attendance.index', ['view' => 'month', 'month' => '2026-09']) => 'Staff/Attendance',
        route('payroll.index') => 'Staff/Payroll',
        route('configuration.staff-roles') => 'Configuration/Types',
        route('configuration.regional-offices') => 'Configuration/RegionalOffices',
    ] as $url => $component) {
        $this->actingAs($this->admin)->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
    }

    $this->actingAs($this->admin)
        ->get(route('staff.create', ['property' => $this->property->id]))
        ->assertInertia(fn (Assert $page) => $page->where('defaults.work_level', 'site')->where('defaults.property_id', $this->property->id));
});

test('a member of the company manages its regional offices, and one with staff is kept', function () {
    $member = User::factory()->create(['company_id' => $this->company->id, 'is_admin' => false]);

    $this->actingAs($member)
        ->post(route('configuration.regional-offices.store'), ['name' => 'Dubai Region', 'code' => 'dxb', 'city' => 'Dubai'])
        ->assertSessionHasNoErrors();

    $this->actingAs($member)
        ->post(route('configuration.regional-offices.store'), ['name' => 'Dubai Region'])
        ->assertSessionHasErrors('name');

    $office = RegionalOffice::sole();
    StaffMember::factory()->atOffice($office)->create();

    expect($office->code)->toBe('DXB')
        ->and($office->company_id)->toBe($this->company->id);

    $this->actingAs($member)
        ->delete(route('configuration.regional-offices.destroy', $office))
        ->assertSessionHasErrors('office');

    $this->actingAs($member)
        ->put(route('configuration.regional-offices.update', $office), ['name' => 'Dubai Region', 'is_active' => false])
        ->assertSessionHasNoErrors();

    expect($office->refresh()->is_active)->toBeFalse();

    $otherOffice = RegionalOffice::factory()->create();

    $this->actingAs($member)->put(route('configuration.regional-offices.update', $otherOffice), ['name' => 'Taken over'])->assertNotFound();
    $this->actingAs($member)->delete(route('configuration.regional-offices.destroy', $otherOffice))->assertNotFound();
});

test('lets an admin add a staff role at a level, and keeps one in use', function () {
    $member = User::factory()->create(['company_id' => $this->company->id, 'is_admin' => false]);

    $this->actingAs($member)
        ->post(route('configuration.staff-roles.store'), ['name' => 'Driver', 'level' => 'site', 'staff_access' => 'self'])
        ->assertForbidden();

    $this->actingAs($this->admin)
        ->post(route('configuration.staff-roles.store'), ['name' => 'Driver', 'level' => 'floor', 'staff_access' => 'owner'])
        ->assertSessionHasErrors(['level', 'staff_access']);

    $this->actingAs($this->admin)
        ->post(route('configuration.staff-roles.store'), ['name' => 'Driver', 'level' => 'site', 'staff_access' => 'self', 'app_access' => '1'])
        ->assertSessionHasNoErrors();

    $role = StaffRole::where('name', 'Driver')->sole();
    StaffMember::factory()->atProperty($this->property)->create(['staff_role_id' => $role->id]);

    expect($role->slug)->toBe('driver')
        ->and($role->level)->toBe('site')
        ->and($role->staff_access)->toBe('self')
        ->and($role->app_access)->toBeTrue();

    $this->actingAs($this->admin)
        ->delete(route('configuration.staff-roles.destroy', $role))
        ->assertSessionHasErrors('type');

    $this->actingAs($member)
        ->get(route('configuration.staff-roles'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('kind', 'staffRole')
            ->where('types', fn ($types) => collect($types)->firstWhere('slug', 'driver')['usage'] === 1 && collect($types)->firstWhere('slug', 'cleaner')['level'] === 'site')
        );
});

test('a document running out soon raises a notification', function () {
    $member = StaffMember::factory()->atProperty($this->property)->create(['visa_expiry' => '2026-11-05', 'emirates_id_expiry' => '2026-10-20']);
    StaffMember::factory()->atProperty($this->property)->left()->create(['visa_expiry' => '2026-10-01']);

    $this->actingAs($this->admin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('notifications', function ($notifications) use ($member) {
            $staff = collect($notifications)->filter(fn (array $notification) => str_starts_with($notification['type'], 'staff_document'));

            return $staff->count() === 2
                && $staff->firstWhere('subject', 'visa')['days'] === 14
                && $staff->firstWhere('subject', 'emirates_id')['type'] === 'staff_document_expired'
                && $staff->every(fn (array $notification) => $notification['url'] === route('staff.show', $member->id));
        }));
});
