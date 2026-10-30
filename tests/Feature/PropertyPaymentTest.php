<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\ExtraIncome;
use App\Models\HeadLease;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\User;
use App\Models\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->room = fn (string $number) => Room::factory()->create(['property_id' => $this->property->id, 'room_number' => $number, 'capacity' => 4, 'occupied_count' => 0, 'rent_per_bed' => 500]);
    $this->client = fn (string $name) => Client::factory()->create(['company_id' => $this->property->company_id, 'name' => $name]);
    $this->job = fn (string $finishedOn, array $attributes) => MaintenanceJob::factory()->completed()->create([
        'property_id' => $this->property->id,
        'reported_on' => $finishedOn,
        'completed_on' => $finishedOn,
        'payment_method' => null,
        ...$attributes,
    ]);
    $this->page = fn () => $this->actingAs($this->user)->get(route('properties.payments', $this->property))->assertOk();
});

test('lists contract cheques apart from short-term ones, with earlier ones still to deal with, and what each part comes to', function () {
    $contract = Contract::factory()->active()->create(['client_id' => ($this->client)('Al Hajar Contracting')->id, 'start_date' => '2026-08-01', 'end_date' => '2027-07-31']);
    ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->property->id, 'unit_type' => 'room', 'room_id' => ($this->room)('R-1')->id, 'quantity' => 1, 'monthly_rate' => 2000]);
    // Cleared in August, so done with.
    Cheque::factory()->forAgreement($contract)->create(['sequence' => 1, 'cheque_date' => '2026-08-01', 'amount' => 2000, 'status' => 'cleared', 'cleared_on' => '2026-08-02']);
    // In hand since September and not deposited yet, so brought into October.
    $september = Cheque::factory()->forAgreement($contract)->held()->create(['sequence' => 2, 'cheque_date' => '2026-09-01', 'amount' => 2000]);
    $october = Cheque::factory()->forAgreement($contract)->create(['sequence' => 3, 'cheque_date' => '2026-10-01', 'amount' => 2000]);
    Cheque::factory()->forAgreement($contract)->create(['sequence' => 4, 'cheque_date' => '2026-11-01', 'amount' => 2000]);

    $rental = RoomRental::factory()->forRooms(($this->room)('R-2'))->create([
        'client_id' => ($this->client)('Gulf Crew Services')->id,
        'start_date' => '2026-10-01',
        'end_date' => '2026-12-31',
        'monthly_rent' => 2400,
        'security_deposit' => 0,
    ]);
    $rentalCheque = Cheque::factory()->create([
        'company_id' => $rental->company_id,
        'direction' => 'received',
        'chequeable_type' => $rental->getMorphClass(),
        'chequeable_id' => $rental->id,
        'cheque_date' => '2026-10-05',
        'amount' => 2400,
        'status' => 'received',
        'cheque_number' => '402611',
    ]);

    // A contract renting only in another property is not listed.
    $elsewhere = Contract::factory()->active()->create(['client_id' => ($this->client)('Elsewhere Trading')->id]);
    ContractLine::factory()->create(['contract_id' => $elsewhere->id]);
    Cheque::factory()->forAgreement($elsewhere)->create(['cheque_date' => '2026-10-01']);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->component('Properties/Payments')
        ->where('period.from', '2026-10-01')
        ->where('period.to', '2026-10-31')
        ->has('incoming.contractCheques', 2)
        ->where('incoming.contractCheques.0.id', $september->id)
        ->where('incoming.contractCheques.0.isOverdue', true)
        ->where('incoming.contractCheques.0.party.name', 'Al Hajar Contracting')
        ->where('incoming.contractCheques.1.id', $october->id)
        ->has('incoming.rentalCheques', 1)
        ->where('incoming.rentalCheques.0.id', $rentalCheque->id)
        ->where('incoming.rentalCheques.0.agreement.type', 'room_rental')
        ->has('incoming.rentals', 1)
        ->where('incoming.rentals.0.key', "rental:{$rental->id}")
        ->where('summary.cheques.expected', ['count' => 2, 'amount' => 4000])
        ->where('summary.cheques.received', ['count' => 0, 'amount' => 0])
        ->where('summary.cheques.waiting', ['count' => 2, 'amount' => 4000])
        ->where('summary.cheques.inHand', ['count' => 1, 'amount' => 2000])
        ->where('summary.bank.chequesWaiting', ['count' => 1, 'amount' => 2400])
        ->where('summary.cash.toCollect', 2400)
        ->where('collectionMethods', ['cash', 'bank_transfer', 'card', 'cheque'])
    );
});

