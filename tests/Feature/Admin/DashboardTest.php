<?php

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Seven users, with the 7-day window running 9-15 October 2026 and the
 * previous window 2-8 October. The administrator is verified and old.
 */
function createUsersAcrossTwoWindows(): User
{
    $admin = User::factory()->admin()->create([
        'name' => 'Zed Admin',
        'created_at' => '2026-01-01 09:00:00',
    ]);

    User::factory()->create(['created_at' => '2026-10-09 08:00:00']);
    User::factory()->create(['created_at' => '2026-10-12 10:00:00']);
    User::factory()->unverified()->create(['created_at' => '2026-10-15 09:00:00']);

    User::factory()->create(['created_at' => '2026-10-02 00:00:00']);
    User::factory()->create(['created_at' => '2026-10-08 23:59:59']);

    User::factory()->unverified()->create(['created_at' => '2026-09-01 09:00:00']);

    return $admin;
}

test('guests are redirected to the login page', function () {
    $response = $this->get(route('admin.dashboard'));

    $response->assertRedirect(route('login'));
});

test('regular users are forbidden from the admin dashboard', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('admin.dashboard'));

    $response->assertForbidden();
});

test('only administrators pass the view-admin-dashboard gate', function () {
    $admin = User::factory()->admin()->create();
    $regularUser = User::factory()->create();

    expect(Gate::forUser($admin)->allows('view-admin-dashboard'))->toBeTrue()
        ->and(Gate::forUser($regularUser)->allows('view-admin-dashboard'))->toBeFalse();
});

test('administrators see the admin dashboard', function () {
    $admin = User::factory()->admin()->create();

    $response = $this
        ->actingAs($admin)
        ->get(route('admin.dashboard'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Dashboard')
            ->where('filters', [
                'range' => 30,
                'search' => '',
                'status' => null,
                'sort' => 'created_at',
                'direction' => 'desc',
            ])
        );
});

test('administrators see the company dashboard like everyone else', function () {
    $admin = User::factory()->admin()->create();

    $response = $this
        ->actingAs($admin)
        ->get(route('dashboard'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Dashboard'));
});

test('regular users still see the user dashboard', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('dashboard'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Dashboard'));
});

test('users cannot make themselves administrators when registering', function () {
    $this->post('/register', [
        'name' => 'Sneaky User',
        'email' => 'sneaky@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'is_admin' => true,
    ]);

    $user = User::where('email', 'sneaky@example.com')->sole();

    expect($user->is_admin)->toBeFalse();
});

test('users cannot make themselves administrators when updating their profile', function () {
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->patch('/profile', [
            'name' => 'Sneaky User',
            'email' => $user->email,
            'is_admin' => true,
        ]);

    expect($user->refresh()->is_admin)->toBeFalse();
});

describe('statistics, signups and verification', function () {
    beforeEach(function () {
        $this->travelTo('2026-10-15 12:00:00');
    });

    test('stats compare the selected range with the range before it', function () {
        $admin = createUsersAcrossTwoWindows();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['range' => 7]));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('stats.totalUsers', 7)
            ->where('stats.newUsers.value', 3)
            ->where('stats.newUsers.previous', 2)
            ->where('stats.newUsers.change', 50)
            ->where('stats.verifiedUsers.value', 5)
            ->where('stats.verifiedUsers.rate', 71.4)
            ->where('stats.unverifiedUsers', 2)
        );
    });

    test('stats report no percentage change when the previous range had no signups', function () {
        $admin = User::factory()->admin()->create(['created_at' => '2026-01-01 09:00:00']);
        User::factory()->create(['created_at' => '2026-10-14 09:00:00']);

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['range' => 7]));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('stats.newUsers.value', 1)
            ->where('stats.newUsers.previous', 0)
            ->where('stats.newUsers.change', null)
        );
    });

    test('signups contain one entry per day, with zeros for quiet days', function () {
        $admin = createUsersAcrossTwoWindows();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['range' => 7]));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('signups', [
                ['date' => '2026-10-09', 'verified' => 1, 'unverified' => 0],
                ['date' => '2026-10-10', 'verified' => 0, 'unverified' => 0],
                ['date' => '2026-10-11', 'verified' => 0, 'unverified' => 0],
                ['date' => '2026-10-12', 'verified' => 1, 'unverified' => 0],
                ['date' => '2026-10-13', 'verified' => 0, 'unverified' => 0],
                ['date' => '2026-10-14', 'verified' => 0, 'unverified' => 0],
                ['date' => '2026-10-15', 'verified' => 0, 'unverified' => 1],
            ])
        );
    });

    test('signups follow the selected range', function (int $range, string $firstDate) {
        $admin = User::factory()->admin()->create();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['range' => $range]));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('signups', $range)
            ->where('signups.0.date', $firstDate)
            ->where('signups.'.($range - 1).'.date', '2026-10-15')
        );
    })->with([
        '7 days' => [7, '2026-10-09'],
        '30 days' => [30, '2026-09-16'],
        '90 days' => [90, '2026-07-18'],
    ]);

    test('verification splits every user into verified and unverified', function () {
        $admin = createUsersAcrossTwoWindows();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->where('verification', [
                ['status' => 'verified', 'users' => 5],
                ['status' => 'unverified', 'users' => 2],
            ])
        );
    });
});

