<?php

use App\Models\Cheque;
use App\Models\ChequeStatus;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Occupant;
use App\Models\RentalPayment;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\BedSeeder;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed([PortfolioSeeder::class, BedSeeder::class]);
    Storage::fake(Cheque::IMAGE_DISK);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->room = fn (string $property, string $number) => $this->company->properties()->where('code', $property)->sole()->rooms()->where('room_number', $number)->sole();
    // A single room for women, and a four-bed room for men.
    $this->privateRoom = ($this->room)(PropertySeeder::JEBEL_ALI, '102');
    $this->dormRoom = ($this->room)(PropertySeeder::AL_QUOZ, '103');
});

/**
 * A new tenant renting the private room's bed from the start of October.
 *
 * @return array<string, mixed>
 */
function rentalInput(array $overrides = []): array
{
    return [
        'client_mode' => 'new',
        'new_client' => ['name' => 'Grace Wanjiru', 'phone' => '+971 55 120 3344', 'nationality' => 'Kenyan', 'id_type' => 'passport', 'id_number' => 'K1234567'],
        'gender' => 'female',
        'unit_type' => 'bed',
        'bed_id' => test()->privateRoom->beds()->orderBy('id')->value('id'),
        'monthly_rent' => 1500,
        'security_deposit' => 1500,
        'start_date' => '2026-10-01',
        ...$overrides,
    ];
}

/**
 * An individual renting a bed in `$room`, checked in, with rent receipts for `$paid` and a deposit receipt for `$depositPaid`.
 */
function rentedBed(Room $room, array $attributes = [], float $paid = 0, float $depositPaid = 0): RoomRental
{
    $rental = RoomRental::factory()->create(['room_id' => $room->id, ...$attributes]);
    $rental->checkIn();

    foreach (array_filter(['rent' => $paid, 'deposit' => $depositPaid]) as $purpose => $amount) {
        $rental->recordPayment(['paid_on' => $rental->start_date, 'amount' => $amount, 'purpose' => $purpose, 'method' => 'cash']);
    }

    return $rental;
}