test('lists the head lease and maintenance contracts paid from here, with what is due and what was paid', function () {
    $lease = HeadLease::factory()->create(['property_id' => $this->property->id, 'start_date' => '2026-01-01', 'end_date' => '2026-12-31', 'annual_rent' => 240000, 'payments_per_year' => 4]);
    Cheque::factory()->forAgreement($lease)->create(['sequence' => 1, 'cheque_date' => '2026-01-01', 'amount' => 60000, 'status' => 'cleared', 'cleared_on' => '2026-01-03']);
    // Given to the landlord in July and not cashed yet, so still to pay.
    $july = Cheque::factory()->forAgreement($lease)->held()->create(['sequence' => 3, 'cheque_date' => '2026-07-01', 'amount' => 60000]);
    $october = Cheque::factory()->forAgreement($lease)->create(['sequence' => 4, 'cheque_date' => '2026-10-01', 'amount' => 60000, 'status' => 'cleared', 'cleared_on' => '2026-10-02']);

    $drainage = MaintenanceContract::factory()->create([
        'property_id' => $this->property->id,
        'service' => 'drainage',
        'vendor_name' => 'Gulf Sewage Services',
        'start_date' => '2026-06-01',
        'end_date' => '2027-05-31',
        'contract_value' => 12000,
        'payment_terms' => 'quarterly',
    ]);
    $drainageCheque = Cheque::factory()->forAgreement($drainage)->create(['sequence' => 2, 'cheque_date' => '2026-09-01', 'amount' => 3000]);

    // A contract that ran out last year with nothing left to pay, and one at another property, are left out.
    MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'start_date' => '2025-01-01', 'end_date' => '2025-12-31']);
    MaintenanceContract::factory()->create();

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->has('outgoing.agreements', 2)
        ->where('outgoing.agreements.0.key', "head_lease:{$lease->id}")
        ->where('outgoing.agreements.0.due', 60000)
        ->where('outgoing.agreements.0.paidInPeriod', 60000)
        ->where('outgoing.agreements.0.paid', 120000)
        ->where('outgoing.agreements.0.left', 60000)
        ->has('outgoing.agreements.0.cheques', 2)
        ->where('outgoing.agreements.0.cheques.0.id', $july->id)
        ->where('outgoing.agreements.0.cheques.0.party.type', 'landlord')
        ->where('outgoing.agreements.0.cheques.1.id', $october->id)
        ->where('outgoing.agreements.1.key', "maintenance_contract:{$drainage->id}")
        ->where('outgoing.agreements.1.service', 'drainage')
        ->where('outgoing.agreements.1.party.name', 'Gulf Sewage Services')
        ->where('outgoing.agreements.1.due', 3000)
        ->where('outgoing.agreements.1.nextChequeOn', '2026-09-01')
        ->where('outgoing.agreements.1.cheques.0.id', $drainageCheque->id)
        ->where('summary.toPay', 63000)
        ->where('summary.paidOut', 60000)
    );
});

