<?php

use App\Models\Company;
use App\Models\RoomRental;
use App\Models\StaffMember;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Database\Seeders\RoomRentalSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
});

describe('the overview', function () {
    test('opens on this month, against last month', function () {
        $this->actingAs($this->admin)
            ->get(route('payments.overview'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Overview')
                ->where('period.name', 'this_month')
                ->where('period.from', '2026-10-01')
                ->where('period.to', '2026-10-31')
                ->where('previousPeriod', ['from' => '2026-09-01', 'to' => '2026-09-30'])
                ->where('totals.client_payment', ['count' => 4, 'amount' => 27875])
                ->where('totals.maintenance', ['count' => 1, 'amount' => 180])
                ->where('previousTotals.rental_payment', ['count' => 1, 'amount' => 1500])
                ->where('previousTotals.maintenance', ['count' => 1, 'amount' => 2400])
                ->has('trend', 12)
                ->where('trend.11.month', '2026-10')
            );
    });

    test('totals a chosen month, every kind of money in and out', function () {
        $this->actingAs($this->admin)
            ->get(route('payments.overview', ['period' => '2026-09']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('period.kind', 'month')
                ->where('totals', [
                    'client_payment' => ['count' => 6, 'amount' => 31780],
                    'gas_payment' => ['count' => 0, 'amount' => 0],
                    'rental_payment' => ['count' => 1, 'amount' => 1500],
                    'landlord_rent' => ['count' => 0, 'amount' => 0],
                    'maintenance' => ['count' => 1, 'amount' => 2400],
                    'salary' => ['count' => 0, 'amount' => 0],
                    'maintenance_contract' => ['count' => 0, 'amount' => 0],
                    'deposit_refund' => ['count' => 0, 'amount' => 0],
                ])
                ->where('transactions.total', 8)
            );
    });

    test('narrows the ledger by kind, way and search', function () {
        $pastTenant = RoomRental::whereHas('client', fn ($clients) => $clients->where('name', RoomRentalSeeder::PAST_TENANT))->sole();

        $this->actingAs($this->admin)
            ->get(route('payments.overview', ['period' => 'all', 'direction' => ['out'], 'category' => ['deposit_refund'], 'search' => 'Fatima']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('transactions.total', 1)
                ->where('transactions.data.0.party', RoomRentalSeeder::PAST_TENANT)
                ->where('transactions.data.0.recordId', $pastTenant->id)
                ->where('transactions.data.0.date', '2026-07-01')
                ->where('transactions.data.0.amount', 1500)
            );
    });

    test('shows what is still to collect and to pay today', function () {
        $this->actingAs($this->admin)
            ->get(route('payments.overview', ['period' => 'last_year']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('outstanding.invoices', ['count' => 5, 'amount' => 39500])
                ->where('outstanding.overdueInvoices', ['count' => 4, 'amount' => 37800])
                ->where('outstanding.rentOwed', ['count' => 1, 'amount' => 1500])
                ->where('outstanding.maintenanceBills', ['count' => 1, 'amount' => 650])
            );
    });

    test('reads a custom range of days, and falls back to this month for a period it cannot read', function () {
        $this->actingAs($this->admin)
            ->get(route('payments.overview', ['period' => '2026-09-01..2026-09-15']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('period.kind', 'range')
                ->where('period.to', '2026-09-15')
                ->where('previousPeriod', ['from' => '2026-08-17', 'to' => '2026-08-31'])
            );

        $this->actingAs($this->admin)
            ->get(route('payments.overview', ['period' => '2026-02-30']))
            ->assertInertia(fn (Assert $page) => $page->where('period.value', '')->where('period.name', 'this_month'));
    });

    test('leaves salaries out for those who may not see the payroll', function () {
        $property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
        $member = StaffMember::factory()->atProperty($property)->create(['joined_on' => '2025-01-01', 'email' => 'clerk@horizonfm.test']);
        $member->syncSignIn(true, 'self', true, 'password');

        $this->actingAs($member->user)
            ->get(route('payments.overview'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('canSeeSalaries', false)
                ->missing('totals.salary')
                ->where('outstanding.salaries', null)
                ->where('facets.category', fn ($options) => $options->doesntContain('value', 'salary'))
            );

        $this->actingAs($this->admin)
            ->get(route('payments.overview'))
            ->assertInertia(fn (Assert $page) => $page->where('canSeeSalaries', true)->where('totals.salary.count', 32));
    });
});

describe('the payment lists', function () {
    test('narrow payments received, invoices and rent collections to a period', function () {
        $this->actingAs($this->admin)
            ->get(route('payments.index', ['period' => '2026-09']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.total', 7)->where('summary.received', ['amount' => 31780, 'count' => 6, 'inPeriod' => true]));

        $this->actingAs($this->admin)
            ->get(route('invoices.index', ['period' => '2026-09']))
            ->assertInertia(fn (Assert $page) => $page->where('invoices.total', 7)->where('summary.invoiced', 46900));

        $this->actingAs($this->admin)
            ->get(route('rental-payments.index', ['period' => 'last_month']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('RentalPayments/Index')
                ->where('payments.total', 1)
                ->where('summary.byPurpose', ['rent' => 1500, 'deposit' => 0, 'other' => 0])
                ->where('summary.chequesWaiting', ['count' => 1, 'amount' => 1500])
            );
    });

    test('narrows cheques to those dated in a period, with what they come to', function () {
        $this->actingAs($this->admin)
            ->get(route('cheques.index', ['period' => 'next_month_typo']))
            ->assertInertia(fn (Assert $page) => $page->where('period.kind', 'all')->where('periodTotals', null));

        $this->actingAs($this->admin)
            ->get(route('cheques.index', ['period' => '2026-11', 'direction' => ['received']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('cheques.data', fn ($cheques) => $cheques->every(fn ($cheque) => str_starts_with($cheque['chequeDate'], '2026-11')))
                ->where('periodTotals.issued.count', 0)
            );
    });

    test('list salaries for the months in a period, for those who see the payroll', function () {
        $this->actingAs($this->admin)
            ->get(route('salaries.index', ['period' => '2026-09']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('SalaryPayments/Index')
                ->where('salaries.total', 32)
                ->where('summary.paid.count', 32)
                ->where('summary.pending.count', 0)
                ->where('summary.months', 1)
            );

        $this->actingAs($this->admin)
            ->get(route('salaries.index', ['period' => 'this_year', 'status' => ['pending']]))
            ->assertInertia(fn (Assert $page) => $page->where('salaries.total', 32)->where('summary.months', 2));

        $property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
        $member = StaffMember::factory()->atProperty($property)->create(['joined_on' => '2025-01-01', 'email' => 'clerk@horizonfm.test']);
        $member->syncSignIn(true, 'self', true, 'password');

        $this->actingAs($member->user)->get(route('salaries.index'))->assertForbidden();
    });
});
