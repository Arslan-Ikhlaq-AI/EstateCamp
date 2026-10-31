<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Occupancy;
use App\Models\Occupant;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->gulfBuilders = Client::where('name', ClientSeeder::GULF_BUILDERS)->sole();
    $alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->room101 = $alQuoz->rooms()->where('room_number', '101')->sole();
    $this->room102 = $alQuoz->rooms()->where('room_number', '102')->sole();
    $this->line101 = ContractLine::where('room_id', $this->room101->id)->sole();
    $this->line102 = ContractLine::where('room_id', $this->room102->id)->sole();
});

/**
 * @return array<string, mixed>
 */
function checkInInput(ContractLine $line, Occupant $occupant, array $overrides = []): array
{
    return [
        'contract_line_id' => $line->id,
        'occupant_id' => $occupant->id,
        'check_in_date' => '2026-10-17',
        ...$overrides,
    ];
}

test('checks a new worker into the room their contract line rents', function () {
    $worker = Occupant::factory()->create(['client_id' => $this->gulfBuilders->id]);

    $this->actingAs($this->superAdmin)
        ->post(route('occupancies.store'), checkInInput($this->line101, $worker))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('occupants.show', $worker));

    expect($worker->currentStay->room_id)->toBe($this->room101->id)
        ->and($this->room101->peopleStaying())->toBe(8);
});

test('refuses check-ins that break the rules', function (Closure $input, string $field) {
    $this->actingAs($this->superAdmin)
        ->post(route('occupancies.store'), $input->call($this))
        ->assertSessionHasErrors($field);

    expect($this->room101->peopleStaying())->toBe(7);
})->with([
    'a room already sleeping as many as it takes' => [function () {
        $worker = Occupant::factory()->create(['client_id' => $this->gulfBuilders->id]);

        return checkInInput($this->line102, $worker);
    }, 'contract_line_id'],
    'a room out of service' => [function () {
        $this->room101->update(['status' => 'under_maintenance']);
        $worker = Occupant::factory()->create(['client_id' => $this->gulfBuilders->id]);

        return checkInInput($this->line101, $worker);
    }, 'contract_line_id'],
    'someone registered with another client' => [function () {
        $stranger = Occupant::factory()->create(['client_id' => Client::where('name', ClientSeeder::AL_NOOR)->value('id')]);

        return checkInInput($this->line101, $stranger);
    }, 'occupant_id'],
    'someone already staying' => [function () {
        $staying = Occupant::where('full_name', 'Mohammed Rafiq')->sole();

        return checkInInput($this->line101, $staying);
    }, 'occupant_id'],
    'a date in the future' => [function () {
        $worker = Occupant::factory()->create(['client_id' => $this->gulfBuilders->id]);

        return checkInInput($this->line101, $worker, ['check_in_date' => '2026-10-20']);
    }, 'check_in_date'],
]);

test('refuses a room meant for the other gender', function () {
    $desertLine = Client::where('name', ClientSeeder::DESERT_LINE)->sole();
    $maleRoom = Property::where('code', PropertySeeder::JEBEL_ALI)->sole()->rooms()->where('room_number', '201')->sole();
    $woman = Occupant::factory()->female()->create(['client_id' => $desertLine->id]);

    $this->actingAs($this->superAdmin)
        ->post(route('occupancies.store'), checkInInput(ContractLine::where('room_id', $maleRoom->id)->sole(), $woman))
        ->assertSessionHasErrors('occupant_id');
});

test('refuses check-ins under a contract that is not running', function () {
    $this->line101->contract->forceFill(['status' => 'ended'])->save();
    $worker = Occupant::factory()->create(['client_id' => $this->gulfBuilders->id]);

    $this->actingAs($this->superAdmin)
        ->post(route('occupancies.store'), checkInInput($this->line101, $worker))
        ->assertSessionHasErrors('contract_line_id');
});

test('checks a worker out and frees their place, while the room stays let to the contract', function () {
    $stay = Occupant::where('full_name', 'Mohammed Rafiq')->sole()->currentStay;

    $this->actingAs($this->superAdmin)
        ->patch(route('occupancies.check-out', $stay), ['check_out_date' => '2026-10-17'])
        ->assertSessionHasNoErrors();

    expect($stay->refresh()->check_out_date->toDateString())->toBe('2026-10-17')
        ->and($this->room101->peopleStaying())->toBe(6)
        ->and($this->room101->refresh()->is_occupied)->toBeTrue();
});

test('refuses a check-out on or before the check-in date', function () {
    $stay = Occupant::where('full_name', 'Mohammed Rafiq')->sole()->currentStay;

    $this->actingAs($this->superAdmin)
        ->patch(route('occupancies.check-out', $stay), ['check_out_date' => $stay->check_in_date->toDateString()])
        ->assertSessionHasErrors('check_out_date');
});

test('the check-in page shows each line\'s room and the client\'s people who are not staying', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('occupancies.create', ['contract_line' => $this->line101->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Occupancies/CheckIn')
            ->has('lines', 8)
            ->where('lines.0.id', $this->line101->id)
            ->where('lines.0.roomNumber', '101')
            ->where('lines.0.capacity', 8)
            ->where('lines.0.staying', 7)
            ->where('selectedLineId', $this->line101->id)
            ->has('occupants', 1)
            ->where('occupants.0.name', 'Santosh Rai')
        );
});

test('registers an occupant for a client', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('occupants.store'), [
            'client_id' => $this->gulfBuilders->id,
            'full_name' => 'Ali Hassan',
            'gender' => 'male',
            'id_type' => 'passport',
            'id_number' => 'PK0000001',
        ])
        ->assertSessionHasNoErrors();

    expect(Occupant::where('full_name', 'Ali Hassan')->sole()->company_id)->toBe($this->superAdmin->company_id);
});

test('an occupant checked in cannot move to another client', function () {
    $staying = Occupant::where('full_name', 'Mohammed Rafiq')->sole();

    $this->actingAs($this->superAdmin)
        ->put(route('occupants.update', $staying), [
            ...$staying->only(['full_name', 'gender', 'id_type', 'id_number']),
            'client_id' => Client::where('name', ClientSeeder::AL_NOOR)->value('id'),
        ])
        ->assertSessionHasErrors('client_id');
});

test('hides other companies\' stays and occupants', function () {
    $line = ContractLine::factory()->for(Contract::factory()->active())->create();
    $occupant = Occupant::factory()->create(['client_id' => $line->contract->client_id]);
    $stay = new Occupancy(['check_in_date' => '2026-10-01']);
    $stay->forceFill(['company_id' => $line->company_id, 'occupant_id' => $occupant->id, 'contract_line_id' => $line->id, 'room_id' => $line->room_id])->save();

    $this->actingAs($this->superAdmin)->get(route('occupants.show', $occupant))->assertNotFound();
    $this->actingAs($this->superAdmin)->patch(route('occupancies.check-out', $stay), ['check_out_date' => '2026-10-17'])->assertNotFound();
});