test('lists maintenance bills still to pay, those paid this month and finished work still to cost', function () {
    $unpaid = ($this->job)('2026-09-20', ['amount' => 450]);
    $paid = ($this->job)('2026-10-02', ['amount' => 300, 'paid_on' => '2026-10-05', 'payment_method' => 'bank_transfer']);
    $toCost = ($this->job)('2026-10-10', ['amount' => null]);
    // Paid last month, and work not finished yet, are left out.
    ($this->job)('2026-09-01', ['amount' => 200, 'paid_on' => '2026-09-03']);
    MaintenanceJob::factory()->create(['property_id' => $this->property->id]);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->has('outgoing.billsToPay', 2)
        ->where('outgoing.billsToPay.0.id', $toCost->id)
        ->where('outgoing.billsToPay.0.amount', null)
        ->where('outgoing.billsToPay.1.id', $unpaid->id)
        ->has('outgoing.bankBills', 1)
        ->where('outgoing.bankBills.0.id', $paid->id)
        ->where('outgoing.bankBills.0.isPaid', true)
        ->where('summary.outCash.toPay', ['count' => 1, 'amount' => 450])
        ->where('summary.outCash.toCost', 1)
        ->where('summary.toPay', 450)
        ->where('summary.paidOut', 300)
        ->where('billPaymentMethods', MaintenanceJob::PAYMENT_METHODS)
    );
});

test('pays finished work with its cost in one go', function () {
    $job = ($this->job)('2026-10-10', ['amount' => null]);

    $this->actingAs($this->user)
        ->from(route('properties.payments', $this->property))
        ->post(route('maintenance-bills.pay', $job), ['paid_on' => '2026-10-17', 'payment_method' => 'cash', 'amount' => 375])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', $this->property));

    $job->refresh();

    expect((float) $job->amount)->toBe(375.0)
        ->and($job->paid_on->toDateString())->toBe('2026-10-17')
        ->and($job->voucher_number)->toBe('PV-2026-0001');
});

