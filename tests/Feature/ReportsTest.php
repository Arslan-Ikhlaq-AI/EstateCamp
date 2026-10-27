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

/**
 * A staff member who signs in to the app but may not see the staff pages.
 */
function reportClerk(): User
{
    $property = test()->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $member = StaffMember::factory()->atProperty($property)->create(['joined_on' => '2025-01-01', 'email' => 'clerk@horizonfm.test']);
    $member->syncSignIn(true, 'self', true, 'password');

    return $member->user;
}

test('the reports home opens, and so does every report', function () {
    $reports = [
        'reports.index' => 'Reports/Index',
        'reports.summary' => 'Reports/Summary',
        'reports.income' => 'Reports/Income',
        'reports.receivables' => 'Reports/Receivables',
        'reports.occupancy' => 'Reports/Occupancy',
        'reports.maintenance' => 'Reports/Maintenance',
        'reports.staff' => 'Reports/Staff',
    ];

    foreach ($reports as $name => $component) {
        $this->actingAs($this->admin)
            ->get(route($name))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component($component));
    }
});

describe('the company summary', function () {
    test('opens on this month against last month, with everything at a glance', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.summary'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('period.name', 'this_month')
                ->where('previousPeriod', ['from' => '2026-09-01', 'to' => '2026-09-30'])
                ->where('prepared', ['date' => '2026-10-17', 'time' => '14:00', 'by' => $this->admin->name])
                ->where('cash.client_payment', ['count' => 4, 'amount' => 27875])
                ->where('previousCash.rental_payment', ['count' => 1, 'amount' => 1500])
                ->where('occupancy.beds.occupied', 27)
                ->where('occupancy.beds.occupancyRate', 87.1)
                ->where('billing.receivables', [
                    'invoices' => ['count' => 5, 'amount' => 39500],
                    'overdue' => ['count' => 4, 'amount' => 37800],
                    'rent' => ['count' => 1, 'amount' => 1500],
                    'total' => 41000,
                ])
                ->where('cheques.bounced', ['count' => 1, 'amount' => 14700])
                ->where('maintenance.reported', 4)
                ->where('maintenance.open', 3)
                ->where('maintenance.urgent', 2)
                ->where('staff.headcount', 32)
                ->where('properties.1.code', PropertySeeder::JEBEL_ALI)
                ->where('properties.1.maintenanceSpend', 180)
            );
    });

    test('covers all time with nothing to compare it to', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.summary', ['period' => 'all']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('period.kind', 'all')
                ->where('previousPeriod', null)
                ->where('previousCash', null)
                ->where('occupancy.checkIns', 28)
                ->where('tenancy.signed', 9)
            );
    });

    test('leaves staff and salaries out for those who may not see the payroll', function () {
        $this->actingAs(reportClerk())
            ->get(route('reports.summary'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('canSeeStaff', false)
                ->where('staff', null)
                ->missing('cash.salary')
            );
    });
});

describe('income and expenditure', function () {
    test('states a month’s income and expenditure against the month before', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.income', ['period' => '2026-09']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Income')
                ->where('previousPeriod', ['from' => '2026-08-01', 'to' => '2026-08-31'])
                ->where('statement.client_payment', ['count' => 6, 'amount' => 31780])
                ->where('statement.maintenance', ['count' => 1, 'amount' => 2400])
                ->where('previousStatement.client_payment.amount', 83380)
                ->has('months', 12)
                ->where('months.11.month', '2026-09')
                ->where('months.11.in', 33280)
                ->where('months.11.categories.rental_payment', 1500)
                ->where('payers.0', ['party' => 'Gulf Builders Contracting L.L.C.', 'count' => 1, 'amount' => 14700])
                ->where('invoiced', ['count' => 7, 'subtotal' => 45900, 'vat' => 1000, 'total' => 46900, 'gas' => ['count' => 0, 'total' => 0]])
            );
    });

    test('shows how money moved and who was paid the most', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.income'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('methods.out.cheque', 195000)
                ->where('payees.0', ['party' => 'Al Marsa Properties L.L.C.', 'count' => 1, 'amount' => 195000])
                ->where('statement.salary.count', 32)
            );
    });

    test('leaves salaries out for those who may not see the payroll', function () {
        $this->actingAs(reportClerk())
            ->get(route('reports.income'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('canSeeSalaries', false)
                ->missing('statement.salary')
                ->where('payees', fn ($payees) => $payees->pluck('party')->all() === ['Al Marsa Properties L.L.C.', 'In-house technician'])
            );
    });
});