describe('users table', function () {
    test('lists users newest first by default', function () {
        $admin = User::factory()->admin()->create(['created_at' => '2026-01-01 09:00:00']);
        User::factory()->create(['name' => 'Newest', 'created_at' => '2026-03-01 09:00:00']);
        User::factory()->create(['name' => 'Middle', 'created_at' => '2026-02-01 09:00:00']);

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard'));

        $names = collect($response->inertiaProps('users.data'))->pluck('name');

        expect($names->take(2)->all())->toBe(['Newest', 'Middle']);
    });

    test('does not expose password or remember token', function () {
        $admin = User::factory()->admin()->create();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard'));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('users.data.0', fn (Assert $row) => $row
                ->hasAll(['id', 'name', 'email', 'isAdmin', 'emailVerifiedAt', 'createdAt'])
                ->missing('password')
                ->missing('remember_token')
            )
        );
    });

    test('searches by name or email', function () {
        $admin = User::factory()->admin()->create(['name' => 'Zed Admin', 'email' => 'zed@example.com']);
        User::factory()->create(['name' => 'Alice Johnson', 'email' => 'alice@example.com']);
        User::factory()->create(['name' => 'Bob Smith', 'email' => 'bob@sample.org']);

        $byName = $this->actingAs($admin)->get(route('admin.dashboard', ['search' => 'johnson']));
        $byEmail = $this->actingAs($admin)->get(route('admin.dashboard', ['search' => 'sample.org']));

        expect(collect($byName->inertiaProps('users.data'))->pluck('name')->all())->toBe(['Alice Johnson'])
            ->and(collect($byEmail->inertiaProps('users.data'))->pluck('name')->all())->toBe(['Bob Smith']);
    });

    test('filters by verification status', function (string $status, array $expectedNames) {
        $admin = User::factory()->admin()->create(['name' => 'Zed Admin']);
        User::factory()->create(['name' => 'Verified Vera']);
        User::factory()->unverified()->create(['name' => 'Unverified Uma']);

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['status' => $status, 'sort' => 'name', 'direction' => 'asc']));

        expect(collect($response->inertiaProps('users.data'))->pluck('name')->all())->toBe($expectedNames);
    })->with([
        'verified' => ['verified', ['Verified Vera', 'Zed Admin']],
        'unverified' => ['unverified', ['Unverified Uma']],
    ]);

    test('sorts by the chosen column and direction', function (string $direction, array $expectedNames) {
        $admin = User::factory()->admin()->create(['name' => 'Zed Admin']);
        User::factory()->create(['name' => 'Charlie']);
        User::factory()->create(['name' => 'Alice']);

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['sort' => 'name', 'direction' => $direction]));

        expect(collect($response->inertiaProps('users.data'))->pluck('name')->all())->toBe($expectedNames);
    })->with([
        'ascending' => ['asc', ['Alice', 'Charlie', 'Zed Admin']],
        'descending' => ['desc', ['Zed Admin', 'Charlie', 'Alice']],
    ]);

    test('paginates ten users per page and keeps the filters in the page links', function () {
        $admin = User::factory()->admin()->create(['created_at' => '2026-01-01 09:00:00']);
        User::factory()->count(11)->create(['created_at' => '2026-02-01 09:00:00']);

        $firstPage = $this->actingAs($admin)->get(route('admin.dashboard', ['status' => 'verified']));
        $secondPage = $this->actingAs($admin)->get(route('admin.dashboard', ['status' => 'verified', 'page' => 2]));

        $firstPage->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 10)
            ->where('users.total', 12)
            ->where('users.last_page', 2)
            ->where('users.next_page_url', fn (string $url) => str_contains($url, 'status=verified'))
        );
        $secondPage->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 2)
            ->where('users.current_page', 2)
        );
    });

    test('shows an empty list when nothing matches', function () {
        $admin = User::factory()->admin()->create();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['search' => 'no-such-person']));

        $response->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 0)
            ->where('users.total', 0)
        );
    });
});

describe('filter validation', function () {
    test('rejects values outside the allowed options', function (array $query, string $field, string $message) {
        $admin = User::factory()->admin()->create();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', $query));

        $response->assertInvalid([$field => $message]);
    })->with([
        'unsupported range' => [['range' => 14], 'range', 'The selected range is invalid.'],
        'sorting by a column that is not allowed' => [['sort' => 'password'], 'sort', 'The selected sort is invalid.'],
        'sorting by an injected expression' => [['sort' => 'name; drop table users'], 'sort', 'The selected sort is invalid.'],
        'unknown sort direction' => [['direction' => 'sideways'], 'direction', 'The selected direction is invalid.'],
        'unknown status' => [['status' => 'banned'], 'status', 'The selected status is invalid.'],
        'page below one' => [['page' => 0], 'page', 'The page field must be at least 1.'],
    ]);

    test('falls back to the defaults when a filter is sent empty', function () {
        $admin = User::factory()->admin()->create();

        $response = $this
            ->actingAs($admin)
            ->get(route('admin.dashboard', ['range' => '', 'sort' => '', 'direction' => '', 'status' => '']));

        $response
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.range', 30)
                ->where('filters.sort', 'created_at')
                ->where('filters.direction', 'desc')
                ->where('filters.status', null)
            );
    });
});