test('adds maintenance from the payments page, paid as it is added, and lists its payment there', function () {
    $this->actingAs($this->user)
        ->get(route('maintenance.create', ['property' => $this->property->id, 'from' => 'payments']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Maintenance/Form')
            ->where('defaults.property_id', $this->property->id)
            ->where('defaults.from_payments', true)
        );

    $this->actingAs($this->user)
        ->post(route('maintenance.store'), [
            'from_payments' => true,
            'property_id' => $this->property->id,
            'unit_type' => 'property',
            'maintenance_category_id' => MaintenanceCategory::query()->where('is_active', true)->value('id'),
            'maintenance_status_id' => MaintenanceStatus::query()->where('is_active', true)->where('stage', 'open')->value('id'),
            'title' => 'Water motor replaced',
            'priority' => 'normal',
            'reported_on' => '2026-10-17',
            'amount' => 850,
            'payment_method' => 'bank_transfer',
            'paid_on' => '2026-10-17',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', ['property' => $this->property, 'tab' => 'out']));

    $job = MaintenanceJob::query()->sole();

    expect((float) $job->amount)->toBe(850.0)
        ->and($job->paid_on->toDateString())->toBe('2026-10-17')
        ->and($job->voucher_number)->toBe('PV-2026-0001')
        ->and($job->paid_by)->toBe($this->user->id);

    $this->actingAs($this->user)
        ->get(route('properties.payments', ['property' => $this->property, 'tab' => 'out']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tab', 'out')
            ->has('outgoing.bankBills', 1)
            ->where('outgoing.bankBills.0.id', $job->id)
            ->where('outgoing.bankBills.0.isPaid', true)
            ->where('summary.paidOut', 850)
        );
});

test('maintenance added from the payments page needs its payment', function () {
    $this->actingAs($this->user)
        ->post(route('maintenance.store'), [
            'from_payments' => true,
            'property_id' => $this->property->id,
            'unit_type' => 'property',
            'maintenance_category_id' => MaintenanceCategory::query()->where('is_active', true)->value('id'),
            'maintenance_status_id' => MaintenanceStatus::query()->where('is_active', true)->where('stage', 'open')->value('id'),
            'title' => 'Water motor replaced',
            'priority' => 'normal',
            'reported_on' => '2026-10-17',
        ])
        ->assertSessionHasErrors(['amount', 'payment_method', 'paid_on']);

    expect(MaintenanceJob::query()->count())->toBe(0);
});

test('splits what short-term rentals paid into bank and cash, keeping cash with the camp boss until an admin confirms it', function () {
    $rental = RoomRental::factory()->forRooms(($this->room)('R-5'))->create([
        'client_id' => ($this->client)('Gulf Crew Services')->id,
        'start_date' => '2026-09-01',
        'end_date' => '2026-12-31',
        'monthly_rent' => 3000,
        'security_deposit' => 0,
    ]);
    $pay = fn (string $paidOn, float $amount, string $method) => $rental->recordPayment(['paid_on' => $paidOn, 'amount' => $amount, 'purpose' => 'rent', 'method' => $method]);
    $transfer = $pay('2026-10-03', 1000, 'bank_transfer');
    $card = $pay('2026-10-04', 500, 'card');
    $cash = $pay('2026-10-05', 800, 'cash');
    // Taken in September and not handed over yet, so still listed.
    $septemberCash = $pay('2026-09-20', 300, 'cash');
    // Taken in September and handed over, so done with.
    $pay('2026-09-10', 200, 'cash')->forceFill(['handed_over_at' => '2026-09-30 17:00:00', 'handed_over_to' => $this->user->id])->save();
    $pay('2026-10-06', 50, 'cash')->void(today(), 'Typed twice.');
    // Handed over in October, so counted as handed over.
    $handedOver = $pay('2026-10-02', 400, 'cash');
    $handedOver->forceFill(['handed_over_at' => '2026-10-10 12:00:00', 'handed_over_to' => $this->user->id])->save();

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->has('incoming.bankReceipts', 2)
        ->where('incoming.bankReceipts.0.id', $card->id)
        ->where('incoming.bankReceipts.1.id', $transfer->id)
        ->has('incoming.cashReceipts', 3)
        ->where('incoming.cashReceipts.0.id', $cash->id)
        ->where('incoming.cashReceipts.0.awaitsHandover', true)
        ->where('incoming.cashReceipts.1.id', $handedOver->id)
        ->where('incoming.cashReceipts.1.awaitsHandover', false)
        ->where('incoming.cashReceipts.1.handedOverOn', '2026-10-10')
        ->where('incoming.cashReceipts.1.handedOverTo', $this->user->name)
        ->where('incoming.cashReceipts.2.id', $septemberCash->id)
        ->where('summary.bank.transfers', ['count' => 2, 'amount' => 1500])
        ->where('summary.bank.received', 1500)
        ->where('summary.cash.collected', ['count' => 2, 'amount' => 1200])
        ->where('summary.cash.handedOver', ['count' => 1, 'amount' => 400])
        ->where('summary.cash.withCampBoss', ['count' => 2, 'amount' => 1100])
        ->where('can.confirmCash', false)
    );
});

test('records what a short-term rental paid as cash, a transfer or a cheque, and counts a cheque once submitted', function () {
    $rental = RoomRental::factory()->forRooms(($this->room)('R-8'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-10-01', 'monthly_rent' => 3000, 'security_deposit' => 0]);
    $collect = fn (array $payment) => $this->actingAs($this->user)
        ->post(route('properties.billing.store', $this->property), ['account' => 'rental', 'account_id' => $rental->id, 'through' => '2026-10-31', ...$payment])
        ->assertSessionHasNoErrors();

    $collect(['amount' => 1000, 'method' => 'cash']);
    $collect(['amount' => 800, 'method' => 'bank_transfer']);
    $collect(['amount' => 1200, 'method' => 'cheque', 'cheque_number' => '000417', 'bank_name' => 'Mashreq', 'cheque_date' => '2026-10-17']);

    $cheque = Cheque::query()->where('chequeable_id', $rental->id)->sole();
    expect($cheque)->status->toBe('received')->cheque_number->toBe('000417')->and($rental->payments()->count())->toBe(2);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->has('incoming.cashReceipts', 1)
        ->has('incoming.bankReceipts', 1)
        ->has('incoming.rentalCheques', 1)
        ->where('summary.bank.received', 800)
        ->where('summary.bank.chequesWaiting', ['count' => 1, 'amount' => 1200])
        ->where('summary.cash.toCollect', 1200)
    );

    $this->actingAs($this->user)->post(route('cheques.settle', $cheque), ['date' => '2026-10-17'])->assertSessionHasNoErrors();

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->where('summary.bank.received', 2000)
        ->where('summary.bank.chequesCashed', ['count' => 1, 'amount' => 1200])
        ->where('summary.cash.toCollect', 0)
    );
});

test('a contract cannot be paid by cheque from the payments page, and a cheque needs its details', function () {
    $rental = RoomRental::factory()->forRooms(($this->room)('R-9'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-10-01', 'monthly_rent' => 3000]);
    $contract = Contract::factory()->active()->create(['client_id' => ($this->client)('Al Hajar Contracting')->id, 'start_date' => '2026-08-01', 'end_date' => '2027-07-31']);
    ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->property->id, 'unit_type' => 'room', 'room_id' => ($this->room)('R-10')->id, 'quantity' => 1, 'monthly_rate' => 2000]);

    $this->actingAs($this->user)
        ->post(route('properties.billing.store', $this->property), ['account' => 'contract', 'account_id' => $contract->id, 'through' => '2026-10-31', 'amount' => 500, 'method' => 'cheque', 'cheque_number' => '1', 'bank_name' => 'Mashreq', 'cheque_date' => '2026-10-17'])
        ->assertSessionHasErrors('method');

    $this->actingAs($this->user)
        ->post(route('properties.billing.store', $this->property), ['account' => 'rental', 'account_id' => $rental->id, 'through' => '2026-10-31', 'amount' => 500, 'method' => 'cheque'])
        ->assertSessionHasErrors(['cheque_number', 'bank_name', 'cheque_date']);

    expect(Cheque::query()->count())->toBe(0);
});

test('an admin confirms receiving the cash still with the camp boss', function () {
    $admin = User::factory()->create(['company_id' => $this->property->company_id, 'user_role_id' => UserRole::builtIn(UserRole::SUPER_ADMIN)->id]);
    $rental = RoomRental::factory()->forRooms(($this->room)('R-6'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-10-01', 'monthly_rent' => 3000]);
    $cash = $rental->recordPayment(['paid_on' => '2026-10-05', 'amount' => 800, 'purpose' => 'rent', 'method' => 'cash']);
    $transfer = $rental->recordPayment(['paid_on' => '2026-10-06', 'amount' => 500, 'purpose' => 'rent', 'method' => 'bank_transfer']);
    $otherProperty = Property::factory()->create(['company_id' => $this->property->company_id]);
    $elsewhere = RoomRental::factory()->forRooms(Room::factory()->create(['property_id' => $otherProperty->id]))->create(['client_id' => ($this->client)('Elsewhere Trading')->id])
        ->recordPayment(['paid_on' => '2026-10-05', 'amount' => 900, 'purpose' => 'rent', 'method' => 'cash']);

    $this->actingAs($admin)->get(route('properties.payments', $this->property))->assertInertia(fn (Assert $page) => $page->where('can.confirmCash', true));

    $this->actingAs($admin)
        ->post(route('properties.cash-handover.store', $this->property), ['receipts' => [$cash->id, $transfer->id, $elsewhere->id]])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($cash->fresh())
        ->handed_over_at->not->toBeNull()
        ->handed_over_to->toBe($admin->id)
        ->and($transfer->fresh()->handed_over_at)->toBeNull()
        ->and($elsewhere->fresh()->handed_over_at)->toBeNull();

    $this->actingAs($admin)
        ->post(route('properties.cash-handover.store', $this->property), ['receipts' => [$cash->id]])
        ->assertSessionHasErrors('receipts');
});

test('splits bills paid out into bank and cash, keeping the camp boss\'s cash spending to settle', function () {
    $byCheque = ($this->job)('2026-10-03', ['amount' => 700, 'paid_on' => '2026-10-04', 'payment_method' => 'cheque']);
    $inCash = ($this->job)('2026-10-05', ['amount' => 150, 'paid_on' => '2026-10-06', 'payment_method' => 'cash']);
    // Paid in cash in September and not settled yet, so still listed.
    $septemberCash = ($this->job)('2026-09-10', ['amount' => 90, 'paid_on' => '2026-09-12', 'payment_method' => 'cash']);
    // Paid in cash in September and settled, so done with.
    ($this->job)('2026-09-10', ['amount' => 60, 'paid_on' => '2026-09-12', 'payment_method' => 'cash', 'handed_over_at' => '2026-09-30 17:00:00']);
    $transfer = OtherPayment::factory()->create(['property_id' => $this->property->id, 'status' => 'paid', 'method' => 'bank_transfer', 'amount' => 400, 'payment_date' => '2026-10-08']);
    $tanker = OtherPayment::factory()->paid()->create(['property_id' => $this->property->id, 'amount' => 120, 'payment_date' => '2026-10-09']);
    $pending = OtherPayment::factory()->create(['property_id' => $this->property->id, 'amount' => 300, 'payment_date' => '2026-10-20']);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->where('outgoing.bankBills.0.id', $byCheque->id)
        ->where('outgoing.bankOthers.0.id', $transfer->id)
        ->has('outgoing.cashBills', 2)
        ->where('outgoing.cashBills.0.id', $inCash->id)
        ->where('outgoing.cashBills.0.awaitsHandover', true)
        ->where('outgoing.cashBills.1.id', $septemberCash->id)
        ->where('outgoing.cashOthers.0.id', $tanker->id)
        ->where('outgoing.othersToPay.0.id', $pending->id)
        ->where('summary.outBank.paid', ['count' => 2, 'amount' => 1100])
        ->where('summary.outBank.byCheque', ['count' => 1, 'amount' => 700])
        ->where('summary.outCash.toPay', ['count' => 1, 'amount' => 300])
        ->where('summary.outCash.spent', ['count' => 2, 'amount' => 270])
        ->where('summary.outCash.toSettle', ['count' => 3, 'amount' => 360])
        ->where('summary.expenses.bills', 850)
        ->where('summary.expenses.others', 520)
    );
});

test('sums up the camp boss\'s cash to hand over and the income, expenses and profit of the period', function () {
    $contract = Contract::factory()->active()->create(['client_id' => ($this->client)('Al Hajar Contracting')->id, 'start_date' => '2026-08-01', 'end_date' => '2027-07-31']);
    ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->property->id, 'unit_type' => 'room', 'room_id' => ($this->room)('R-1')->id, 'quantity' => 1, 'monthly_rate' => 5000]);
    Cheque::factory()->forAgreement($contract)->create(['cheque_date' => '2026-10-01', 'amount' => 5000, 'status' => 'cleared', 'cleared_on' => '2026-10-03']);
    $rental = RoomRental::factory()->forRooms(($this->room)('R-2'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-09-01', 'monthly_rent' => 3000, 'security_deposit' => 0]);
    $pay = fn (string $paidOn, float $amount, string $method) => $rental->recordPayment(['paid_on' => $paidOn, 'amount' => $amount, 'purpose' => 'rent', 'method' => $method]);
    $pay('2026-10-02', 1000, 'bank_transfer');
    $pay('2026-10-04', 900, 'cash');
    $pay('2026-10-05', 300, 'cash')->forceFill(['handed_over_at' => '2026-10-10 12:00:00'])->save();
    // Collected in September and still with the camp boss.
    $pay('2026-09-25', 200, 'cash');
    $lease = HeadLease::factory()->create(['property_id' => $this->property->id, 'start_date' => '2026-01-01', 'end_date' => '2026-12-31']);
    Cheque::factory()->forAgreement($lease)->create(['cheque_date' => '2026-10-01', 'amount' => 2500, 'status' => 'cleared', 'cleared_on' => '2026-10-02']);
    $drainage = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'service' => 'drainage', 'start_date' => '2026-06-01', 'end_date' => '2027-05-31']);
    Cheque::factory()->forAgreement($drainage)->create(['cheque_date' => '2026-10-01', 'amount' => 600, 'status' => 'cleared', 'cleared_on' => '2026-10-05']);
    ($this->job)('2026-10-06', ['amount' => 250, 'paid_on' => '2026-10-07', 'payment_method' => 'cash']);
    OtherPayment::factory()->paid()->create(['property_id' => $this->property->id, 'amount' => 50, 'payment_date' => '2026-10-08']);
    ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 4000, 'received_on' => '2026-10-09']);
    ExtraIncome::factory()->cancelled()->create(['property_id' => $this->property->id, 'amount' => 900, 'received_on' => '2026-10-09']);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->where('summary.campBoss', ['received' => 1200, 'spent' => 300, 'settled' => 300, 'broughtForward' => 200, 'toHandOver' => 800])
        ->where('summary.income', ['cheques' => 5000, 'transfers' => 1000, 'cash' => 1200, 'extra' => 4000, 'total' => 11200])
        ->where('summary.expenses', ['landlord' => 2500, 'contracts' => 600, 'bills' => 250, 'others' => 50, 'total' => 3400])
        ->where('summary.profit', 7800)
    );
});

