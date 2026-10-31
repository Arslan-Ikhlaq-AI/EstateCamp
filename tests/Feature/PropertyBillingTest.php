<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Property;
use App\Models\RentalPayment;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->room = fn (string $number) => Room::factory()->create(['property_id' => $this->property->id, 'room_number' => $number, 'capacity' => 4, 'monthly_rent' => 2000]);
    $this->contract = function (string $clientName, array $rooms, array $attributes = []): Contract {
        $contract = Contract::factory()->active()->create([
            'client_id' => Client::factory()->create(['company_id' => $this->property->company_id, 'name' => $clientName])->id,
            ...$attributes,
        ]);

        foreach ($rooms as $room) {
            ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->property->id, 'unit_type' => 'room', 'room_id' => $room->id, 'monthly_rate' => 2000]);
        }

        return $contract;
    };
    $this->rental = fn (array $rooms, array $attributes = []) => RoomRental::factory()->forRooms(...$rooms)->create([
        'client_id' => Client::factory()->create(['company_id' => $this->property->company_id, 'name' => 'Gulf Crew Services'])->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-11-30',
        'monthly_rent' => 2400,
        'security_deposit' => 0,
        ...$attributes,
    ]);
    $this->collect = fn (string $account, int $id, float $amount, string $through = '2026-10-31') => $this->actingAs($this->user)
        ->from(route('properties.allocation', $this->property))
        ->post(route('properties.billing.store', $this->property), ['account' => $account, 'account_id' => $id, 'amount' => $amount, 'method' => 'cash', 'through' => $through]);
});

test('bills each company as a whole for the month, carrying last month’s unpaid rent into it', function () {
    $contract = ($this->contract)('Al Hajar Contracting', [($this->room)('R-1'), ($this->room)('R-2')], ['start_date' => '2026-10-01', 'end_date' => '2027-09-30']);
    $rental = ($this->rental)([($this->room)('R-3'), ($this->room)('R-4')]);
    // September was only part paid, so 1,000 of it is brought into October.
    $rental->recordPayment(['paid_on' => '2026-09-01', 'amount' => 1400, 'purpose' => 'rent', 'method' => 'cash']);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->has('accounts', 2)
            ->where('collectionMethods', ['cash', 'bank_transfer', 'card'])
            ->where('accounts.0.key', "contract:{$contract->id}")
            ->where('accounts.0.client.name', 'Al Hajar Contracting')
            ->has('accounts.0.units', 2)
            ->where('accounts.0.monthly', 4000)
            ->where('accounts.0.statement.broughtForward', 0)
            ->where('accounts.0.statement.charges.0.isPlanned', true)
            ->where('accounts.0.statement.charged', 4000)
            ->where('accounts.0.statement.carriedForward', 4000)
            ->where('accounts.0.statement.toPay', 4000)
            ->where('accounts.0.collectionLimit', 48000)
            ->where('accounts.1.key', "rental:{$rental->id}")
            ->has('accounts.1.units', 2)
            ->where('accounts.1.units.0.monthly', 1200)
            ->where('accounts.1.monthly', 2400)
            ->where('accounts.1.statement.broughtForward', 1000)
            ->where('accounts.1.statement.charged', 2400)
            ->where('accounts.1.statement.received', 0)
            ->where('accounts.1.statement.carriedForward', 3400)
            ->where('accounts.1.statement.toPay', 3400)
        );
});

test('collecting from a contract issues the month’s invoice and settles it', function () {
    $contract = ($this->contract)('Al Hajar Contracting', [($this->room)('R-1')], ['start_date' => '2026-10-01', 'end_date' => '2027-09-30']);

    ($this->collect)('contract', $contract->id, 1500)->assertRedirect(route('properties.allocation', $this->property))->assertSessionHasNoErrors();

    $invoice = Invoice::query()->where('contract_id', $contract->id)->sole();
    expect($invoice->period_start->toDateString())->toBe('2026-10-01')
        ->and((float) $invoice->total)->toBe(2000.0)
        ->and((float) $invoice->amount_paid)->toBe(1500.0)
        ->and($invoice->status)->toBe('partially_paid');

    $payment = Payment::query()->sole();
    expect($payment->client_id)->toBe($contract->client_id)
        ->and($payment->received_on->toDateString())->toBe('2026-10-17')
        ->and($payment->status)->toBe('cleared');

    // The 500 left over is brought into November's bill.
    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.broughtForward', 500)
            ->where('accounts.0.statement.charged', 2000)
            ->where('accounts.0.statement.toPay', 2500)
        );
});

test('collecting from a short-term rental pays its rent as a whole, oldest month first', function () {
    $rental = ($this->rental)([($this->room)('R-3'), ($this->room)('R-4')]);
    $rental->recordPayment(['paid_on' => '2026-09-01', 'amount' => 1400, 'purpose' => 'rent', 'method' => 'cash']);

    ($this->collect)('rental', $rental->id, 3000)->assertSessionHasNoErrors();

    $receipt = RentalPayment::query()->latest('id')->first();
    expect((float) $receipt->amount)->toBe(3000.0)
        ->and($receipt->purpose)->toBe('rent')
        ->and($receipt->paid_on->toDateString())->toBe('2026-10-17')
        ->and($receipt->period_start->toDateString())->toBe('2026-09-01')
        ->and($receipt->period_end->toDateString())->toBe('2026-10-31');

    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.broughtForward', 400)
            ->where('accounts.0.statement.charged', 2400)
            ->where('accounts.0.statement.toPay', 2800)
        );
});

