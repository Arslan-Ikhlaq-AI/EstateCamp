<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\ExtraIncome;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Payment;
use App\Models\Property;
use App\Models\RoomRental;
use App\Models\SalaryPayment;
use App\Models\StaffMember;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->company = Company::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->company->id]);
    $this->camp = Property::factory()->create(['company_id' => $this->company->id, 'name' => 'Al Quoz Camp']);
    $this->residence = Property::factory()->create(['company_id' => $this->company->id, 'name' => 'Jebel Ali Residence']);

    // One contract renting in both: three quarters of its rent at the camp, a quarter at the residence.
    $this->contract = Contract::factory()->active()->create(['client_id' => Client::factory()->create(['company_id' => $this->company->id])]);
    ContractLine::factory()->create(['contract_id' => $this->contract->id, 'property_id' => $this->camp->id, 'monthly_rate' => 3000]);
    ContractLine::factory()->create(['contract_id' => $this->contract->id, 'property_id' => $this->residence->id, 'monthly_rate' => 1000]);

    $this->clientPayment = function (float $amount, string $receivedOn, ?Contract $contract = null): Payment {
        $payment = new Payment(['received_on' => $receivedOn, 'amount' => $amount, 'method' => 'bank_transfer', 'status' => 'cleared']);
        $payment->forceFill([
            'company_id' => $this->company->id,
            'client_id' => $contract?->client_id ?? Client::factory()->create(['company_id' => $this->company->id])->id,
            'contract_id' => $contract?->id,
            'payment_number' => Payment::nextNumber($this->company->id, $payment->received_on),
        ])->save();

        return $payment;
    };

    $this->salary = function (StaffMember $member, float $netPay, array $state): SalaryPayment {
        SalaryPayment::prepareMonth($this->company, now()->subMonth());
        $salary = SalaryPayment::where('staff_member_id', $member->id)->sole();
        $salary->forceFill(['net_pay' => $netPay, ...$state])->save();

        return $salary;
    };
});

test('offers the company’s properties and opens on all of them', function () {
    $other = Property::factory()->create(['name' => 'Another Company’s Camp']);

    ($this->clientPayment)(700, '2026-10-01');

    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.property', null)
            ->where('properties', [
                ['id' => $this->camp->id, 'name' => 'Al Quoz Camp', 'code' => $this->camp->code],
                ['id' => $this->residence->id, 'name' => 'Jebel Ali Residence', 'code' => $this->residence->code],
            ])
            ->where('totals.client_payment.amount', 700)
        );

    // Another company's property, or one that is no number at all, shows everything rather than failing.
    foreach ([$other->id, 'nonsense', 0] as $property) {
        $this->actingAs($this->user)
            ->get(route('payments.overview', ['property' => $property]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('filters.property', null)->where('totals.client_payment.amount', 700));
    }
});

test('counts a shared contract by each property’s part of its rent, so the properties add up to the company', function () {
    // Settles the contract's invoices (allocated), then credit beyond them (tagged with the contract).
    $this->contract->collectPayment(4000, today(), 'bank_transfer');
    ($this->clientPayment)(2000, '2026-09-15', $this->contract);
    // A payment no contract can be found for is in no property's ledger.
    ($this->clientPayment)(700, '2026-08-01');

    $overview = fn (array $query) => $this->actingAs($this->user)->get(route('payments.overview', ['period' => 'this_year', ...$query]));

    $overview([])->assertInertia(fn (Assert $page) => $page->where('totals.client_payment.amount', 6700));

    $overview(['property' => $this->camp->id])->assertInertia(fn (Assert $page) => $page
        ->where('filters.property', $this->camp->id)
        ->where('totals.client_payment', ['count' => 2, 'amount' => 4500])
        ->where('transactions.total', 2)
        ->where('transactions.data.0.amount', 3000)
        ->where('transactions.data.1.amount', 1500)
        ->where('methods.in.bank_transfer', 4500)
    );

    $overview(['property' => $this->residence->id])->assertInertia(fn (Assert $page) => $page
        ->where('totals.client_payment', ['count' => 2, 'amount' => 1500])
        ->where('transactions.data.0.amount', 1000)
    );

    // What the Analyze page says each property earned from contracts.
    $this->actingAs($this->user)
        ->get(route('analyze'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('properties.0.sources.contract_rent', 4500)
            ->where('properties.1.sources.contract_rent', 1500)
        );
});

test('shares a contract by its lines when it has no rent set', function () {
    ContractLine::where('contract_id', $this->contract->id)->update(['monthly_rate' => 0]);
    ($this->clientPayment)(1000, '2026-10-02', $this->contract);

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['property' => $this->camp->id]))
        ->assertInertia(fn (Assert $page) => $page->where('totals.client_payment.amount', 500));
});

