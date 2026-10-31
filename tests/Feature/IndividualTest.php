<?php

use App\Models\Client;
use App\Models\Company;
use App\Models\RoomRental;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->rooms = $this->company->properties()->where('code', PropertySeeder::JEBEL_ALI)->sole()->rooms()->orderBy('room_number')->get();

    // Grace rents two rooms from September and has paid only that month; Aaron rents nothing.
    $this->renter = Client::factory()->individual()->create(['company_id' => $this->company->id, 'name' => 'Grace Wanjiru']);
    $this->rental = RoomRental::factory()->forRooms($this->rooms[0], $this->rooms[1])->create(['client_id' => $this->renter->id, 'start_date' => '2026-09-01', 'monthly_rent' => 1800]);
    $this->rental->recordPayment(['paid_on' => '2026-09-01', 'amount' => 1800, 'purpose' => 'rent', 'method' => 'cash']);
    $this->idle = Client::factory()->individual()->create(['company_id' => $this->company->id, 'name' => 'Aaron Mensah']);
});

test('lists the people who rent, renting ones first, with their rooms and the rent they owe', function () {
    RoomRental::factory()->forRooms($this->rooms[2])->create(['client_id' => Client::factory()->create(['company_id' => $this->company->id])->id]);

    $this->actingAs($this->admin)
        ->get(route('individuals.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Individuals/Index')
            ->where('individuals.total', 2)
            ->where('individuals.data.0.name', 'Grace Wanjiru')
            ->where('individuals.data.0.rentals.0.number', $this->rental->rental_number)
            ->where('individuals.data.0.rooms', 2)
            ->where('individuals.data.0.monthlyRent', 1800)
            ->where('individuals.data.0.owed', 1800)
            ->where('individuals.data.0.standing', 'overdue')
            ->where('individuals.data.1.name', 'Aaron Mensah')
            ->where('individuals.data.1.rentals', [])
            ->where('individuals.data.1.standing', null)
            ->where('summary', ['individuals' => 2, 'renting' => 1, 'rooms' => 2, 'monthlyRent' => 1800, 'owed' => ['amount' => 1800, 'count' => 1, 'overdue' => 1]])
        );
});

test('narrows the list to people renting or not, and finds a person by ID or rental number', function () {
    Client::factory()->individual()->create();

    $this->actingAs($this->admin)
        ->get(route('individuals.index', ['renting' => ['not_renting']]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('individuals.total', 1)
            ->where('individuals.data.0.id', $this->idle->id)
            ->where('facets.renting', [['value' => 'renting', 'count' => 1], ['value' => 'not_renting', 'count' => 1]])
        );

    $this->actingAs($this->admin)
        ->get(route('individuals.index', ['search' => $this->rental->rental_number]))
        ->assertInertia(fn (Assert $page) => $page->where('individuals.total', 1)->where('individuals.data.0.id', $this->renter->id));

    $this->actingAs($this->admin)
        ->get(route('individuals.index', ['search' => $this->idle->id_number]))
        ->assertInertia(fn (Assert $page) => $page->where('individuals.total', 1)->where('individuals.data.0.id', $this->idle->id));
});

test('opens the client form on a person when adding one from the list', function () {
    $this->actingAs($this->admin)
        ->get(route('clients.create', ['type' => 'individual']))
        ->assertInertia(fn (Assert $page) => $page->component('Clients/Form')->where('defaultType', 'individual'));
});
