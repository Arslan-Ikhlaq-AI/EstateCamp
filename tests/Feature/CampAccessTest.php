<?php

use App\Models\Company;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Occupancy;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\StaffMember;
use App\Models\User;
use App\Models\UserRole;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->alQuoz = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->jebelAli = $this->company->properties()->where('code', PropertySeeder::JEBEL_ALI)->sole();
});

/**
 * A user of the demo company with a camp role, looking after `$camps`.
 *
 * @param  list<Property>  $camps
 */
function campUser(string $role, array $camps): User
{
    $user = User::factory()->create(['company_id' => test()->company->id, 'user_role_id' => UserRole::builtIn($role)->id]);
    $user->properties()->sync(collect($camps)->pluck('id'));

    return $user;
}

test('shows a camp boss only their camp, and everything at it', function () {
    $boss = campUser(UserRole::CAMP_BOSS, [$this->alQuoz]);
    // Looked up before signing in, which narrows the test's own queries too.
    $otherRoom = $this->jebelAli->rooms()->firstOrFail();
    StaffMember::factory()->atProperty($this->alQuoz)->create();
    StaffMember::factory()->atProperty($this->jebelAli)->create();

    $this->actingAs($boss)
        ->get(route('properties.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('properties.data', fn ($properties) => $properties->pluck('id')->all() === [$this->alQuoz->id]));

    $this->actingAs($boss)->get(route('properties.show', $this->alQuoz))->assertOk();
    $this->actingAs($boss)->get(route('properties.show', $this->jebelAli))->assertNotFound();
    $this->actingAs($boss)->get(route('rooms.edit', $otherRoom))->assertNotFound();

    // Every query made while they are signed in stops at their camp.
    expect(Property::pluck('id')->all())->toBe([$this->alQuoz->id])
        ->and(Room::query()->pluck('property_id')->unique()->values()->all())->toBe([$this->alQuoz->id])
        ->and(Contract::query()->get()->every(fn (Contract $contract) => $contract->lines()->where('property_id', $this->alQuoz->id)->exists()))->toBeTrue()
        ->and(Invoice::query()->with('contract.lines')->get()->every(fn (Invoice $invoice) => $invoice->contract->lines->contains('property_id', $this->alQuoz->id)))->toBeTrue()
        ->and(Occupancy::query()->with('room')->get()->every(fn (Occupancy $stay) => $stay->room->property_id === $this->alQuoz->id))->toBeTrue()
        ->and(StaffMember::query()->pluck('property_id')->unique()->values()->all())->toBe([$this->alQuoz->id]);
});

test('opens every page a camp boss may see without a database error', function () {
    $boss = campUser(UserRole::CAMP_BOSS, [$this->alQuoz]);
    $pages = collect($boss->permissionKeys())
        ->flatMap(fn (string $permission) => collect(config('permissions.modules'))->flatMap(fn (array $pages) => $pages)->get(strstr($permission, '.', true))[substr(strstr($permission, '.'), 1)] ?? [])
        ->unique()
        ->filter(fn (string $name) => in_array('GET', Route::getRoutes()->getByName($name)->methods(), true) && Route::getRoutes()->getByName($name)->parameterNames() === [])
        ->values();

    expect($pages)->not->toBeEmpty();

    // Landlord payments only redirects to the issued cheques.
    $failing = $pages->mapWithKeys(fn (string $name) => [$name => $this->actingAs($boss)->get(route($name))->status()])
        ->reject(fn (int $status, string $name) => $status === 200 || ($name === 'landlord-payments.index' && $status === 302));

    expect($failing->all())->toBe([]);

    $this->actingAs($boss)->get(route('dashboard'))->assertOk();
    $this->actingAs($boss)->get(route('properties.show', $this->alQuoz))->assertOk();
    $this->actingAs($boss)->get(route('properties.payments', $this->alQuoz))->assertOk();
});

test('lets an area manager see each of their camps, and no others', function () {
    $manager = campUser(UserRole::AREA_MANAGER, [$this->alQuoz, $this->jebelAli]);
    $others = $this->company->properties()->whereNotIn('id', [$this->alQuoz->id, $this->jebelAli->id])->first();

    $this->actingAs($manager)->get(route('properties.show', $this->jebelAli))->assertOk();
    expect(Property::pluck('id')->sort()->values()->all())->toBe(collect([$this->alQuoz->id, $this->jebelAli->id])->sort()->values()->all());

    if ($others !== null) {
        $this->actingAs($manager)->get(route('properties.show', $others))->assertNotFound();
    }
});

test('refuses work at another camp, even with its id typed in', function () {
    $boss = campUser(UserRole::CAMP_BOSS, [$this->alQuoz]);
    $manager = campUser(UserRole::AREA_MANAGER, [$this->alQuoz]);
    $room = [
        'room_number' => 'Z-901',
        'room_type_id' => RoomType::query()->value('id'),
        'capacity' => 4,
        'status' => 'active',
    ];

    // Refused, or not found, depending on whether the page looks the camp up first.
    expect($this->actingAs($manager)->post(route('rooms.store'), [...$room, 'property_id' => $this->jebelAli->id])->status())->toBeIn([403, 404]);
    $this->assertDatabaseMissing('rooms', ['room_number' => 'Z-901']);

    $this->actingAs($manager)->post(route('rooms.store'), [...$room, 'property_id' => $this->alQuoz->id])->assertSessionHasNoErrors();
    $this->assertDatabaseHas('rooms', ['room_number' => 'Z-901', 'property_id' => $this->alQuoz->id]);

    // Pages that add up the whole company are never theirs, even when chosen for them.
    $boss->forceFill(['permissions' => ['report_summary.view', 'payments_overview.view', 'users.manage', 'properties.view']])->save();

    expect($boss->fresh()->permissionKeys())->toBe(['properties.view']);
    $this->actingAs($boss->fresh())->get(route('reports.summary'))->assertForbidden();
    $this->actingAs($boss->fresh())->get(route('configuration.users'))->assertForbidden();
});

test('shows a camp role nothing until it is given a camp', function () {
    $boss = campUser(UserRole::CAMP_BOSS, []);

    $this->actingAs($boss)
        ->get(route('properties.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('properties.data', fn ($properties) => $properties->isEmpty()));

    expect(Room::count())->toBe(0);
});

test('gives camps with the role on the users page, one for a camp boss', function () {
    $user = User::factory()->create(['company_id' => $this->company->id, 'user_role_id' => UserRole::builtIn(UserRole::OFFICE_ADMIN)->id]);
    $update = fn (array $input) => $this->actingAs($this->admin)->put(route('configuration.users.update', $user), ['custom' => false, ...$input]);

    $update(['role' => UserRole::CAMP_BOSS])->assertSessionHasErrors('property_ids');
    $update(['role' => UserRole::CAMP_BOSS, 'property_ids' => [$this->alQuoz->id, $this->jebelAli->id]])->assertSessionHasErrors('property_ids');
    $update(['role' => UserRole::CAMP_BOSS, 'property_ids' => [Property::factory()->create()->id]])->assertSessionHasErrors('property_ids.0');

    $update(['role' => UserRole::CAMP_BOSS, 'property_ids' => [$this->jebelAli->id]])->assertSessionHasNoErrors();
    expect($user->fresh()->campPropertyIds())->toBe([$this->jebelAli->id]);

    // Another role sees every camp again.
    $update(['role' => UserRole::OFFICE_ADMIN, 'property_ids' => [$this->jebelAli->id]])->assertSessionHasNoErrors();
    expect($user->fresh()->campPropertyIds())->toBeNull()
        ->and($user->fresh()->properties()->count())->toBe(0);
});

test('lets a staff member’s sign-in hold a role, and keeps their own record in view', function () {
    $member = StaffMember::factory()->create(['company_id' => $this->company->id, 'email' => 'boss@horizonfm.test']);
    $member->syncSignIn(true, 'self', false, 'password');
    $signIn = $member->user;

    $this->actingAs($this->admin)
        ->put(route('configuration.users.update', $signIn), ['role' => UserRole::CAMP_BOSS, 'property_ids' => [$this->alQuoz->id], 'custom' => false])
        ->assertSessionHasNoErrors();

    $signIn = $signIn->fresh();

    expect($signIn->role->slug)->toBe(UserRole::CAMP_BOSS)
        ->and($signIn->canUseApp())->toBeTrue()
        ->and($signIn->permissionKeys())->toContain('rooms.view');

    // They work at head office, not the camp, yet their own page still opens.
    $this->actingAs($signIn)->get(route('my.index'))->assertOk();
    $this->actingAs($signIn)->get(route('properties.show', $this->alQuoz))->assertOk();

    $this->actingAs($this->admin)
        ->put(route('configuration.users.update', $signIn), ['role' => null, 'custom' => false])
        ->assertSessionHasNoErrors();

    expect($signIn->fresh()->role)->toBeNull();
});

test('lets the parent super admin work inside any company and come back', function () {
    $other = Company::factory()->create(['name' => 'Desert Rose Camps']);
    $theirs = Property::factory()->create(['company_id' => $other->id]);
    $companyUser = campUser(UserRole::AREA_MANAGER, [$this->alQuoz]);

    $this->actingAs($companyUser)->post(route('admin.companies.open', $other))->assertForbidden();

    $this->actingAs($this->admin)->post(route('admin.companies.open', $other))->assertRedirect(route('dashboard'));

    $this->actingAs($this->admin)
        ->get(route('properties.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.company.id', $other->id)
            ->where('auth.switcher.isElsewhere', true)
            ->where('properties.data', fn ($properties) => $properties->pluck('id')->all() === [$theirs->id]));

    $this->actingAs($this->admin)->get(route('properties.show', $theirs))->assertOk();
    expect($this->admin->fresh()->company_id)->toBe($this->company->id);

    $this->actingAs($this->admin)->delete(route('admin.companies.leave'))->assertRedirect(route('dashboard'));
    // Each request signs the account in afresh, with its own company.
    $this->actingAs($this->admin->fresh())->get(route('properties.show', $theirs))->assertNotFound();
});