test('paying a contract more than its bill carries the extra into the next bill as credit', function () {
    $contract = ($this->contract)('Al Hajar Contracting', [($this->room)('R-1')], ['start_date' => '2026-10-01', 'end_date' => '2027-09-30']);

    ($this->collect)('contract', $contract->id, 2500)->assertSessionHasNoErrors();

    $advance = Payment::query()->sole();
    expect($advance->contract_id)->toBe($contract->id)
        ->and($advance->unallocatedAmount())->toBe(500.0)
        // Only October is invoiced; November is not billed ahead of time.
        ->and(Invoice::query()->sole()->status)->toBe('paid');

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.received', 2500)
            ->where('accounts.0.statement.carriedForward', -500)
            ->where('accounts.0.statement.toPay', 0)
        );

    // November's bill opens with the 500 credit, so 1,500 is left to pay.
    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.broughtForward', -500)
            ->where('accounts.0.statement.charged', 2000)
            ->where('accounts.0.statement.toPay', 1500)
        );

    ($this->collect)('contract', $contract->id, 1500, '2026-11-30')->assertSessionHasNoErrors();

    $november = Invoice::query()->whereDate('period_start', '2026-11-01')->sole();
    expect($november->status)->toBe('paid')
        ->and((float) $november->allocations()->where('payment_id', $advance->id)->value('amount'))->toBe(500.0)
        ->and($advance->unallocatedAmount())->toBe(0.0);
});

test('a cheque that clears after credit was paid keeps its leftover as credit too', function () {
    $contract = ($this->contract)('Al Hajar Contracting', [($this->room)('R-1')], ['start_date' => '2026-10-01', 'end_date' => '2027-09-30']);
    ($this->collect)('contract', $contract->id, 3000)->assertSessionHasNoErrors();
    $cheque = Cheque::factory()->forAgreement($contract)->held()->create(['cheque_date' => '2026-11-01', 'period_start' => '2026-11-01', 'period_end' => '2026-11-30', 'amount' => 2000]);

    $this->travelTo(now()->setDate(2026, 11, 2));
    $cheque->deposit(today());
    $cheque->clear(today());

    // November took the 1,000 credit first, so half the cheque is left for December.
    expect(Payment::query()->where('cheque_id', $cheque->id)->sole()->unallocatedAmount())->toBe(1000.0);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.broughtForward', -1000)
            ->where('accounts.0.statement.toPay', 1000)
        );
});

test('paying a short-term rental more than its bill takes it off the next month', function () {
    $rental = ($this->rental)([($this->room)('R-3'), ($this->room)('R-4')], ['start_date' => '2026-10-01', 'end_date' => '2026-12-31']);

    ($this->collect)('rental', $rental->id, 3000)->assertSessionHasNoErrors();

    expect(RentalPayment::query()->sole()->period_end->toDateString())->toBe('2026-11-30');

    $this->actingAs($this->user)
        ->get(route('properties.allocation', [$this->property, 'period' => '2026-11']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('accounts.0.statement.broughtForward', -600)
            ->where('accounts.0.statement.charged', 2400)
            ->where('accounts.0.statement.toPay', 1800)
            ->where('accounts.0.collectionLimit', 4200)
        );
});

test('takes no more than pays the agreement to its end, leaving nothing behind', function () {
    $contract = ($this->contract)('Al Hajar Contracting', [($this->room)('R-1')], ['start_date' => '2026-10-01', 'end_date' => '2026-11-30']);
    $rental = ($this->rental)([($this->room)('R-3')], ['start_date' => '2026-10-01', 'end_date' => '2026-10-31']);
    $rental->recordPayment(['paid_on' => '2026-10-01', 'amount' => 2400, 'purpose' => 'rent', 'method' => 'cash']);

    ($this->collect)('contract', $contract->id, 4000.01)->assertSessionHasErrors('amount');
    ($this->collect)('rental', $rental->id, 10)->assertSessionHasErrors(['amount' => 'Nothing is left to pay up to the end of the agreement.']);

    expect(Invoice::query()->count())->toBe(0)
        ->and(Payment::query()->count())->toBe(0)
        ->and(RentalPayment::query()->count())->toBe(1);
});

test('keeps a company that moved out on the bill while it still owes', function () {
    $rental = ($this->rental)([($this->room)('R-5')], ['start_date' => '2026-07-01', 'end_date' => '2026-08-31']);
    $rental->recordPayment(['paid_on' => '2026-07-01', 'amount' => 2400, 'purpose' => 'rent', 'method' => 'cash']);
    $paidUp = ($this->rental)([($this->room)('R-6')], ['start_date' => '2026-07-01', 'end_date' => '2026-07-31']);
    $paidUp->recordPayment(['paid_on' => '2026-07-01', 'amount' => 2400, 'purpose' => 'rent', 'method' => 'cash']);

    $this->actingAs($this->user)
        ->get(route('properties.allocation', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->has('accounts', 1)
            ->where('accounts.0.key', "rental:{$rental->id}")
            ->where('accounts.0.units', [])
            ->where('accounts.0.statement.broughtForward', 2400)
            ->where('accounts.0.statement.charged', 0)
            ->where('accounts.0.statement.toPay', 2400)
        );
});

test('only collects for agreements in the property', function () {
    $sameCompany = Property::factory()->create(['company_id' => $this->property->company_id]);
    $elsewhere = RoomRental::factory()->forRooms(Room::factory()->create(['property_id' => $sameCompany->id]))->create();
    $otherCompany = Property::factory()->create();

    ($this->collect)('rental', $elsewhere->id, 100)->assertNotFound();

    $this->actingAs($this->user)
        ->post(route('properties.billing.store', $otherCompany), ['account' => 'rental', 'account_id' => $elsewhere->id, 'amount' => 100, 'method' => 'cash', 'through' => '2026-10-31'])
        ->assertNotFound();

    expect(RentalPayment::query()->count())->toBe(0);
});
