<?php

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyType;
use App\Models\Room;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $this->get(route('properties.index'))->assertRedirect(route('login'));
});

test('users without a company see an empty list', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('properties.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Properties/Index')
            ->where('company', null)
            ->missing('properties')
        );
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    });

    test('lists each property with its occupancy, rent and compliance', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Properties/Index')
                ->where('company.currency', 'AED')
                ->where('properties.total', 2)
                ->where('properties.data.0.name', 'Al Quoz Worker Village')
                ->where('properties.data.0.typeSlug', 'worker_accommodation')
                ->where('properties.data.0.ownership', 'owned')
                ->where('properties.data.0.rooms', 5)
                ->where('properties.data.0.roomOccupancy', ['full' => 2, 'partial' => 2, 'empty' => 1])
                ->where('properties.data.0.beds', [
                    'total' => 30,
                    'occupied' => 22,
                    'available' => 2,
                    'outOfService' => 6,
                    'occupancyRate' => 91.7,
                ])
                ->where('properties.data.0.rentRoll', 10950)
                ->where('properties.data.0.documents', ['total' => 3, 'expiring' => 1, 'expired' => 0])
                ->where('properties.data.1.name', 'Jebel Ali Staff Residence')
                ->where('properties.data.1.leaseEndsOn', '2028-12-31')
                ->where('properties.data.1.roomOccupancy', ['full' => 3, 'partial' => 1, 'empty' => 1])
                ->where('properties.data.1.rentRoll', 6500)
            );
    });

    test('summarises the whole portfolio whatever the filters', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['ownership' => ['leased']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('properties.total', 1)
                ->where('summary.properties', 2)
                ->where('summary.active', 2)
                ->where('summary.owned', 1)
                ->where('summary.leased', 1)
                ->where('summary.rooms', 10)
                ->where('summary.roomOccupancy', ['full' => 5, 'partial' => 3, 'empty' => 2])
                ->where('summary.beds.occupancyRate', 87.1)
                ->where('summary.rentRoll', 17450)
            );
    });

    test('ignores other companies', function () {
        $otherProperty = Property::factory()->create(['name' => 'Al Quoz Rival Camp']);
        Room::factory()->for($otherProperty)->create();

        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['search' => 'quoz']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('properties.total', 1)
                ->where('properties.data.0.code', 'HFM-AQZ-01')
                ->where('summary.properties', 2)
                ->where('facets.cities', [['value' => 'Dubai', 'count' => 1]])
            );

        expect(Company::count())->toBe(2);
    });

    test('searches names, codes and areas without regard to case', function (string $search, array $codes) {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['search' => $search]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.search', $search)
                ->where('properties.data', fn ($properties) => collect($properties)->pluck('code')->all() === $codes)
            );
    })->with([
        'name' => ['WORKER village', ['HFM-AQZ-01']],
        'code' => ['hfm-jba', ['HFM-JBA-01']],
        'area' => ['industrial area', ['HFM-AQZ-01', 'HFM-JBA-01']],
        'makani number' => ['1654038297', ['HFM-JBA-01']],
        'no match' => ['Sharjah', []],
        'SQL as plain text' => ["' or 1=1 --", []],
    ]);

    test('narrows the list by each filter', function (array $query, string $code) {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', $query))
            ->assertInertia(fn (Assert $page) => $page
                ->where('properties.total', 1)
                ->where('properties.data.0.code', $code)
            );
    })->with([
        'type' => [['types' => ['staff_accommodation']], 'HFM-JBA-01'],
        'ownership' => [['ownership' => ['owned']], 'HFM-AQZ-01'],
        'type and ownership' => [['types' => ['worker_accommodation', 'staff_accommodation'], 'ownership' => ['leased']], 'HFM-JBA-01'],
    ]);

    test('filters by status and city', function () {
        Property::where('code', 'HFM-JBA-01')->update(['status' => 'under_maintenance', 'city' => 'Sharjah']);

        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['status' => ['under_maintenance'], 'cities' => ['Sharjah']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('properties.total', 1)
                ->where('properties.data.0.code', 'HFM-JBA-01')
            );
    });

    test('counts each filter option against the other filters', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['ownership' => ['leased']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('facets.types', [
                    ['value' => 'worker_accommodation', 'label' => 'Worker Accommodation', 'count' => 0],
                    ['value' => 'staff_accommodation', 'label' => 'Staff Accommodation', 'count' => 1],
                    ['value' => 'residential_building', 'label' => 'Residential Building', 'count' => 0],
                ])
                ->where('facets.ownership', [
                    ['value' => 'owned', 'count' => 1],
                    ['value' => 'leased', 'count' => 1],
                ])
                ->where('facets.status', [
                    ['value' => 'active', 'count' => 1],
                    ['value' => 'inactive', 'count' => 0],
                    ['value' => 'under_maintenance', 'count' => 0],
                ])
            );
    });

    test('still offers a retired property type that is in use', function () {
        PropertyType::where('slug', 'staff_accommodation')->update(['is_active' => false]);
        PropertyType::where('slug', 'residential_building')->update(['is_active' => false]);

        $this->actingAs($this->superAdmin)
            ->get(route('properties.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('facets.types', fn ($types) => collect($types)->pluck('value')->all() === [
                    'worker_accommodation',
                    'staff_accommodation',
                ])
            );
    });

    test('sorts by the chosen column and direction', function (string $sort, string $direction, array $codes) {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['sort' => $sort, 'direction' => $direction]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', $sort)
                ->where('filters.direction', $direction)
                ->where('properties.data', fn ($properties) => collect($properties)->pluck('code')->all() === $codes)
            );
    })->with([
        'name, descending' => ['name', 'desc', ['HFM-JBA-01', 'HFM-AQZ-01']],
        'occupancy, ascending' => ['occupancy', 'asc', ['HFM-JBA-01', 'HFM-AQZ-01']],
        'occupancy, descending' => ['occupancy', 'desc', ['HFM-AQZ-01', 'HFM-JBA-01']],
        'beds, ascending' => ['beds', 'asc', ['HFM-JBA-01', 'HFM-AQZ-01']],
        'rent roll, descending' => ['rent_roll', 'desc', ['HFM-AQZ-01', 'HFM-JBA-01']],
        'lease end, leased first' => ['lease_end', 'desc', ['HFM-JBA-01', 'HFM-AQZ-01']],
    ]);

    test('falls back to the defaults for unknown options', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', [
                'sort' => 'password',
                'direction' => 'sideways',
                'perPage' => 999,
                'status' => ['deleted'],
                'ownership' => 'leased',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', 'name')
                ->where('filters.direction', 'asc')
                ->where('filters.perPage', 10)
                ->where('filters.status', [])
                ->where('filters.ownership', ['leased'])
                ->where('properties.total', 1)
            );
    });

    test('splits long lists into pages', function () {
        Property::factory()
            ->count(9)
            ->for($this->superAdmin->company)
            ->create(['name' => 'Zabeel Overflow Camp']);

        $this->actingAs($this->superAdmin)
            ->get(route('properties.index', ['page' => 2]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('properties.total', 11)
                ->where('properties.current_page', 2)
                ->where('properties.last_page', 2)
                ->has('properties.data', 1)
            );
    });
});
