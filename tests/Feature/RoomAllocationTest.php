<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Occupancy;
use App\Models\Occupant;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\Shop;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->room = fn (string $number, array $attributes = []) => Room::factory()->create([
        'property_id' => $this->property->id,
        'room_number' => $number,
        'capacity' => 4,
        'occupied_count' => 0,
        'rent_per_bed' => 500,
        ...$attributes,
    ]);
    $this->contract = fn (string $clientName, bool $isIndividual = false, array $attributes = []) => Contract::factory()->active()->create([
        'client_id' => Client::factory()
            ->when($isIndividual, fn ($factory) => $factory->individual())
            ->create(['company_id' => $this->property->company_id, 'name' => $clientName])
            ->id,
        ...$attributes,
    ]);
    $this->line = fn (Contract $contract, array $attributes) => ContractLine::factory()->create([
        'contract_id' => $contract->id,
        'property_id' => $this->property->id,
        'quantity' => 1,
        ...$attributes,
    ]);
});

test('shows who holds each room and shop, with the rent of contracts and individuals', function () {
    $contractRoom = ($this->room)('R-1');
    $rentedRoom = ($this->room)('R-2');
    $emptyRoom = ($this->room)('R-3');
    ($this->room)('R-10', ['status' => 'under_maintenance']);
    ($this->line)(($this->contract)('Al Hajar Contracting'), ['unit_type' => 'room', 'room_id' => $contractRoom->id, 'monthly_rate' => 3000]);
    RoomRental::factory()->wholeRoom()->create(['room_id' => $rentedRoom->id, 'monthly_rent' => 2400]);
    // A terminated contract no longer holds its room.
    ($this->line)(($this->contract)('Titan Construction', attributes: ['status' => 'terminated']), ['unit_type' => 'room', 'room_id' => $emptyRoom->id, 'monthly_rate' => 2800]);

    $shop = Shop::factory()->create(['property_id' => $this->property->id, 'shop_number' => 'S-1', 'status' => 'occupied']);
    Shop::factory()->create(['property_id' => $this->property->id, 'shop_number' => 'S-2', 'monthly_rent' => 3500]);
    ($this->line)(($this->contract)('Sajid Khan', isIndividual: true), ['unit_type' => 'shop', 'shop_id' => $shop->id, 'monthly_rate' => 4000]);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Properties/Allocation')
            ->where('property.code', $this->property->code)
            ->where('rooms.0.number', 'R-1')
            ->where('rooms.0.allocation', 'contract')
            ->where('rooms.0.holdings.0.client.name', 'Al Hajar Contracting')
            ->where('rooms.0.monthly', 3000)
            ->where('rooms.1.number', 'R-2')
            ->where('rooms.1.allocation', 'individual')
            ->where('rooms.1.holdings.0.reference.kind', 'rental')
            ->where('rooms.1.holdings.0.endsOn', null)
            ->where('rooms.1.monthly', 2400)
            ->where('rooms.2.number', 'R-3')
            ->where('rooms.2.allocation', 'empty')
            ->where('rooms.2.holdings', [])
            ->where('rooms.2.listRent', 2000)
            ->where('rooms.3.number', 'R-10')
            ->where('rooms.3.allocation', 'empty')
            ->where('rooms.3.inService', false)
            ->where('shops.0.allocation', 'individual')
            ->where('shops.0.holdings.0.client.name', 'Sajid Khan')
            ->where('shops.1.allocation', 'empty')
            ->has('apartments', 0)
            ->where('summaries.rooms', [
                'total' => 4,
                'contract' => 1,
                'individual' => 1,
                'empty' => 2,
                'available' => 1,
                'clients' => ['contract' => 1, 'individual' => 1],
                'rent' => ['contract' => 3000, 'individual' => 2400, 'overall' => 5400],
                'availableListRent' => 2000,
            ])
            ->where('summaries.shops.available', 1)
            ->where('summaries.shops.rent', ['contract' => 0, 'individual' => 4000, 'overall' => 4000])
            ->where('summaries.shops.availableListRent', 3500)
            ->where('summaries.apartments.total', 0)
        );
});

test('places beds a contract rents across the property in the rooms its people stay in', function () {
    $room = ($this->room)('101');
    $contract = ($this->contract)('Noor Alasayel Technical Services');
    $line = ($this->line)($contract, ['unit_type' => 'bed', 'room_id' => null, 'quantity' => 6, 'monthly_rate' => 450]);

    foreach ($room->beds()->take(2)->pluck('id') as $bedId) {
        $stay = new Occupancy(['check_in_date' => '2026-10-01']);
        $stay->forceFill([
            'company_id' => $line->company_id,
            'occupant_id' => Occupant::factory()->create(['client_id' => $contract->client_id])->id,
            'contract_line_id' => $line->id,
            'bed_id' => $bedId,
        ])->save();
    }

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.0.allocation', 'contract')
            ->where('rooms.0.holdings.0.reference.number', $contract->contract_number)
            ->where('rooms.0.monthly', 900)
        );
});

test('hides another company\'s property', function () {
    $this->actingAs(User::factory()->create(['company_id' => Property::factory()->create()->company_id]))
        ->get(route('properties.allocation', $this->property))
        ->assertNotFound();
});
