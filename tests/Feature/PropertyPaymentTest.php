<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\HeadLease;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\User;
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

test('lists the client cheques for the month, with earlier ones still to deal with, and each company’s bill', function () {
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
        ->has('incoming.cheques', 3)
        ->where('incoming.cheques.0.id', $september->id)
        ->where('incoming.cheques.0.isOverdue', true)
        ->where('incoming.cheques.0.party.name', 'Al Hajar Contracting')
        ->where('incoming.cheques.1.id', $october->id)
        ->where('incoming.cheques.2.id', $rentalCheque->id)
        ->where('incoming.cheques.2.agreement.type', 'room_rental')
        ->has('incoming.accounts', 2)
        ->where('incoming.accounts.0.key', "contract:{$contract->id}")
        ->where('incoming.accounts.1.key', "rental:{$rental->id}")
        ->where('summary.chequesInHand', ['count' => 2, 'amount' => 4400])
        ->where('collectionMethods', ['cash', 'bank_transfer', 'card'])
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
    $paid = ($this->job)('2026-10-02', ['amount' => 300, 'paid_on' => '2026-10-05']);
    $toCost = ($this->job)('2026-10-10', ['amount' => null]);
    // Paid last month, and work not finished yet, are left out.
    ($this->job)('2026-09-01', ['amount' => 200, 'paid_on' => '2026-09-03']);
    MaintenanceJob::factory()->create(['property_id' => $this->property->id]);

    ($this->page)()->assertInertia(fn (Assert $page) => $page
        ->has('outgoing.bills', 3)
        ->where('outgoing.bills.0.id', $toCost->id)
        ->where('outgoing.bills.0.amount', null)
        ->where('outgoing.bills.1.id', $unpaid->id)
        ->where('outgoing.bills.2.id', $paid->id)
        ->where('outgoing.bills.2.isPaid', true)
        ->where('summary.toPay', 450)
        ->where('summary.paidOut', 300)
        ->where('summary.unpaidBills', 1)
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
            ->has('outgoing.bills', 1)
            ->where('outgoing.bills.0.id', $job->id)
            ->where('outgoing.bills.0.isPaid', true)
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

test('hides another company\'s property', function () {
    $this->actingAs(User::factory()->create(['company_id' => Property::factory()->create()->company_id]))
        ->get(route('properties.payments', $this->property))
        ->assertNotFound();
});