test('keeps every kind of money at its own property', function () {
    $money = function (Property $property, float $amount) {
        $rental = RoomRental::factory()->create(['property_id' => $property->id]);
        $rental->recordPayment(['paid_on' => '2026-10-02', 'amount' => $amount, 'purpose' => 'rent', 'method' => 'cash']);

        // Kept under Extra payments, so in no kind of money here.
        ExtraIncome::factory()->create(['property_id' => $property->id, 'amount' => $amount, 'received_on' => '2026-10-02']);
        MaintenanceJob::factory()->completed($amount)->create(['property_id' => $property->id, 'paid_on' => '2026-10-02']);
        OtherPayment::factory()->paid()->create(['property_id' => $property->id, 'amount' => $amount, 'payment_date' => '2026-10-02']);

        foreach ([HeadLease::factory(), MaintenanceContract::factory()] as $agreement) {
            Cheque::factory()->forAgreement($agreement->create(['property_id' => $property->id]))->create(['amount' => $amount, 'status' => 'cleared', 'cleared_on' => '2026-10-02']);
        }

        $member = StaffMember::factory()->atProperty($property)->create(['joined_on' => '2025-01-01']);
        ($this->salary)($member, $amount, ['status' => 'paid', 'paid_on' => '2026-10-02', 'payment_method' => 'bank_transfer']);
    };

    $money($this->camp, 100);
    $money($this->residence, 200);

    // Paid to someone at head office, so in no property's ledger.
    $headOffice = StaffMember::factory()->create(['company_id' => $this->company->id, 'joined_on' => '2025-01-01']);
    ($this->salary)($headOffice, 900, ['status' => 'paid', 'paid_on' => '2026-10-02', 'payment_method' => 'bank_transfer']);

    $eachKind = function (Assert $page, int $amount): Assert {
        foreach (['rental_payment', 'landlord_rent', 'maintenance', 'maintenance_contract', 'other_payment', 'salary'] as $kind) {
            $page->where("totals.{$kind}", ['count' => 1, 'amount' => $amount]);
        }

        return $page;
    };

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['property' => $this->camp->id]))
        ->assertInertia(fn (Assert $page) => $eachKind($page, 100)->where('transactions.total', 6));

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['property' => $this->residence->id]))
        ->assertInertia(fn (Assert $page) => $eachKind($page, 200)->where('transactions.total', 6));

    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.other_payment', ['count' => 2, 'amount' => 300])
            ->where('totals.salary', ['count' => 3, 'amount' => 1200])
        );
});

test('applies the date and the property together, to everything the page shows', function () {
    $paid = fn (Property $property, float $amount, string $on) => OtherPayment::factory()->paid()->create([
        'property_id' => $property->id,
        'amount' => $amount,
        'method' => 'cash',
        'payment_date' => $on,
    ]);

    $paid($this->camp, 100, '2026-09-10');
    $paid($this->camp, 200, '2026-10-10');
    $paid($this->camp, 400, '2026-10-20');
    $paid($this->residence, 999, '2026-10-10');

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['period' => '2026-10', 'property' => $this->camp->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.other_payment', ['count' => 2, 'amount' => 600])
            ->where('previousTotals.other_payment', ['count' => 1, 'amount' => 100])
            ->where('methods.out.cash', 600)
            ->where('trend.11', ['month' => '2026-10', 'in' => 0, 'out' => 600])
            ->where('trend.10', ['month' => '2026-09', 'in' => 0, 'out' => 100])
            ->where('facets.direction.1', ['value' => 'out', 'count' => 2])
            ->where('transactions.total', 2)
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['period' => '2026-10-01..2026-10-15', 'property' => $this->camp->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.other_payment', ['count' => 1, 'amount' => 200])
            ->where('transactions.data.0.amount', 200)
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['period' => '2026-10', 'property' => $this->residence->id, 'search' => 'nothing-matches']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.other_payment.amount', 999)
            ->where('transactions.total', 0)
        );
});

test('shows only what is waiting at that property, a shared contract by its part', function () {
    $this->contract->generateNextInvoice();

    Cheque::factory()->forAgreement($this->contract)->create(['amount' => 4000, 'status' => 'received', 'cheque_date' => today()->subDay()]);

    // Started in January with nothing paid, so its rent is owed.
    $rental = RoomRental::factory()->create(['property_id' => $this->residence->id]);
    Cheque::factory()->create([
        'company_id' => $this->company->id,
        'direction' => 'received',
        'chequeable_type' => $rental->getMorphClass(),
        'chequeable_id' => $rental->id,
        'amount' => 500,
        'status' => 'received',
        'cheque_date' => today()->subDay(),
    ]);

    Cheque::factory()->forAgreement(HeadLease::factory()->create(['property_id' => $this->camp->id]))->create(['amount' => 600, 'status' => 'issued', 'cheque_date' => today()->addDays(5)]);
    Cheque::factory()->forAgreement(MaintenanceContract::factory()->create(['property_id' => $this->residence->id]))->create(['amount' => 700, 'status' => 'issued', 'cheque_date' => today()->addDays(5)]);
    MaintenanceJob::factory()->completed(300)->create(['property_id' => $this->camp->id]);

    $member = StaffMember::factory()->atProperty($this->camp)->create(['joined_on' => '2025-01-01']);
    ($this->salary)($member, 800, []);

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['property' => $this->camp->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('outstanding.invoices', ['count' => 1, 'amount' => 3000])
            ->where('outstanding.rentOwed', ['count' => 0, 'amount' => 0])
            ->where('outstanding.chequesToBank', ['count' => 1, 'amount' => 3000])
            ->where('outstanding.landlordCheques', ['count' => 1, 'amount' => 600])
            ->where('outstanding.contractorCheques', ['count' => 0, 'amount' => 0])
            ->where('outstanding.maintenanceBills', ['count' => 1, 'amount' => 300])
            ->where('outstanding.salaries', ['count' => 1, 'amount' => 800])
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview', ['property' => $this->residence->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('outstanding.invoices', ['count' => 1, 'amount' => 1000])
            ->where('outstanding.rentOwed.count', 1)
            ->where('outstanding.chequesToBank', ['count' => 2, 'amount' => 1500])
            ->where('outstanding.landlordCheques', ['count' => 0, 'amount' => 0])
            ->where('outstanding.contractorCheques', ['count' => 1, 'amount' => 700])
            ->where('outstanding.maintenanceBills', ['count' => 0, 'amount' => 0])
            ->where('outstanding.salaries', ['count' => 0, 'amount' => 0])
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('outstanding.invoices', ['count' => 1, 'amount' => 4000])
            ->where('outstanding.chequesToBank', ['count' => 2, 'amount' => 4500])
        );
});
