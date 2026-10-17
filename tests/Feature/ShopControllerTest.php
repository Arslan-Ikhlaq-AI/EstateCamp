<?php

use App\Models\Property;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array<string, mixed>
 */
function validShopInput(Property $property, array $overrides = []): array
{
    return [
        'property_id' => $property->id,
        'shop_number' => 'G-05',
        'block' => 'A',
        'floor_number' => 0,
        'shop_type' => 'electronics',
        'area_sqm' => 40,
        'amenities' => ['air_conditioning', 'display_window'],
        'monthly_rent' => 5000,
        'security_deposit' => 2500,
        'utility_account_number' => '2048918999',
        'status' => 'vacant',
        'notes' => 'New shop.',
        ...$overrides,
    ];
}

test('guests are redirected to the login page', function () {
    $this->get(route('shops.index'))->assertRedirect(route('login'));
});

test('users without a company see an empty list and cannot add shops', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('shops.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Shops/Index')->where('company', null));

    $this->actingAs($user)->get(route('shops.create'))->assertForbidden();
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
        $this->alQuoz = Property::where('code', 'HFM-AQZ-01')->sole();
        $this->jebelAli = Property::where('code', 'HFM-JBA-01')->sole();
    });

    test('lists shops with their property and portfolio summary', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('shops.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Shops/Index')
                ->where('shops.total', 6)
                ->where('shops.data.0.property.code', 'HFM-AQZ-01')
                ->where('shops.data.0.number', 'G-01')
                ->where('summary.shops', 6)
                ->where('summary.vacant', 1)
                ->where('summary.occupied', 3)
                ->where('summary.reserved', 1)
                ->where('summary.maintenance', 1)
                ->where('summary.occupancyRate', 60)
                ->where('summary.rentRoll', 16900)
            );
    });

    test('narrows the list by each filter', function (array $query, int $total) {
        $this->actingAs($this->superAdmin)
            ->get(route('shops.index', $query))
            ->assertInertia(fn (Assert $page) => $page->where('shops.total', $total));
    })->with([
        'property' => [['properties' => ['HFM-JBA-01']], 2],
        'status' => [['status' => ['occupied']], 3],
        'type' => [['types' => ['grocery']], 1],
        'two types' => [['types' => ['grocery', 'cafe']], 2],
        'search by number' => [['search' => 'G-0'], 6],
        'search by property name' => [['search' => 'jebel'], 2],
        'unknown status is ignored' => [['status' => ['sold']], 6],
    ]);

    test('counts each filter option against the other filters', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('shops.index', ['properties' => ['HFM-JBA-01']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('facets.properties.0.count', 4)
                ->where('facets.properties.1.count', 2)
                ->where('facets.status', [
                    ['value' => 'vacant', 'count' => 0],
                    ['value' => 'occupied', 'count' => 1],
                    ['value' => 'reserved', 'count' => 0],
                    ['value' => 'under_maintenance', 'count' => 1],
                    ['value' => 'inactive', 'count' => 0],
                ])
                ->where('facets.types.0', ['value' => 'barber', 'count' => 0])
                ->where('facets.types.1', ['value' => 'cafe', 'count' => 1])
            );
    });

    test('sorts by rent', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('shops.index', ['sort' => 'rent', 'direction' => 'desc']))
            ->assertInertia(fn (Assert $page) => $page->where('shops.data.0.number', 'G-04'));
    });

    test('ignores other companies\' shops', function () {
        Shop::factory()->count(3)->create();

        $this->actingAs($this->superAdmin)
            ->get(route('shops.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('shops.total', 6)
                ->where('summary.shops', 6)
            );
    });

    test('shows a shop with its details', function () {
        $shop = $this->alQuoz->shops()->where('shop_number', 'G-04')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('shops.show', $shop))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Shops/Show')
                ->where('currency', 'AED')
                ->where('shop.number', 'G-04')
                ->where('shop.type', 'restaurant')
                ->where('shop.property.code', 'HFM-AQZ-01')
                ->where('shop.monthlyRent', 9500)
                ->where('shop.utilityAccountNumber', '2048918032')
                ->has('shop.amenities', 5)
            );
    });

    test('shows the form for adding a shop to a chosen property', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('shops.create', ['property' => $this->jebelAli->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Shops/Form')
                ->where('shop', null)
                ->where('propertyId', $this->jebelAli->id)
                ->has('properties', 2)
                ->has('types')
            );
    });

    test('adds a shop to a property of the company', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), validShopInput($this->alQuoz))
            ->assertRedirect(route('shops.show', Shop::where('shop_number', 'G-05')->sole()))
            ->assertSessionHas('success', 'Shop G-05 was added to Al Quoz Worker Village.');

        $shop = $this->alQuoz->shops()->where('shop_number', 'G-05')->sole();

        expect($shop->company_id)->toBe($this->alQuoz->company_id)
            ->and($shop->amenities)->toBe(['air_conditioning', 'display_window'])
            ->and($shop->shop_type)->toBe('electronics')
            ->and((float) $shop->monthly_rent)->toBe(5000.0);
    });

    test('adds a shop with only the required fields', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), [
                'property_id' => $this->alQuoz->id,
                'shop_number' => 'G-06',
                'status' => 'vacant',
            ])
            ->assertSessionHasNoErrors();

        $shop = $this->alQuoz->shops()->where('shop_number', 'G-06')->sole();

        expect($shop->amenities)->toBe([])
            ->and($shop->shop_type)->toBeNull()
            ->and($shop->monthly_rent)->toBeNull();
    });

    test('allows the same number in a different property', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), validShopInput($this->jebelAli, ['shop_number' => 'G-04']))
            ->assertSessionHasNoErrors();
    });

    test('accepts a shop type that is not one of the suggestions', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), validShopInput($this->alQuoz, ['shop_type' => 'tailoring']))
            ->assertSessionHasNoErrors();
    });

    test('rejects invalid shops', function (array $overrides, string $field) {
        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), validShopInput($this->alQuoz, $overrides))
            ->assertSessionHasErrors($field);

        expect($this->alQuoz->shops()->count())->toBe(4);
    })->with([
        'number taken in the property' => [['shop_number' => 'G-01'], 'shop_number'],
        'no number' => [['shop_number' => ''], 'shop_number'],
        'unknown amenity' => [['amenities' => ['pool']], 'amenities.0'],
        'unknown status' => [['status' => 'sold'], 'status'],
        'type too long' => [['shop_type' => str_repeat('x', 41)], 'shop_type'],
        'negative rent' => [['monthly_rent' => -1], 'monthly_rent'],
        'no area' => [['area_sqm' => 0], 'area_sqm'],
    ]);

    test('refuses a property from another company', function () {
        $otherProperty = Property::factory()->create();

        $this->actingAs($this->superAdmin)
            ->post(route('shops.store'), validShopInput($otherProperty))
            ->assertSessionHasErrors('property_id');

        expect($otherProperty->shops()->count())->toBe(0);
    });

    test('updates a shop', function () {
        $shop = $this->alQuoz->shops()->where('shop_number', 'G-04')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('shops.edit', $shop))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Shops/Form')
                ->where('shop.shop_number', 'G-04')
                ->where('shop.status', 'vacant')
            );

        $this->actingAs($this->superAdmin)
            ->put(route('shops.update', $shop), validShopInput($this->jebelAli, [
                'shop_number' => 'G-04',
                'status' => 'occupied',
                'monthly_rent' => 9800,
            ]))
            ->assertRedirect(route('shops.show', $shop))
            ->assertSessionHas('success', 'Shop G-04 was updated.');

        $shop->refresh();

        expect($shop->status)->toBe('occupied')
            ->and((float) $shop->monthly_rent)->toBe(9800.0)
            ->and($shop->property_id)->toBe($this->jebelAli->id)
            ->and($shop->company_id)->toBe($this->jebelAli->company_id);
    });

    test('keeps its own number when saved without changes', function () {
        $shop = $this->alQuoz->shops()->where('shop_number', 'G-01')->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('shops.update', $shop), validShopInput($this->alQuoz, ['shop_number' => 'G-01']))
            ->assertSessionHasNoErrors();
    });

    test('hides other companies\' shops', function () {
        $otherShop = Shop::factory()->create();

        $this->actingAs($this->superAdmin)->get(route('shops.show', $otherShop))->assertNotFound();
        $this->actingAs($this->superAdmin)->get(route('shops.edit', $otherShop))->assertNotFound();
        $this->actingAs($this->superAdmin)
            ->put(route('shops.update', $otherShop), validShopInput($this->alQuoz))
            ->assertNotFound();
    });
});
