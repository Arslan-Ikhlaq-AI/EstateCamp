<?php

use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\ExtraIncome;
use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Payment;
use App\Models\Property;
use App\Models\PropertyType;
use App\Models\RoomRental;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
});

describe('with a small portfolio', function () {
    beforeEach(function () {
        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);
        $type = fn (string $slug) => PropertyType::query()->where('slug', $slug)->value('id');
        $this->camp = Property::factory()->create(['company_id' => $this->company->id, 'name' => 'Al Quoz Camp', 'property_type_id' => $type('worker_accommodation')]);
        $this->residence = Property::factory()->create(['company_id' => $this->company->id, 'name' => 'Jebel Ali Residence', 'property_type_id' => $type('staff_accommodation')]);

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
    });

    test('shares each payment among the properties it pays for and sets their expenses against it', function () {
        // Settles the contract's invoices (allocated), then credit beyond them (tagged with the contract).
        $this->contract->collectPayment(4000, today(), 'bank_transfer');
        ($this->clientPayment)(2000, '2026-09-15', $this->contract);
        // A payment no contract can be found for.
        ($this->clientPayment)(700, '2026-08-01');

        $rental = RoomRental::factory()->create(['property_id' => $this->residence->id]);
        $rental->recordPayment(['paid_on' => '2026-09-01', 'amount' => 500, 'purpose' => 'rent', 'method' => 'cash']);
        $rental->recordPayment(['paid_on' => '2026-09-01', 'amount' => 500, 'purpose' => 'deposit', 'method' => 'cash']);

        ExtraIncome::factory()->create(['property_id' => $this->camp->id, 'amount' => 200, 'received_on' => '2026-10-01']);
        ExtraIncome::factory()->cancelled()->create(['property_id' => $this->camp->id, 'amount' => 9000, 'received_on' => '2026-10-01']);
        MaintenanceJob::factory()->completed(300)->create(['property_id' => $this->camp->id, 'paid_on' => '2026-10-05']);
        OtherPayment::factory()->paid()->create(['property_id' => $this->residence->id, 'amount' => 100, 'payment_date' => '2026-10-06']);

        $this->actingAs($this->user)
            ->get(route('analyze'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Analyze/Index')
                ->where('properties.0.name', 'Al Quoz Camp')
                ->where('properties.0.revenue', 4700)
                ->where('properties.0.sources', ['contract_rent' => 4500, 'short_term' => 0, 'extra_income' => 200])
                ->where('properties.0.expenses', 300)
                ->where('properties.0.spending.bills', 300)
                ->where('properties.0.net', 4400)
                ->where('properties.1.name', 'Jebel Ali Residence')
                ->where('properties.1.sources', ['contract_rent' => 1500, 'short_term' => 500, 'extra_income' => 0])
                ->where('properties.1.spending.others', 100)
                ->where('properties.1.net', 1900)
                ->where('properties.0.sourceTimeline.9', ['contract_rent' => 3000, 'short_term' => 0, 'extra_income' => 200])
                ->where('properties.1.sourceTimeline.8', ['contract_rent' => 500, 'short_term' => 500, 'extra_income' => 0])
                ->where('unlinked.revenue', 700)
                ->where('totals.revenue', 7400)
                ->where('totals.expenses', 400)
                ->where('totals.net', 7000)
            );
    });

    test('opens on this year so far, by month, against the same days of last year', function () {
        ($this->clientPayment)(4000, '2026-02-10', $this->contract);
        ($this->clientPayment)(2000, '2025-02-20', $this->contract);
        // After today's date last year, so outside the comparison.
        ($this->clientPayment)(8000, '2025-11-01', $this->contract);

        $this->actingAs($this->user)
            ->get(route('analyze'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('period.name', 'this_year')
                ->where('through', '2026-10-17')
                ->where('isToDate', true)
                ->where('previousPeriod', ['from' => '2025-01-01', 'to' => '2025-10-17'])
                ->where('by', 'month')
                ->where('buckets', ['week', 'month'])
                ->has('timeline', 10)
                ->where('timeline.1', ['from' => '2026-02-01', 'to' => '2026-02-28', 'revenue' => 4000, 'expenses' => 0, 'previous' => 2000])
                ->where('timeline.9.to', '2026-10-17')
                ->where('totals.previous.revenue', 2000)
                ->where('properties.0.timeline.1', 3000)
                ->where('properties.0.previous.revenue', 1500)
                ->where('properties.0.previousTimeline.1', 1500)
                ->where('totals.previousTimeline.1', 2000)
            );
    });

    test('groups a chosen month by day, and refuses a grouping too coarse for it', function () {
        ($this->clientPayment)(400, '2026-09-03', $this->contract);

        $this->actingAs($this->user)
            ->get(route('analyze', ['period' => '2026-09', 'by' => 'month']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('isToDate', false)
                ->where('by', 'day')
                ->where('buckets', ['day', 'week'])
                ->has('timeline', 30)
                ->where('timeline.2.revenue', 400)
                ->where('previousPeriod', ['from' => '2026-08-01', 'to' => '2026-08-31'])
            );

        $this->actingAs($this->user)
            ->get(route('analyze', ['period' => '2026-09', 'by' => 'week']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('by', 'week')
                ->where('timeline.0.from', '2026-09-01')
                ->where('timeline.0.revenue', 400)
            );
    });

    test('shows one kind of property, leaving out money of no property', function () {
        ($this->clientPayment)(4000, '2026-09-15', $this->contract);
        ($this->clientPayment)(700, '2026-09-15');

        $this->actingAs($this->user)
            ->get(route('analyze', ['type' => 'staff_accommodation']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('type', 'staff_accommodation')
                ->has('properties', 1)
                ->where('properties.0.name', 'Jebel Ali Residence')
                ->where('unlinked', null)
                ->where('totals.revenue', 1000)
                ->where('propertyTypes', [
                    ['value' => 'staff_accommodation', 'label' => $this->residence->propertyType->name, 'count' => 1],
                    ['value' => 'worker_accommodation', 'label' => $this->camp->propertyType->name, 'count' => 1],
                ])
            );
    });
});

test('counts every client payment of the demo company once, across its properties and those it has none for', function () {
    $this->seed(DatabaseSeeder::class);
    $admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $received = (float) Payment::query()
        ->where('company_id', $admin->company_id)
        ->where('status', 'cleared')
        ->whereBetween('received_on', ['2026-01-01', '2026-10-17'])
        ->sum('amount');

    $props = $this->actingAs($admin)->get(route('analyze'))->viewData('page')['props'];

    expect($props['totals']['sources']['contract_rent'])->toEqualWithDelta($received, 0.005)
        ->and($props['totals']['revenue'])->toEqualWithDelta(collect($props['properties'])->sum('revenue') + $props['unlinked']['revenue'], 0.05);
});
