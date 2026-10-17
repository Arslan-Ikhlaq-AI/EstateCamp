<?php

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\User;
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
