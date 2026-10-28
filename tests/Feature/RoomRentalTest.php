<?php

use App\Models\Cheque;
use App\Models\ChequeStatus;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Occupancy;
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
    // A single room and a twin room at Jebel Ali, and a four-bed room at Al Quoz.
    $this->privateRoom = ($this->room)(PropertySeeder::JEBEL_ALI, '102');
    $this->twinRoom = ($this->room)(PropertySeeder::JEBEL_ALI, '103');
    $this->dormRoom = ($this->room)(PropertySeeder::AL_QUOZ, '103');
});

/**
 * A new company renting both Jebel Ali rooms for three months from the start of October.
 *
 * @return array<string, mixed>
 */
function rentalInput(array $overrides = []): array
{
    return [
        'client_mode' => 'new',
        'new_client' => ['name' => 'BrightPath Events L.L.C.', 'phone' => '+971 55 120 3344'],
        'property_id' => test()->privateRoom->property_id,
        'room_ids' => [test()->privateRoom->id, test()->twinRoom->id],
        'months' => 3,
        'start_date' => '2026-10-01',
        'monthly_rent' => 3700,
        'security_deposit' => 3700,
        'first_payment' => 'later',
        ...$overrides,
    ];
}

/**
 * A company renting `$rooms` short-term, with rent receipts for `$paid` and a deposit receipt for `$depositPaid`.
 *
 * @param  Room|list<Room>  $rooms
 */
function rentedRooms(Room|array $rooms, array $attributes = [], float $paid = 0, float $depositPaid = 0): RoomRental
{
    $rental = RoomRental::factory()->forRooms(...(is_array($rooms) ? $rooms : [$rooms]))->create($attributes);

    foreach (array_filter(['rent' => $paid, 'deposit' => $depositPaid]) as $purpose => $amount) {
        $rental->recordPayment(['paid_on' => $rental->start_date, 'amount' => $amount, 'purpose' => $purpose, 'method' => 'cash']);
    }

    return $rental;
}