describe('renting a bed or room', function () {
    test('rents a bed to a new individual and checks them in', function () {
        $response = $this->actingAs($this->admin)->post(route('rentals.store'), rentalInput());

        $rental = RoomRental::sole();
        $response->assertSessionHasNoErrors()->assertRedirect(route('rentals.show', $rental));

        expect($rental->rental_number)->toBe('RNT-2026-0001')
            ->and($rental->status)->toBe('active')
            ->and($rental->client->client_type)->toBe('individual')
            ->and($rental->client->name)->toBe('Grace Wanjiru')
            ->and($rental->occupant->gender)->toBe('female')
            ->and($rental->occupant->client_id)->toBe($rental->client_id)
            ->and($rental->occupancy->check_in_date->toDateString())->toBe('2026-10-01')
            ->and($rental->occupancy->contract_line_id)->toBeNull()
            ->and($this->privateRoom->fresh()->occupied_count)->toBe(1);
    });

    test('rents to an individual already on file as the person who stayed before', function () {
        $client = Client::factory()->individual()->create(['company_id' => $this->company->id]);
        $occupant = Occupant::factory()->female()->create(['client_id' => $client->id]);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['client_mode' => 'existing', 'client_id' => $client->id, 'gender' => 'male']))
            ->assertSessionHasNoErrors();

        expect(RoomRental::sole()->occupant_id)->toBe($occupant->id)
            ->and(Occupant::count())->toBe(1);
    });

    test('refuses a company client, who rents under a contract', function () {
        $client = Client::factory()->create(['company_id' => $this->company->id, 'name' => 'Gulf Builders L.L.C.']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['client_mode' => 'existing', 'client_id' => $client->id]))
            ->assertSessionHasErrors(['client_id' => 'Gulf Builders L.L.C. is a company. Companies rent under a contract.']);
    });

    test('refuses a tenant into a room for the other gender', function () {
        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['gender' => 'male']))
            ->assertSessionHasErrors(['bed_id' => 'Room 102 is for women only.']);
    });

    test('refuses a bed someone is staying in', function () {
        rentedBed($this->privateRoom);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['new_client' => [...rentalInput()['new_client'], 'id_number' => 'K7654321']]))
            ->assertSessionHasErrors(['bed_id' => 'Bed 1 in room 102 is taken.']);
    });

    test('refuses a room a contract rents, and a whole room someone already shares', function () {
        $contract = Contract::factory()->active()->create(['client_id' => Client::factory()->create(['company_id' => $this->company->id])->id]);
        ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->privateRoom->property_id, 'room_id' => $this->privateRoom->id, 'unit_type' => 'room', 'quantity' => 1]);
        rentedBed($this->dormRoom);
        $dormBed = $this->dormRoom->beds()->whereDoesntHave('occupancies')->orderBy('id')->value('id');

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput())
            ->assertSessionHasErrors(['bed_id' => 'Room 102 is rented under a contract or by another tenant.']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['gender' => 'male', 'unit_type' => 'room', 'bed_id' => $dormBed]))
            ->assertSessionHasErrors(['bed_id' => 'Someone is already staying in room 103, so it cannot be rented whole.']);
    });

    test('keeps a room rented whole to an individual out of contract bed lines', function () {
        rentedBed($this->dormRoom, ['unit_type' => 'room']);
        $contract = Contract::factory()->active()->create(['client_id' => Client::factory()->create(['company_id' => $this->company->id])->id, 'start_date' => '2026-01-01', 'end_date' => '2026-12-31']);
        $line = ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->dormRoom->property_id]);

        expect($line->availableBeds()->pluck('room_id')->unique()->all())->not->toContain($this->dormRoom->id);
    });

    test('shows the form with the rooms open to individuals', function () {
        rentedBed($this->privateRoom);

        $this->actingAs($this->admin)
            ->get(route('rentals.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rentals/Form')
                ->where('rooms', fn ($rooms) => collect($rooms)->doesntContain('id', $this->privateRoom->id) && collect($rooms)->contains('id', $this->dormRoom->id))
            );
    });
});

