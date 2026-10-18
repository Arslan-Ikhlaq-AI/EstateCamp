<?php

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PortfolioSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('users without a company see an empty dashboard', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('company', null)
            ->missing('summary')
            ->where('notifications', [])
        );
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    });

    test('summarises occupancy, rent and documents', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('company.name', 'Horizon Facilities Management')
                ->where('company.currency', 'AED')
                ->where('summary.properties', 2)
                ->where('summary.rooms', 10)
                ->where('summary.roomsUnderMaintenance', 1)
                ->where('summary.beds', [
                    'total' => 37,
                    'occupied' => 27,
                    'available' => 4,
                    'outOfService' => 6,
                    'occupancyRate' => 87.1,
                ])
                ->where('summary.rentRoll', 17450)
                ->where('summary.potentialRent', 21100)
                ->where('summary.documents', ['total' => 6, 'expiring' => 1, 'expired' => 0])
            );
    });

    test('lists every property, room type, room, document and team member', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('properties', 2)
                ->where('properties.0.name', 'Al Quoz Worker Village')
                ->where('properties.0.beds.occupied', 22)
                ->where('properties.0.beds.total', 30)
                ->where('properties.0.beds.occupancyRate', 91.7)
                ->where('properties.0.rentRoll', 10950)
                ->has('roomTypes', 3)
                ->has('rooms', 10)
                ->where('rooms.0.photoUrl', '/images/demo/room-dormitory.svg')
                ->has('documents', 6)
                ->where('documents.0.status', 'expiring')
                ->where('documents.5.status', 'no_expiry')
                ->has('team', 2)
                ->where('team.0.role', 'Super Admin')
            );
    });

    test('ignores other companies', function () {
        $otherProperty = Property::factory()->create();
        Room::factory()->count(3)->for($otherProperty)->create(['status' => 'under_maintenance']);
        PropertyDocument::factory()->for($otherProperty)->create(['expires_on' => today()->addDays(5)]);

        $this->actingAs($this->superAdmin)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.rooms', 10)
                ->where('summary.documents.total', 6)
                ->has('properties', 2)
                ->has('notifications', 2)
            );

        expect(Company::count())->toBe(2);
    });

    test('shares the company, role and notifications with every page', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('payments.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.company.name', 'Horizon Facilities Management')
                ->where('auth.company.logo_url', '/images/demo/horizon-fm-logo.svg')
                ->where('auth.role', 'Super Admin')
                ->missing('auth.user.company')
                ->has('notifications', 2)
                ->where('notifications.0.type', 'document_expiring')
                ->where('notifications.0.severity', 'warning')
                ->where('notifications.0.days', 30)
                ->where('notifications.1.type', 'room_maintenance')
            );
    });

    test('puts expired documents first', function () {
        $property = Property::where('code', 'HFM-AQZ-01')->sole();

        PropertyDocument::factory()->for($property)->create([
            'title' => 'Municipality Permit',
            'issued_on' => today()->subYear(),
            'expires_on' => today()->subDay(),
        ]);

        $this->actingAs($this->superAdmin)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('notifications.0.type', 'document_expired')
                ->where('notifications.0.severity', 'critical')
                ->where('notifications.0.title', 'Municipality Permit')
                ->where('notifications.0.days', -1)
                ->where('summary.documents.expired', 1)
            );
    });
});

test('summarises money collected and owed over the last six months', function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->actingAs(User::where('email', 'omar.rahman@horizonfm.test')->sole())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('finance.collectedThisMonth', 27875)
            ->where('finance.invoicedThisMonth', 52255)
            ->where('finance.outstanding', 39500)
            ->where('finance.overdue', ['count' => 4, 'amount' => 37800])
            ->has('finance.trend', 6)
            ->where('finance.trend.0', ['month' => '2026-05', 'invoiced' => 65100, 'collected' => 65100])
            ->where('finance.trend.3', ['month' => '2026-08', 'invoiced' => 68680, 'collected' => 83380])
            ->where('finance.trend.5', ['month' => '2026-10', 'invoiced' => 52255, 'collected' => 27875])
        );
});

test('breaks down invoices, payments, balances, stays and recent activity', function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->actingAs(User::where('email', 'omar.rahman@horizonfm.test')->sole())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('finance.invoiceStatus', ['paid' => 45, 'awaiting' => 1, 'partial' => 0, 'overdue' => 4])
            ->has('finance.paymentMethods', 4)
            ->where('finance.paymentMethods.0', ['method' => 'cheque', 'amount' => 138370])
            ->has('finance.topDebtors', 5)
            ->where('finance.topDebtors.0.name', 'FreshFold Laundry Services L.L.C.')
            ->where('finance.topDebtors.0.balance', 15120)
            ->where('finance.topDebtors.4.name', 'Daniel Okafor')
            ->where('finance.topDebtors.4.overdue', 0)
            ->has('occupancyTrend', 6)
            ->where('occupancyTrend.5', ['month' => '2026-10', 'staying' => 27])
            ->has('activity', 10)
            ->where('activity.0.type', 'payment')
            ->where('activity.0.status', 'pending')
            ->where('activity.1.type', 'invoice')
            ->where('activity', function ($activity) {
                $dates = collect($activity)->pluck('date');

                return $dates->every(fn (string $date) => $date <= '2026-10-17')
                    && $dates->all() === $dates->sortDesc()->values()->all();
            })
        );
});

test('sidebar sections without a module yet show a coming soon page', function (string $routeName) {
    $this->actingAs(User::factory()->create())
        ->get(route($routeName))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('ComingSoon')
            ->where('section', $routeName)
        );
})->with([
    'properties.documents',
    'configuration.company',
    'configuration.property-types',
    'configuration.room-types',
    'maintenance.index',
    'help',
]);

test('coming soon pages require signing in', function () {
    $this->get(route('maintenance.index'))->assertRedirect(route('login'));
});