describe('renting rooms short-term', function () {
    test('rents whole rooms to a new company for a term of months, taking them without checking anyone in', function () {
        $response = $this->actingAs($this->admin)->post(route('rentals.store'), rentalInput());

        $rental = RoomRental::sole();
        $response->assertSessionHasNoErrors()
            ->assertRedirect(route('rentals.show', $rental))
            ->assertSessionHas('success', 'RNT-2026-0001 was created: BrightPath Events L.L.C. rents rooms 102, 103 until 31 Dec 2026. Record their first payment.');

        expect($rental->status)->toBe('active')
            ->and($rental->client->only(['client_type', 'name', 'phone']))->toBe(['client_type' => 'company', 'name' => 'BrightPath Events L.L.C.', 'phone' => '+971 55 120 3344'])
            ->and($rental->property_id)->toBe($this->privateRoom->property_id)
            ->and($rental->rooms()->pluck('rooms.id')->sort()->values()->all())->toBe([$this->privateRoom->id, $this->twinRoom->id])
            ->and($rental->end_date->toDateString())->toBe('2026-12-31')
            ->and($rental->termMonths())->toBe(3)
            ->and(Occupancy::count())->toBe(0)
            ->and($this->privateRoom->refresh()->occupied_count)->toBe(1);
    });

    test('records the first month and the deposit as paid now, with the new company’s other details', function () {
        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput([
                'new_client' => [...rentalInput()['new_client'], 'contact_person_name' => 'Leila Haddad', 'email' => 'ops@brightpath.test', 'trade_license_number' => 'CN-5521870', 'tax_registration_number' => '100778899000003'],
                'months' => 4,
                'first_payment' => 'now',
                'payment_method' => 'bank_transfer',
                'payment_reference' => 'TRF-88120',
            ]))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success', fn (string $message) => str_ends_with($message, 'until 31 Jan 2027. The first month’s rent and the deposit are recorded as paid.'));

        $rental = RoomRental::sole();
        $rent = RentalPayment::where('purpose', 'rent')->sole();

        expect($rental->client->only(['contact_person_name', 'email', 'trade_license_number', 'tax_registration_number', 'address']))
            ->toBe(['contact_person_name' => 'Leila Haddad', 'email' => 'ops@brightpath.test', 'trade_license_number' => 'CN-5521870', 'tax_registration_number' => '100778899000003', 'address' => null])
            ->and($rental->termMonths())->toBe(4)
            ->and((float) $rent->amount)->toBe(3700.0)
            ->and($rent->only(['method', 'reference']))->toBe(['method' => 'bank_transfer', 'reference' => 'TRF-88120'])
            ->and($rent->paid_on->toDateString())->toBe('2026-10-17')
            ->and($rent->period_end->toDateString())->toBe('2026-10-31')
            ->and($rental->depositStanding()['paid'])->toBe(3700.0)
            ->and($rental->rentStanding()['nextDue']->toDateString())->toBe('2026-11-01');

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['room_ids' => [$this->dormRoom->id], 'property_id' => $this->dormRoom->property_id, 'first_payment' => 'now', 'payment_method' => null]))
            ->assertSessionHasErrors('payment_method');
    });

    test('rents to a company already on file, but not to a person', function () {
        $company = Client::factory()->create(['company_id' => $this->company->id]);
        $person = Client::factory()->individual()->create(['company_id' => $this->company->id, 'name' => 'Grace Wanjiru']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['client_mode' => 'existing', 'client_id' => $person->id]))
            ->assertSessionHasErrors(['client_id' => 'Grace Wanjiru is a person. Short-term rentals are for companies.']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['client_mode' => 'existing', 'client_id' => $company->id]))
            ->assertSessionHasNoErrors();

        expect(RoomRental::sole()->client_id)->toBe($company->id)
            ->and(Client::count())->toBe(2);
    });

    test('refuses rooms a contract or another rental holds, and rooms in another property', function () {
        $contract = Contract::factory()->active()->create(['client_id' => Client::factory()->create(['company_id' => $this->company->id])->id]);
        ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->privateRoom->property_id, 'room_id' => $this->privateRoom->id, 'unit_type' => 'room', 'quantity' => 1]);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput())
            ->assertSessionHasErrors(['room_ids' => 'Room 102 is no longer free. Choose another.']);

        rentedRooms($this->twinRoom, ['start_date' => '2026-10-01']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['room_ids' => [$this->twinRoom->id]]))
            ->assertSessionHasErrors(['room_ids' => 'Room 103 is no longer free. Choose another.']);

        $this->actingAs($this->admin)
            ->post(route('rentals.store'), rentalInput(['room_ids' => [$this->dormRoom->id]]))
            ->assertSessionHasErrors(['room_ids' => 'Choose rooms in this property.']);
    });

    test('keeps rooms held short-term out of contracts', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-10-01']);
        $client = Client::factory()->create(['company_id' => $this->company->id]);
        $contract = Contract::factory()->active()->create(['client_id' => $client->id, 'start_date' => '2026-01-01', 'end_date' => '2026-12-31']);
        $line = ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->dormRoom->property_id]);
        $dates = ['start_date' => '2026-11-01', 'end_date' => '2027-10-31'];

        expect($line->availableBeds()->pluck('room_id')->unique()->all())->not->toContain($this->dormRoom->id);

        $this->actingAs($this->admin)
            ->post(route('contracts.store'), [
                'client_id' => $client->id,
                ...$dates,
                'billing_cycle' => 'monthly',
                'payment_terms_days' => 7,
                'monthly_rent' => 2400,
                'lines' => [['unit_type' => 'room', 'property_id' => $this->dormRoom->property_id, 'room_id' => $this->dormRoom->id]],
            ])
            ->assertSessionHasErrors(['lines.0.room_id' => "Rented short-term under {$rental->rental_number} until 31 Dec 2026."]);
    });

    test('shows the form with the free rooms of each property, and frees rooms once the term is over', function () {
        rentedRooms($this->privateRoom, ['start_date' => '2026-10-01']);
        rentedRooms($this->twinRoom, ['start_date' => '2026-07-01']);

        $this->actingAs($this->admin)
            ->get(route('rentals.create', ['room' => $this->twinRoom->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rentals/Form')
                ->where('defaults.property_id', $this->twinRoom->property_id)
                ->where('defaults.room_ids', [$this->twinRoom->id])
                ->where('properties', function ($properties) {
                    $rooms = collect(collect($properties)->firstWhere('id', $this->privateRoom->property_id)['rooms'])->pluck('id');

                    return $rooms->contains($this->twinRoom->id) && $rooms->doesntContain($this->privateRoom->id);
                })
                ->where('maxMonths', RoomRental::MAX_TERM_MONTHS)
            );
    });
});