describe('rent', function () {
    test('works out what is owed, paid to date and overdue once the grace days pass', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-08-01', 'monthly_rent' => 1000], paid: 1000);

        $this->actingAs($this->admin)
            ->get(route('rentals.show', $rental))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rentals/Show')
                ->where('rental.standing.due', 3000)
                ->where('rental.standing.paid', 1000)
                ->where('rental.standing.arrears', 2000)
                ->where('rental.standing.paidThrough', '2026-08-31')
                ->where('rental.standing.nextDue', '2026-09-01')
                ->where('rental.standing.standing', 'overdue')
                ->where('statement.0.status', 'paid')
                ->where('statement.2.status', 'unpaid')
                ->where('statement.3.status', 'upcoming')
            );

        expect($rental->rentStanding(CarbonImmutable::parse('2026-09-06'))['standing'])->toBe('due')
            ->and($rental->rentStanding(CarbonImmutable::parse('2026-09-07'))['standing'])->toBe('overdue');
    });

    test('charges a month cut short by the end date for its days', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-10-01', 'end_date' => '2026-11-15', 'monthly_rent' => 3000]);

        expect($rental->rentDue(CarbonImmutable::parse('2026-11-20')))->toBe(4500.0);
    });

    test('records a cash payment as a receipt for the months it pays', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 1000]);

        $this->actingAs($this->admin)
            ->post(route('rentals.payments.store', $rental), ['purpose' => 'rent', 'method' => 'cash', 'amount' => 2000, 'paid_on' => '2026-10-17'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', "Receipt RR-2026-0001 was recorded for {$rental->client->name}.");

        $receipt = RentalPayment::sole();

        expect($receipt->status)->toBe('cleared')
            ->and($receipt->period_start->toDateString())->toBe('2026-10-01')
            ->and($receipt->period_end->toDateString())->toBe('2026-11-30')
            ->and($rental->rentStanding()['paidThrough']->toDateString())->toBe('2026-11-30');
    });

    test('takes a cheque into the register, makes it a receipt when it clears and voids it when it bounces', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 1000]);

        $this->actingAs($this->admin)
            ->post(route('rentals.payments.store', $rental), ['purpose' => 'rent', 'method' => 'cheque', 'amount' => 1000, 'cheque_number' => '445566', 'bank_name' => 'Mashreq', 'cheque_date' => '2026-10-15'])
            ->assertSessionHasNoErrors();

        $cheque = Cheque::sole();
        expect($cheque->direction)->toBe('received')
            ->and($cheque->status)->toBe('received')
            ->and($cheque->chequeable->is($rental))->toBeTrue()
            ->and(RentalPayment::count())->toBe(0);

        $this->actingAs($this->admin)->post(route('cheques.status', $cheque), ['cheque_status_id' => ChequeStatus::where('slug', 'submitted')->value('id'), 'date' => '2026-10-16']);
        $this->actingAs($this->admin)->post(route('cheques.status', $cheque), ['cheque_status_id' => ChequeStatus::where('slug', 'approved')->value('id'), 'date' => '2026-10-17'])->assertSessionHasNoErrors();

        $receipt = RentalPayment::sole();
        expect($receipt->cheque_id)->toBe($cheque->id)
            ->and($receipt->method)->toBe('cheque')
            ->and($rental->rentStanding()['arrears'])->toBe(0.0);

        $this->actingAs($this->admin)->post(route('cheques.status', $cheque), ['cheque_status_id' => ChequeStatus::where('slug', 'bounced')->value('id'), 'date' => '2026-10-17', 'reason' => 'Insufficient funds']);

        expect($receipt->fresh()->status)->toBe('void')
            ->and($rental->rentStanding()['arrears'])->toBe(1000.0);
    });

    test('lists a tenant’s cheque in the register under their rental', function () {
        $rental = rentedBed($this->dormRoom);
        $rental->receiveCheque(['purpose' => 'rent', 'cheque_date' => '2026-11-01', 'amount' => 900, 'cheque_number' => '318842', 'bank_name' => 'Emirates NBD']);

        $this->actingAs($this->admin)
            ->get(route('cheques.index', ['party' => ["client:{$rental->client_id}"]]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('cheques.total', 1)
                ->where('cheques.data.0.agreement', ['type' => 'room_rental', 'id' => $rental->id, 'number' => $rental->rental_number])
                ->where('cheques.data.0.party.name', $rental->client->name)
            );
    });

    test('voids a receipt made by mistake but leaves one from a cheque to the cheque', function () {
        $rental = rentedBed($this->dormRoom, paid: 900);
        $receipt = RentalPayment::sole();

        $this->actingAs($this->admin)->post(route('rental-payments.void', $receipt), ['reason' => 'Recorded twice'])->assertSessionHasNoErrors();

        expect($receipt->fresh()->status)->toBe('void')
            ->and($receipt->fresh()->void_reason)->toBe('Recorded twice')
            ->and($rental->rentStanding()['paid'])->toBe(0.0);

        $fromCheque = $rental->recordPayment(['paid_on' => '2026-10-17', 'amount' => 900, 'purpose' => 'rent', 'method' => 'cheque'], cheque: $rental->receiveCheque(['purpose' => 'rent', 'cheque_date' => '2026-10-17', 'amount' => 900, 'cheque_number' => '1', 'bank_name' => 'Mashreq']));

        $this->actingAs($this->admin)
            ->post(route('rental-payments.void', $fromCheque), ['reason' => 'Mistake'])
            ->assertSessionHasErrors(['reason' => 'This receipt came from a cheque. Mark the cheque as bounced in the cheque register instead.']);
    });
});

