<?php

use App\Models\Apartment;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array<string, mixed>
 */
function validApartmentInput(Property $property, array $overrides = []): array
{
    return [
        'property_id' => $property->id,
        'apartment_number' => 'C-201',
        'block' => 'C',
        'floor_number' => 2,
        'bedrooms' => 2,
        'bathrooms' => 2,
        'area_sqm' => 90,
        'furnishing_status' => 'furnished',
        'max_occupants' => 4,
        'amenities' => ['air_conditioning', 'wifi'],
        'monthly_rent' => 8000,
        'security_deposit' => 4000,
        'utility_account_number' => '2048917999',
        'status' => 'vacant',
        'notes' => 'New apartment.',
        ...$overrides,
    ];
}

test('guests are redirected to the login page', function () {
    $this->get(route('apartments.index'))->assertRedirect(route('login'));
});

test('users without a company see an empty list and cannot add apartments', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('apartments.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Apartments/Index')->where('company', null));

    $this->actingAs($user)->get(route('apartments.create'))->assertForbidden();
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
        $this->alQuoz = Property::where('code', 'HFM-AQZ-01')->sole();
        $this->jebelAli = Property::where('code', 'HFM-JBA-01')->sole();
    });

    test('lists apartments with their property and portfolio summary', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('apartments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Apartments/Index')
                ->where('apartments.total', 7)
                ->where('apartments.data.0.property.code', 'HFM-AQZ-01')
                ->where('apartments.data.0.number', 'C-101')
                ->where('summary.apartments', 7)
                ->where('summary.vacant', 2)
                ->where('summary.occupied', 3)
                ->where('summary.reserved', 1)
                ->where('summary.maintenance', 1)
                ->where('summary.occupancyRate', 50)
                ->where('summary.rentRoll', 19200)
            );
    });

    test('narrows the list by each filter', function (array $query, int $total) {
        $this->actingAs($this->superAdmin)
            ->get(route('apartments.index', $query))
            ->assertInertia(fn (Assert $page) => $page->where('apartments.total', $total));
    })->with([
        'property' => [['properties' => ['HFM-JBA-01']], 5],
        'status' => [['status' => ['under_maintenance']], 1],
        'furnishing' => [['furnishing' => ['furnished']], 4],
        'studios' => [['bedrooms' => ['0']], 2],
        'two bedrooms' => [['bedrooms' => ['2']], 3],
        'search by number' => [['search' => 'B-30'], 3],
        'search by property name' => [['search' => 'jebel'], 5],
        'unknown status is ignored' => [['status' => ['sold']], 7],
    ]);

    test('counts each filter option against the other filters', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('apartments.index', ['properties' => ['HFM-JBA-01']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('facets.properties.0.count', 2)
                ->where('facets.properties.1.count', 5)
                ->where('facets.status', [
                    ['value' => 'vacant', 'count' => 1],
                    ['value' => 'occupied', 'count' => 2],
                    ['value' => 'reserved', 'count' => 1],
                    ['value' => 'under_maintenance', 'count' => 1],
                    ['value' => 'inactive', 'count' => 0],
                ])
                ->where('facets.bedrooms', [
                    ['value' => '0', 'count' => 2],
                    ['value' => '1', 'count' => 1],
                    ['value' => '2', 'count' => 2],
                ])
            );
    });

    test('sorts by rent', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('apartments.index', ['sort' => 'rent', 'direction' => 'desc']))
            ->assertInertia(fn (Assert $page) => $page->where('apartments.data.0.number', 'B-401'));
    });

    test('ignores other companies\' apartments', function () {
        Apartment::factory()->count(3)->create();

        $this->actingAs($this->superAdmin)
            ->get(route('apartments.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('apartments.total', 7)
                ->where('summary.apartments', 7)
            );
    });

    test('shows an apartment with its details', function () {
        $apartment = $this->jebelAli->apartments()->where('apartment_number', 'B-401')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('apartments.show', $apartment))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Apartments/Show')
                ->where('currency', 'AED')
                ->where('apartment.number', 'B-401')
                ->where('apartment.property.code', 'HFM-JBA-01')
                ->where('apartment.bedrooms', 2)
                ->where('apartment.monthlyRent', 7900)
                ->where('apartment.utilityAccountNumber', '3175028447')
                ->has('apartment.amenities', 5)
            );
    });

    test('shows the form for adding an apartment to a chosen property', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('apartments.create', ['property' => $this->jebelAli->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Apartments/Form')
                ->where('apartment', null)
                ->where('propertyId', $this->jebelAli->id)
                ->has('properties', 2)
            );
    });

    test('adds an apartment to a property of the company', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('apartments.store'), validApartmentInput($this->alQuoz))
            ->assertRedirect(route('apartments.show', Apartment::where('apartment_number', 'C-201')->sole()))
            ->assertSessionHas('success', 'Apartment C-201 was added to Al Quoz Worker Village.');

        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-201')->sole();

        expect($apartment->company_id)->toBe($this->alQuoz->company_id)
            ->and($apartment->amenities)->toBe(['air_conditioning', 'wifi'])
            ->and($apartment->bedrooms)->toBe(2)
            ->and((float) $apartment->monthly_rent)->toBe(8000.0);
    });

    test('adds an apartment with only the required fields', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('apartments.store'), [
                'property_id' => $this->alQuoz->id,
                'apartment_number' => 'C-301',
                'bedrooms' => 0,
                'bathrooms' => 1,
                'status' => 'vacant',
            ])
            ->assertSessionHasNoErrors();

        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-301')->sole();

        expect($apartment->amenities)->toBe([])
            ->and($apartment->monthly_rent)->toBeNull();
    });

    test('allows the same number in a different property', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('apartments.store'), validApartmentInput($this->alQuoz, ['apartment_number' => 'B-301']))
            ->assertSessionHasNoErrors();
    });

    test('rejects invalid apartments', function (array $overrides, string $field) {
        $this->actingAs($this->superAdmin)
            ->post(route('apartments.store'), validApartmentInput($this->alQuoz, $overrides))
            ->assertSessionHasErrors($field);

        expect($this->alQuoz->apartments()->count())->toBe(2);
    })->with([
        'number taken in the property' => [['apartment_number' => 'C-101'], 'apartment_number'],
        'no number' => [['apartment_number' => ''], 'apartment_number'],
        'negative bedrooms' => [['bedrooms' => -1], 'bedrooms'],
        'unknown amenity' => [['amenities' => ['pool']], 'amenities.0'],
        'unknown status' => [['status' => 'sold'], 'status'],
        'unknown furnishing' => [['furnishing_status' => 'partly'], 'furnishing_status'],
        'no occupants allowed' => [['max_occupants' => 0], 'max_occupants'],
        'negative rent' => [['monthly_rent' => -1], 'monthly_rent'],
        'no area' => [['area_sqm' => 0], 'area_sqm'],
    ]);

    test('refuses a property from another company', function () {
        $otherProperty = Property::factory()->create();

        $this->actingAs($this->superAdmin)
            ->post(route('apartments.store'), validApartmentInput($otherProperty))
            ->assertSessionHasErrors('property_id');

        expect($otherProperty->apartments()->count())->toBe(0);
    });

    test('updates an apartment', function () {
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('apartments.edit', $apartment))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Apartments/Form')
                ->where('apartment.apartment_number', 'C-102')
                ->where('apartment.status', 'vacant')
            );

        $this->actingAs($this->superAdmin)
            ->put(route('apartments.update', $apartment), validApartmentInput($this->jebelAli, [
                'apartment_number' => 'C-102',
                'status' => 'occupied',
                'monthly_rent' => 5600,
            ]))
            ->assertRedirect(route('apartments.show', $apartment))
            ->assertSessionHas('success', 'Apartment C-102 was updated.');

        $apartment->refresh();

        expect($apartment->status)->toBe('occupied')
            ->and((float) $apartment->monthly_rent)->toBe(5600.0)
            ->and($apartment->property_id)->toBe($this->jebelAli->id)
            ->and($apartment->company_id)->toBe($this->jebelAli->company_id);
    });

    test('keeps its own number when saved without changes', function () {
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-101')->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('apartments.update', $apartment), validApartmentInput($this->alQuoz, ['apartment_number' => 'C-101']))
            ->assertSessionHasNoErrors();
    });

    test('hides other companies\' apartments', function () {
        $otherApartment = Apartment::factory()->create();

        $this->actingAs($this->superAdmin)->get(route('apartments.show', $otherApartment))->assertNotFound();
        $this->actingAs($this->superAdmin)->get(route('apartments.edit', $otherApartment))->assertNotFound();
        $this->actingAs($this->superAdmin)
            ->put(route('apartments.update', $otherApartment), validApartmentInput($this->alQuoz))
            ->assertNotFound();
    });
});