describe('rent', function () {
    test('works out what is owed, paid to date and overdue once the grace days pass', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-08-01', 'end_date' => '2027-01-31', 'monthly_rent' => 1000], paid: 1000);

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
                ->has('statement', 6)
                ->where('statement.0.status', 'paid')
                ->where('statement.2.status', 'unpaid')
                ->where('statement.3.status', 'upcoming')
                ->where('statement.5.end', '2027-01-31')
            );

        expect($rental->rentStanding(CarbonImmutable::parse('2026-09-06'))['standing'])->toBe('due')
            ->and($rental->rentStanding(CarbonImmutable::parse('2026-09-07'))['standing'])->toBe('overdue');
    });

    test('charges a month cut short by the end date for its days', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-10-01', 'end_date' => '2026-11-15', 'monthly_rent' => 3000]);

        expect($rental->rentDue(CarbonImmutable::parse('2026-11-20')))->toBe(4500.0);
    });

    test('records a cash payment as a receipt for the months it pays', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 1000]);

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
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 1000]);

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
        $rental = rentedRooms($this->dormRoom);
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
        $rental = rentedRooms($this->dormRoom, paid: 900);
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
    test('moves the tenant out, handing back the deposit and freeing the room', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 1800, depositPaid: 900);

        $this->actingAs($this->admin)
            ->post(route('rentals.end', $rental), ['moved_out_on' => '2026-10-17', 'deposit_refunded' => 600, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasNoErrors();

        $rental->refresh();

        expect($rental->status)->toBe('ended')
            ->and($rental->moved_out_on->toDateString())->toBe('2026-10-17')
            ->and((float) $rental->deposit_refunded)->toBe(600.0)
            ->and($rental->depositStanding()['held'])->toBe(300.0)
            ->and(RoomRental::heldRoomIds($this->company->id))->toBe([])
            ->and($this->dormRoom->refresh()->occupied_count)->toBe(0);
    });

    test('hands back no more deposit than was paid', function () {
        $rental = rentedRooms($this->dormRoom, ['security_deposit' => 900], depositPaid: 500);

        $this->actingAs($this->admin)
            ->post(route('rentals.end', $rental), ['moved_out_on' => '2026-10-20', 'deposit_refunded' => 900, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasErrors(['deposit_refunded' => 'Only 500 of the deposit was paid, so no more can be handed back.']);

        expect($rental->fresh()->status)->toBe('active');
    });

    test('ends an older per-bed rental when its tenant is checked out from their occupant page', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-09-01']);
        $stay = (new Occupancy(['check_in_date' => '2026-09-01']))->forceFill([
            'company_id' => $this->company->id,
            'occupant_id' => Occupant::factory()->create(['client_id' => $rental->client_id])->id,
            'bed_id' => $this->dormRoom->beds()->orderBy('id')->value('id'),
            'room_rental_id' => $rental->id,
        ]);
        $stay->save();

        $this->actingAs($this->admin)
            ->patch(route('occupancies.check-out', $stay), ['check_out_date' => '2026-10-17'])
            ->assertSessionHasNoErrors();

        expect($rental->fresh()->status)->toBe('ended')
            ->and($rental->fresh()->moved_out_on->toDateString())->toBe('2026-10-17');
    });

    test('keeps the rent and start date once rent is paid, but lets the term grow', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-10-01', 'monthly_rent' => 900], paid: 900);
        $terms = ['months' => 3, 'monthly_rent' => 900, 'security_deposit' => 900, 'start_date' => '2026-10-01'];

        $this->actingAs($this->admin)
            ->put(route('rentals.update', $rental), [...$terms, 'monthly_rent' => 1100])
            ->assertSessionHasErrors('monthly_rent');

        $this->actingAs($this->admin)
            ->put(route('rentals.update', $rental), [...$terms, 'months' => 6])
            ->assertSessionHasNoErrors();

        expect($rental->fresh()->end_date->toDateString())->toBe('2027-03-31')
            ->and((float) $rental->fresh()->monthly_rent)->toBe(900.0);
    });

    test('will not grow a term into a room rented to someone else since', function () {
        $finished = rentedRooms($this->dormRoom, ['start_date' => '2026-07-01', 'monthly_rent' => 900]);
        rentedRooms($this->dormRoom, ['start_date' => '2026-10-01']);

        $this->actingAs($this->admin)
            ->put(route('rentals.update', $finished), ['months' => 6, 'monthly_rent' => 900, 'security_deposit' => 2400, 'start_date' => '2026-07-01'])
            ->assertSessionHasErrors(['months' => 'Room 103 has since been rented to someone else, so the term cannot be made longer.']);

        expect($finished->fresh()->end_date->toDateString())->toBe('2026-09-30');
    });

    test('lists rentals and narrows them to those overdue', function () {
        $paidUp = rentedRooms([$this->privateRoom, $this->twinRoom], ['start_date' => '2026-10-01', 'monthly_rent' => 1500], paid: 1500);
        $overdue = rentedRooms($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 900);

        $this->actingAs($this->admin)
            ->get(route('rentals.index', ['standing' => ['overdue']]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rentals/Index')
                ->where('rentals.total', 1)
                ->where('rentals.data.0.number', $overdue->rental_number)
                ->where('rentals.data.0.rooms.0.number', '103')
                ->where('summary.active', 2)
                ->where('summary.rooms', 3)
                ->where('summary.arrears', ['count' => 1, 'amount' => 900, 'overdue' => 1])
                ->where('facets.standing', [['value' => 'paid_up', 'count' => 1], ['value' => 'due', 'count' => 0], ['value' => 'overdue', 'count' => 1]])
            );

        expect($paidUp->rentStanding()['standing'])->toBe('paid_up');
    });

    test('shows a company’s rentals on their client page', function () {
        $rental = rentedRooms($this->dormRoom, ['start_date' => '2026-09-01', 'monthly_rent' => 900], paid: 900);

        $this->actingAs($this->admin)
            ->get(route('clients.show', $rental->client_id))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rentals', 1)
                ->where('rentals.0.number', $rental->rental_number)
                ->where('rentals.0.standing.arrears', 900)
            );
    });

    test('hides another company’s rentals and receipts', function () {
        $rental = rentedRooms(Room::factory()->create(), paid: 900);
        $receipt = RentalPayment::sole();

        $this->actingAs($this->admin)->get(route('rentals.show', $rental))->assertNotFound();
        $this->actingAs($this->admin)->get(route('rental-payments.show', $receipt))->assertNotFound();
        $this->actingAs($this->admin)->post(route('rentals.payments.store', $rental), ['purpose' => 'rent', 'method' => 'cash', 'amount' => 10, 'paid_on' => '2026-10-17'])->assertNotFound();

        expect(RentalPayment::count())->toBe(1);
    });
});