describe('a running rental', function () {
    test('moves the tenant out, handing back the deposit', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 1800, depositPaid: 900);

        $this->actingAs($this->admin)
            ->post(route('rentals.end', $rental), ['moved_out_on' => '2026-10-17', 'deposit_refunded' => 600, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasNoErrors();

        $rental->refresh();

        expect($rental->status)->toBe('ended')
            ->and($rental->moved_out_on->toDateString())->toBe('2026-10-17')
            ->and((float) $rental->deposit_refunded)->toBe(600.0)
            ->and($rental->occupancy->check_out_date->toDateString())->toBe('2026-10-17')
            ->and($this->dormRoom->fresh()->occupied_count)->toBe(0)
            ->and($rental->depositStanding()['held'])->toBe(300.0);
    });

    test('hands back no more deposit than was paid', function () {
        $rental = rentedBed($this->dormRoom, ['security_deposit' => 900], depositPaid: 500);

        $this->actingAs($this->admin)
            ->post(route('rentals.end', $rental), ['moved_out_on' => '2026-10-20', 'deposit_refunded' => 900, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasErrors(['deposit_refunded' => 'Only 500 of the deposit was paid, so no more can be handed back.']);

        expect($rental->fresh()->status)->toBe('active');
    });

    test('ends the rental when the tenant is checked out from their occupant page', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-09-01']);

        $this->actingAs($this->admin)
            ->patch(route('occupancies.check-out', $rental->occupancy), ['check_out_date' => '2026-10-17'])
            ->assertSessionHasNoErrors();

        expect($rental->fresh()->status)->toBe('ended')
            ->and($rental->fresh()->moved_out_on->toDateString())->toBe('2026-10-17');
    });

    test('keeps the rent and start date once rent is paid, but lets the end date change', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 900], paid: 900);
        $terms = ['monthly_rent' => 900, 'security_deposit' => 900, 'start_date' => '2026-10-01'];

        $this->actingAs($this->admin)
            ->put(route('rentals.update', $rental), [...$terms, 'monthly_rent' => 1100])
            ->assertSessionHasErrors('monthly_rent');

        $this->actingAs($this->admin)
            ->put(route('rentals.update', $rental), [...$terms, 'end_date' => '2027-03-31'])
            ->assertSessionHasNoErrors();

        expect($rental->fresh()->end_date->toDateString())->toBe('2027-03-31')
            ->and((float) $rental->fresh()->monthly_rent)->toBe(900.0);
    });

    test('lists rentals and narrows them to those overdue', function () {
        $paidUp = rentedBed($this->privateRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 1500], paid: 1500);
        $overdue = rentedBed($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 900);

        $this->actingAs($this->admin)
            ->get(route('rentals.index', ['standing' => ['overdue']]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rentals/Index')
                ->where('rentals.total', 1)
                ->where('rentals.data.0.number', $overdue->rental_number)
                ->where('summary.active', 2)
                ->where('summary.arrears', ['count' => 1, 'amount' => 900, 'overdue' => 1])
                ->where('facets.standing', [['value' => 'paid_up', 'count' => 1], ['value' => 'due', 'count' => 0], ['value' => 'overdue', 'count' => 1]])
            );

        expect($paidUp->rentStanding()['standing'])->toBe('paid_up');
    });

    test('shows an individual’s rentals on their client page', function () {
        $rental = rentedBed($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 900);

        $this->actingAs($this->admin)
            ->get(route('clients.show', $rental->client_id))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rentals', 1)
                ->where('rentals.0.number', $rental->rental_number)
                ->where('rentals.0.standing.arrears', 900)
            );
    });

    test('hides another company’s rentals and receipts', function () {
        $rental = rentedBed(Room::factory()->create(), paid: 900);
        $receipt = RentalPayment::sole();

        $this->actingAs($this->admin)->get(route('rentals.show', $rental))->assertNotFound();
        $this->actingAs($this->admin)->get(route('rental-payments.show', $receipt))->assertNotFound();
        $this->actingAs($this->admin)->post(route('rentals.payments.store', $rental), ['purpose' => 'rent', 'method' => 'cash', 'amount' => 10, 'paid_on' => '2026-10-17'])->assertNotFound();

        expect(RentalPayment::count())->toBe(1);
    });
});