test('an admin settles the cash collected less the bills the camp boss paid out of it', function () {
    $admin = User::factory()->create(['company_id' => $this->property->company_id, 'user_role_id' => UserRole::builtIn(UserRole::SUPER_ADMIN)->id]);
    $rental = RoomRental::factory()->forRooms(($this->room)('R-6'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-10-01', 'monthly_rent' => 3000]);
    $cash = $rental->recordPayment(['paid_on' => '2026-10-05', 'amount' => 800, 'purpose' => 'rent', 'method' => 'cash']);
    $bill = ($this->job)('2026-10-06', ['amount' => 150, 'paid_on' => '2026-10-07', 'payment_method' => 'cash']);
    $byBank = ($this->job)('2026-10-06', ['amount' => 500, 'paid_on' => '2026-10-07', 'payment_method' => 'bank_transfer']);
    $tanker = OtherPayment::factory()->paid()->create(['property_id' => $this->property->id, 'amount' => 50, 'payment_date' => '2026-10-08']);
    $elsewhere = MaintenanceJob::factory()->completed()->create(['amount' => 70, 'paid_on' => '2026-10-07', 'payment_method' => 'cash']);

    $this->actingAs($admin)
        ->post(route('properties.cash-handover.store', $this->property), ['receipts' => [$cash->id], 'bills' => [$bill->id, $byBank->id, $elsewhere->id], 'others' => [$tanker->id]])
        ->assertSessionHas('success', 'Cash of 600.00 was confirmed as received: 800.00 collected less 200.00 spent on bills.');

    expect($bill->fresh()->handed_over_to)->toBe($admin->id)
        ->and($tanker->fresh()->handed_over_at)->not->toBeNull()
        ->and($byBank->fresh()->handed_over_at)->toBeNull()
        ->and($elsewhere->fresh()->handed_over_at)->toBeNull();

    $this->actingAs($admin)->get(route('properties.payments', $this->property))->assertInertia(fn (Assert $page) => $page
        ->where('summary.campBoss.toHandOver', 0)
        ->where('summary.outCash.toSettle', ['count' => 0, 'amount' => 0])
    );

    // Put back to pay, a payment no longer counts as settled.
    $this->actingAs($admin)->post(route('other-payments.status', $tanker), ['status' => 'pending'])->assertSessionHasNoErrors();
    expect($tanker->fresh()->handed_over_at)->toBeNull();
});

test('only an admin can confirm cash received', function () {
    $rental = RoomRental::factory()->forRooms(($this->room)('R-7'))->create(['client_id' => ($this->client)('Gulf Crew Services')->id, 'start_date' => '2026-10-01', 'monthly_rent' => 3000]);
    $cash = $rental->recordPayment(['paid_on' => '2026-10-05', 'amount' => 800, 'purpose' => 'rent', 'method' => 'cash']);

    $this->actingAs($this->user)
        ->post(route('properties.cash-handover.store', $this->property), ['receipts' => [$cash->id]])
        ->assertForbidden();

    expect($cash->fresh()->handed_over_at)->toBeNull();
});

test('hides another company\'s property', function () {
    $this->actingAs(User::factory()->create(['company_id' => Property::factory()->create()->company_id]))
        ->get(route('properties.payments', $this->property))
        ->assertNotFound();
});
