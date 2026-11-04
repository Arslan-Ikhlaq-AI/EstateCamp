<?php

use App\Http\Middleware\AuthorizeByPermission;
use App\Mail\AccountCredentials;
use App\Models\Company;
use App\Models\StaffMember;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Routing\Route as RouteDefinition;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->company = Company::factory()->create();
    $this->superAdmin = companyUser(UserRole::SUPER_ADMIN);
});

/**
 * A user of the test company with `$role` (a UserRole slug, or null for none).
 */
function companyUser(?string $role, array $attributes = []): User
{
    return User::factory()->create([
        'company_id' => test()->company->id,
        'user_role_id' => $role ? UserRole::builtIn($role)->id : null,
        ...$attributes,
    ]);
}

/**
 * An office admin who may manage users but not the payroll, as a company
 * might set one up.
 */
function officeAdminWithoutPayroll(): User
{
    return companyUser(UserRole::OFFICE_ADMIN, ['permissions' => User::expandPermissions(['*', '!payroll.*'])]);
}

test('names a permission for every signed-in page, or leaves it open on purpose', function () {
    $uncovered = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (RouteDefinition $route) => in_array('permission', $route->gatherMiddleware(), true))
        ->map(fn (RouteDefinition $route) => $route->getName() ?? $route->uri())
        ->reject(fn (string $name) => AuthorizeByPermission::forRoute($name) !== [] || Str::is(config('permissions.open_routes'), $name))
        ->values()
        ->all();

    $missing = collect(config('permissions.modules'))->flatten()->unique()->reject(fn (string $name) => Route::has($name))->values()->all();

    expect($uncovered)->toBe([])->and($missing)->toBe([]);
});

test('lets each role open what it allows', function () {
    $officeAdmin = companyUser(UserRole::OFFICE_ADMIN);
    $areaManager = companyUser(UserRole::AREA_MANAGER);
    $campBoss = companyUser(UserRole::CAMP_BOSS);

    $this->actingAs($officeAdmin)->get(route('payroll.index'))->assertOk();
    $this->actingAs($officeAdmin)->get(route('configuration.users'))->assertOk();

    $this->actingAs($areaManager)->get(route('rooms.create'))->assertOk();
    $this->actingAs($areaManager)->get(route('payroll.index'))->assertForbidden();
    $this->actingAs($areaManager)->get(route('reports.summary'))->assertForbidden();

    $this->actingAs($campBoss)->get(route('invoices.index'))->assertOk();
    $this->actingAs($campBoss)->get(route('payments.create'))->assertOk();
    $this->actingAs($campBoss)->get(route('rooms.create'))->assertForbidden();
    $this->actingAs($campBoss)->get(route('configuration.users'))->assertForbidden();

    $this->actingAs($campBoss)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.permissions', fn ($permissions) => collect($permissions)->contains('rent_collections.create') && ! collect($permissions)->contains('payroll.view')));
});

