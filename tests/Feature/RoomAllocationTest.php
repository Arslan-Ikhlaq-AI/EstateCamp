<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
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
        'monthly_rent' => 2000,
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
        ...$attributes,
    ]);
});

test('shows who holds each room and shop, with the rent of contracts and short-term rentals', function () {
    $contractRoom = ($this->room)('R-1');
    $rentedRoom = ($this->room)('R-2');
    $emptyRoom = ($this->room)('R-3');
    ($this->room)('R-10', ['status' => 'under_maintenance']);
    ($this->line)(($this->contract)('Al Hajar Contracting'), ['unit_type' => 'room', 'room_id' => $contractRoom->id, 'monthly_rate' => 3000]);
    RoomRental::factory()->forRooms($rentedRoom)->create(['start_date' => '2026-09-01', 'end_date' => '2026-11-30', 'monthly_rent' => 2400]);
    // A terminated contract no longer holds its room.
    ($this->line)(($this->contract)('Titan Construction', attributes: ['status' => 'terminated', 'terminated_on' => '2026-06-10']), ['unit_type' => 'room', 'room_id' => $emptyRoom->id, 'monthly_rate' => 2800]);

    $shop = Shop::factory()->create(['property_id' => $this->property->id, 'shop_number' => 'S-1', 'status' => 'occupied']);
    Shop::factory()->create(['property_id' => $this->property->id, 'shop_number' => 'S-2', 'monthly_rent' => 3500]);
    // A person renting under a contract counts as a contract.
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
            ->where('rooms.1.allocation', 'short_term')
            ->where('rooms.1.holdings.0.reference.kind', 'rental')
            ->where('rooms.1.holdings.0.endsOn', '2026-11-30')
            ->where('rooms.1.monthly', 2400)
            ->where('rooms.2.number', 'R-3')
            ->where('rooms.2.allocation', 'empty')
            ->where('rooms.2.holdings', [])
            ->where('rooms.2.standardRent', 2000)
            ->where('rooms.3.number', 'R-10')
            ->where('rooms.3.allocation', 'empty')
            ->where('rooms.3.inService', false)
            ->where('shops.0.allocation', 'contract')
            ->where('shops.0.holdings.0.client.name', 'Sajid Khan')
            ->where('shops.1.allocation', 'empty')
            ->has('apartments', 0)
            ->where('summaries.rooms', [
                'total' => 4,
                'contract' => 1,
                'short_term' => 1,
                'empty' => 2,
                'available' => 1,
                'freeing' => 0,
                'clients' => ['contract' => 1, 'short_term' => 1],
                'standardRent' => ['let' => 4000, 'available' => 2000],
                'rent' => ['contract' => 3000, 'short_term' => 2400, 'overall' => 5400],
                'difference' => 1400,
                'expected' => 5400,
            ])
            ->where('summaries.shops.available', 1)
            ->where('summaries.shops.rent', ['contract' => 4000, 'short_term' => 0, 'overall' => 4000])
            ->where('summaries.shops.standardRent.available', 3500)
            ->where('summaries.apartments.total', 0)
        );
});

test('a unit whose contract ends this month is available in the next', function () {
    $room = ($this->room)('101');
    ($this->line)(($this->contract)('Titan Construction'), ['unit_type' => 'room', 'room_id' => $room->id, 'monthly_rate' => 3100, 'end_date' => '2026-10-25']);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.from', '2026-10-01')
            ->where('period.to', '2026-10-31')
            ->where('includesToday', true)
            ->where('rooms.0.allocation', 'contract')
            ->where('rooms.0.freeFrom', '2026-10-26')
            ->where('summaries.rooms.freeing', 1)
            ->where('summaries.rooms.available', 0)
            // October's rent for the 25 of its 31 days the contract runs.
            ->where('summaries.rooms.expected', 2500)
        );

    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.kind', 'month')
            ->where('includesToday', false)
            ->where('rooms.0.allocation', 'empty')
            ->where('summaries.rooms.available', 1)
            ->where('summaries.rooms.rent.overall', 0)
        );

    // Any range of days: 20 to 25 October are 6 of October's 31 days.
    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-10-20..2026-11-10']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('period.kind', 'range')
            ->where('rooms.0.allocation', 'contract')
            ->where('summaries.rooms.expected', 600)
        );

    // All time and unreadable values fall back to this month.
    foreach (['all', 'next-ish'] as $value) {
        $this->actingAs($this->user)
            ->get(route('properties.allocation', [$this->property, 'period' => $value]))
            ->assertInertia(fn (Assert $page) => $page->where('period.from', '2026-10-01')->where('period.to', '2026-10-31'));
    }
});

test('a past period shows who held each unit then', function () {
    $leasedRoom = ($this->room)('101');
    $rentedRoom = ($this->room)('102');
    ($this->line)(($this->contract)('Titan Construction', attributes: ['status' => 'terminated', 'terminated_on' => '2026-06-10']), ['unit_type' => 'room', 'room_id' => $leasedRoom->id, 'monthly_rate' => 3000]);
    RoomRental::factory()->forRooms($rentedRoom)->create(['end_date' => '2026-06-30', 'status' => 'ended', 'moved_out_on' => '2026-05-01']);
    // The next tenant moves in as the first moves out.
    RoomRental::factory()->forRooms($rentedRoom)->create(['start_date' => '2026-05-01', 'end_date' => '2026-10-31', 'monthly_rent' => 1800]);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-04']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.0.allocation', 'contract')
            ->where('rooms.1.allocation', 'short_term')
            ->where('rooms.1.holdings.0.endsOn', '2026-04-30')
            ->where('rooms.1.freeFrom', null)
        );

    // Over April to June the room's rent is the new tenant's, not both added up,
    // while the rent due counts each tenant for their own months.
    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-04-01..2026-06-30']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.0.allocation', 'contract')
            ->where('rooms.0.freeFrom', '2026-06-10')
            ->where('rooms.1.allocation', 'short_term')
            ->where('rooms.1.holdings.0.monthly', 1800)
            ->where('rooms.1.holdings.0.isLatest', true)
            ->where('rooms.1.holdings.1.isLatest', false)
            ->where('rooms.1.monthly', 1800)
            ->where('summaries.rooms.rent.short_term', 1800)
            ->where('summaries.rooms.clients.short_term', 2)
            // Room 101: April, May and 9 of June's 30 days at 3,000; room 102: April at 2,400, then May and June at 1,800.
            ->where('summaries.rooms.expected', 6900 + 6000)
        );

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.0.allocation', 'empty')
            ->where('rooms.1.allocation', 'short_term')
        );
});

test('shares a short-term rental’s rent equally between its rooms', function () {
    RoomRental::factory()->forRooms(($this->room)('101'), ($this->room)('102'))->create(['start_date' => '2026-10-01', 'monthly_rent' => 3000]);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.0.allocation', 'short_term')
            ->where('rooms.0.monthly', 1500)
            ->where('rooms.1.allocation', 'short_term')
            ->where('rooms.1.monthly', 1500)
            ->where('summaries.rooms.rent.short_term', 3000)
            ->where('summaries.rooms.clients.short_term', 1)
        );
});

test('hides another company\'s property', function () {
    $this->actingAs(User::factory()->create(['company_id' => Property::factory()->create()->company_id]))
        ->get(route('properties.allocation', $this->property))
        ->assertNotFound();
});