describe('receivables', function () {
    test('ages what is owed today, by client and tenant', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.receivables'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Receivables')
                ->where('asOf', '2026-10-17')
                ->where('totals.invoices', ['current' => 1700, 'days_1_30' => 22680, 'days_31_60' => 15120, 'days_61_90' => 0, 'over_90' => 0])
                ->where('totals.rent.days_1_30', 1500)
                ->where('parties.0.name', 'FreshFold Laundry Services L.L.C.')
                ->where('parties.0.buckets.days_31_60', 15120)
                ->where('parties', fn ($parties) => $parties->contains(fn ($party) => $party['name'] === RoomRentalSeeder::TENANT && $party['rentals'] === 1 && $party['oldestDue'] === '2026-10-01'))
                ->has('invoices', 5)
                ->where('invoices.0.daysPastDue', 32)
                ->where('invoices.0.bucket', 'days_31_60')
                ->where('rentals.0.client', RoomRentalSeeder::TENANT)
                ->where('rentals.0.daysPastDue', 16)
                ->where('cheques.bounced.count', 1)
            );
    });

    test('ages each unpaid month of rent from the day it fell due, settling the oldest first', function () {
        $rental = RoomRental::factory()->create(['start_date' => '2026-07-01', 'end_date' => '2026-12-31', 'monthly_rent' => 1000]);
        $rental->recordPayment(['paid_on' => '2026-07-01', 'amount' => 1500, 'purpose' => 'rent', 'method' => 'cash']);

        $unpaid = collect($rental->unpaidRent())->map(fn (array $month) => [$month['dueOn']->toDateString(), $month['amount']])->all();

        expect($unpaid)->toBe([['2026-08-01', 500.0], ['2026-09-01', 1000.0], ['2026-10-01', 1000.0]]);
    });
});

describe('occupancy', function () {
    test('measures each property and kind of room today, and who is staying', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.occupancy'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Occupancy')
                ->where('summary.staying', 27)
                ->where('summary.beds', ['total' => 37, 'occupied' => 27, 'available' => 4, 'outOfService' => 6, 'occupancyRate' => 87.1])
                ->where('properties.0.beds.occupancyRate', 91.7)
                ->where('properties.0.potentialRent', 12000)
                ->has('roomTypes', 3)
                ->has('vacancies', 4)
                ->where('vacancies.0.number', '101')
                ->where('vacancies.0.free', 1)
                ->where('gender', ['male' => 25, 'female' => 2])
                ->where('nationalities.0', ['nationality' => 'Indian', 'group' => 'named', 'count' => 9])
                ->where('clients.0.name', 'Gulf Builders Contracting L.L.C.')
                ->where('clients.0.staying', 15)
                ->has('trend', 12)
                ->where('trend.11', ['month' => '2026-10', 'staying' => 27])
            );
    });

    test('counts moves in and out over a period, with the year up to it', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.occupancy', ['period' => '2026-02']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.checkIns', 11)
                ->where('summary.checkOuts', 0)
                ->where('trend.0.month', '2025-03')
                ->where('trend.11', ['month' => '2026-02', 'staying' => 19])
            );
    });
});

describe('maintenance', function () {
    test('compares a period’s work with the one before', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.maintenance', ['period' => 'last_month']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Maintenance')
                ->where('summary', ['reported' => 2, 'completed' => 2, 'open' => 3, 'urgent' => 2, 'averageDays' => 6.5, 'cost' => 2580, 'paid' => 2400, 'unpaid' => ['count' => 1, 'amount' => 650]])
                ->where('previous', ['reported' => 0, 'completed' => 0, 'averageDays' => null, 'cost' => 0, 'paid' => 0])
                ->where('vendors.0', ['name' => 'Shield Waterproofing L.L.C.', 'jobs' => 1, 'amount' => 2400, 'unpaid' => 0])
                ->where('categories', fn ($categories) => $categories->contains(fn ($category) => $category['slug'] === 'painting_civil' && $category['cost'] == 2400 && $category['averageDays'] == 12))
                ->where('trend.11', ['month' => '2026-09', 'reported' => 2, 'completed' => 2, 'cost' => 2580])
            );
    });

    test('shows the work still open by how long it has waited', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.maintenance'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.reported', 4)
                ->where('summary.cost', 650)
                ->where('vendors.0.unpaid', 650)
                ->where('backlog', ['days_0_7' => 3, 'days_8_30' => 0, 'days_31_90' => 0, 'over_90' => 0])
                ->where('oldestOpen.0.number', 'MNT-2026-0002')
                ->where('oldestOpen.0.days', 6)
            );
    });
});

describe('staff and payroll', function () {
    test('reports a month’s payroll, attendance and documents to renew', function () {
        $this->actingAs($this->admin)
            ->get(route('reports.staff', ['period' => '2026-09']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Staff')
                ->where('summary.headcount', 32)
                ->where('summary.left', 1)
                ->where('summary.attendance.rate', 95)
                ->where('payroll', [['month' => '2026-09', 'staff' => 32, 'gross' => 353200, 'deductions' => 13613.32, 'additions' => 0, 'net' => 339336.68, 'paid' => 339336.68, 'pending' => 0]])
                ->has('people', 32)
                ->where('workplaces.0.type', 'head_office')
                ->where('workplaces.0.headcount', 11)
                ->where('documents.0.type', 'emirates_id')
                ->where('documents.0.days', -5)
            );
    });

    test('is only for those who may see the staff', function () {
        $clerk = reportClerk();

        $this->actingAs($clerk)->get(route('reports.staff'))->assertForbidden();
        $this->actingAs($clerk)->get(route('reports.index'))->assertOk();
    });
});