test('takes the pages a company has switched off away from all its users', function () {
    $this->company->forceFill(['disabled_features' => ['rooms', 'payroll']])->save();

    $this->actingAs($this->superAdmin)->get(route('rooms.create'))->assertForbidden();
    $this->actingAs($this->superAdmin)->get(route('payroll.index'))->assertForbidden();
    $this->actingAs($this->superAdmin)->get(route('properties.index'))->assertOk();

    $this->actingAs($this->superAdmin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.permissions', fn ($permissions) => ! collect($permissions)->contains(fn (string $permission) => Str::startsWith($permission, ['rooms.', 'payroll.']))));
});

test('lets only a platform admin switch a company’s pages, and keeps the ones it needs', function () {
    $platformAdmin = User::factory()->admin()->create();

    $this->actingAs($this->superAdmin)->get(route('admin.companies.index'))->assertForbidden();
    $this->actingAs($this->superAdmin)->put(route('admin.companies.update', $this->company), ['disabled_features' => ['rooms']])->assertForbidden();

    $this->actingAs($platformAdmin)->get(route('admin.companies.edit', $this->company))->assertOk();
    $this->actingAs($platformAdmin)->put(route('admin.companies.update', $this->company), ['disabled_features' => ['users']])->assertSessionHasErrors('disabled_features.0');

    $this->actingAs($platformAdmin)->put(route('admin.companies.update', $this->company), ['disabled_features' => ['rooms', 'payroll']])->assertSessionHasNoErrors();
    expect($this->company->fresh()->disabled_features)->toBe(['rooms', 'payroll']);

    $this->actingAs($platformAdmin)->put(route('admin.companies.update', $this->company), ['disabled_features' => []])->assertSessionHasNoErrors();
    expect($this->company->fresh()->disabled_features)->toBeNull();
});

test('adds a user with the password chosen for them, which they sign in with', function () {
    Mail::fake();
    $layla = ['name' => 'Layla Haddad', 'email' => 'layla@example.test', 'role' => UserRole::OFFICE_ADMIN];

    $this->actingAs($this->superAdmin)->post(route('configuration.users.store'), $layla)->assertSessionHasErrors('password');
    $this->actingAs($this->superAdmin)->post(route('configuration.users.store'), [...$layla, 'password' => 'short'])->assertSessionHasErrors('password');

    $this->actingAs($this->superAdmin)
        ->post(route('configuration.users.store'), [...$layla, 'password' => 'Layla-Passw0rd'])
        ->assertSessionHasNoErrors();

    $user = User::where('email', 'layla@example.test')->sole();

    expect($user->company_id)->toBe($this->company->id)
        ->and($user->role->slug)->toBe(UserRole::OFFICE_ADMIN)
        ->and($user->is_admin)->toBeFalse()
        ->and($user->permissions)->toBeNull();

    Mail::assertQueued(AccountCredentials::class, fn (AccountCredentials $mail) => $mail->user->is($user) && $mail->password === 'Layla-Passw0rd');

    $this->actingAs($this->superAdmin)
        ->post(route('configuration.users.store'), [...$layla, 'name' => 'Again', 'password' => 'Layla-Passw0rd'])
        ->assertSessionHasErrors('email');

    Auth::forgetGuards();
    $this->post('/login', ['email' => 'layla@example.test', 'password' => 'Layla-Passw0rd']);
    $this->assertAuthenticatedAs($user);
});

test('opens the add user page with the roles the editor may give', function () {
    $this->actingAs(officeAdminWithoutPayroll())
        ->get(route('configuration.users.create'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/AddUser')
            ->has('roles', count(UserRole::BUILT_IN))
            ->where('roles', fn ($roles) => collect($roles)->pluck('givable', 'value')->only([UserRole::SUPER_ADMIN, UserRole::OFFICE_ADMIN, UserRole::AREA_MANAGER])->all() === [
                UserRole::SUPER_ADMIN => false,
                UserRole::OFFICE_ADMIN => false,
                UserRole::AREA_MANAGER => true,
            ])
            ->has('properties'));

    $this->actingAs(companyUser(UserRole::CAMP_BOSS))->get(route('configuration.users.create'))->assertForbidden();
});

test('saves a new password with a user’s access, which they then sign in with', function () {
    $colleague = companyUser(UserRole::OFFICE_ADMIN, ['remember_token' => 'remembered']);
    $oldPassword = $colleague->password;
    $save = fn (array $input) => $this->actingAs($this->superAdmin)->put(route('configuration.users.update', $colleague), ['role' => UserRole::OFFICE_ADMIN, 'custom' => false, ...$input]);

    $save(['password' => 'short'])->assertSessionHasErrors('password');

    // Left empty, their password stays as it was.
    $save(['password' => ''])->assertSessionHasNoErrors();
    expect($colleague->fresh()->password)->toBe($oldPassword);

    $save(['password' => 'Office-Admin-2026'])->assertSessionHasNoErrors();

    // A sign-in they asked to be remembered ends with the old password.
    expect($colleague->fresh()->remember_token)->not->toBe('remembered');

    Auth::forgetGuards();
    $this->post('/login', ['email' => $colleague->email, 'password' => 'Office-Admin-2026']);
    $this->assertAuthenticatedAs($colleague);
});

test('narrows a user to the permissions chosen for them, and puts them back on their role', function () {
    $manager = companyUser(UserRole::OFFICE_ADMIN);

    $this->actingAs($this->superAdmin)
        ->put(route('configuration.users.update', $manager), ['role' => UserRole::OFFICE_ADMIN, 'custom' => true, 'permissions' => ['rooms.view', 'rooms.create']])
        ->assertSessionHasNoErrors();

    expect($manager->fresh()->permissions)->toBe(['rooms.view', 'rooms.create']);

    $this->actingAs($manager->fresh())->get(route('rooms.create'))->assertOk();
    $this->actingAs($manager->fresh())->get(route('properties.index'))->assertForbidden();
    // Without the dashboard, the app opens on the first page they may see.
    $this->actingAs($manager->fresh())->get(route('dashboard'))->assertRedirect(route('rooms.index'));

    $this->actingAs($this->superAdmin)
        ->put(route('configuration.users.update', $manager), ['role' => UserRole::OFFICE_ADMIN, 'custom' => false, 'permissions' => []])
        ->assertSessionHasNoErrors();

    expect($manager->fresh()->permissions)->toBeNull();
    $this->actingAs($manager->fresh())->get(route('properties.index'))->assertOk();
});

test('keeps anyone from giving access they do not have themselves', function () {
    $editor = officeAdminWithoutPayroll();
    $colleague = companyUser(UserRole::OFFICE_ADMIN, ['permissions' => ['rooms.view', 'payroll.view']]);
    $campBoss = companyUser(UserRole::CAMP_BOSS);

    // No one changes their own access, or a super admin's unless they are one.
    $this->actingAs($editor)->put(route('configuration.users.update', $editor), ['role' => UserRole::OFFICE_ADMIN])->assertForbidden();
    $this->actingAs($editor)->put(route('configuration.users.update', $this->superAdmin), ['role' => UserRole::OFFICE_ADMIN])->assertForbidden();

    // Only a super admin makes another, and a role may not bring more than the editor has.
    $this->actingAs($editor)->put(route('configuration.users.update', $colleague), ['role' => UserRole::SUPER_ADMIN])->assertSessionHasErrors('role');
    $this->actingAs($editor)->put(route('configuration.users.update', $campBoss), ['role' => UserRole::OFFICE_ADMIN])->assertSessionHasErrors('role');
    $this->actingAs($editor)->post(route('configuration.users.store'), ['name' => 'Ahmed', 'email' => 'ahmed@example.test', 'role' => UserRole::OFFICE_ADMIN])->assertSessionHasErrors('role');

    // What the editor lacks is neither given nor taken away.
    $this->actingAs($editor)
        ->put(route('configuration.users.update', $colleague), ['role' => UserRole::OFFICE_ADMIN, 'custom' => true, 'permissions' => ['shops.view', 'payroll.manage']])
        ->assertSessionHasNoErrors();

    expect($colleague->fresh()->permissions)->toBe(['shops.view', 'payroll.view']);

    // Another company's users are not found.
    $outsider = User::factory()->create(['company_id' => Company::factory()->create()->id, 'user_role_id' => UserRole::builtIn(UserRole::OFFICE_ADMIN)->id]);
    $this->actingAs($editor)->get(route('configuration.users.edit', $outsider))->assertNotFound();
});

test('shows a user’s permissions page by page, with what the editor may give', function () {
    $manager = companyUser(UserRole::AREA_MANAGER);

    $this->actingAs($this->superAdmin)
        ->get(route('configuration.users.edit', $manager))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/UserPermissions')
            ->where('user.kind', 'role')
            ->where('user.custom', false)
            ->where('user.canEdit', true)
            ->where('user.permissions', User::expandPermissions(config('permissions.roles.area_manager')))
            ->where('companyWide', config('permissions.company_wide'))
            ->has('modules', count(config('permissions.modules'))));

    $this->actingAs($this->superAdmin)
        ->get(route('configuration.users'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/Users')
            ->has('users', 2)
            ->where('users', fn ($users) => $users->firstWhere('isYou', true)['canEdit'] === false && $users->firstWhere('isYou', false)['canEdit'] === true));
});

test('puts a staff sign-in back on its access level when that changes', function () {
    $member = StaffMember::factory()->create(['company_id' => $this->company->id, 'email' => 'cook@example.test']);
    $member->syncSignIn(true, 'supervisor', false, 'password');
    $user = $member->user;

    $this->actingAs($this->superAdmin)
        ->put(route('configuration.users.update', $user), ['custom' => true, 'permissions' => ['staff.view']])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->permissions)->toBe(['staff.view']);

    $member->fresh()->syncSignIn(true, 'admin', false);

    expect($user->fresh()->permissions)->toBeNull()
        ->and($user->fresh()->permissionKeys())->toContain('payroll.manage');
});
