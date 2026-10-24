<?php

use App\Models\Company;
use App\Models\MaintenanceJob;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
});

/**
 * Finished work at the demo camp, at `$amount`, finished on `$finishedOn`.
 */
function bill(float $amount, string $finishedOn = '2026-10-10', array $attributes = []): MaintenanceJob
{
    return MaintenanceJob::factory()->completed($amount)->create([
        'property_id' => test()->property->id,
        'reported_on' => $finishedOn,
        'completed_on' => $finishedOn,
        'payment_method' => null,
        ...$attributes,
    ]);
}

test('pays a bill and issues its payment voucher', function () {
    $job = bill(450);

    $this->actingAs($this->admin)
        ->post(route('maintenance-bills.pay', $job), ['paid_on' => '2026-10-17', 'payment_method' => 'bank_transfer', 'reference' => 'TRF-88213'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', "{$job->job_number} was paid; voucher PV-2026-0001 was issued.");

    $job->refresh();

    expect($job->voucher_number)->toBe('PV-2026-0001')
        ->and($job->paid_on->toDateString())->toBe('2026-10-17')
        ->and($job->payment_method)->toBe('bank_transfer')
        ->and($job->payment_reference)->toBe('TRF-88213')
        ->and($job->paid_by)->toBe($this->admin->id);
});

test('numbers vouchers in turn, including payments recorded on the job’s cost', function () {
    $first = bill(450);
    $second = bill(120);

    $first->markPaid(today(), 'cash');
    $second->recordCost(['paid_on' => '2026-10-16']);

    expect($first->voucher_number)->toBe('PV-2026-0001')
        ->and($second->fresh()->voucher_number)->toBe('PV-2026-0002');
});

test('refuses to pay work with no amount, or a bill already paid', function () {
    $open = MaintenanceJob::factory()->create(['property_id' => $this->property->id]);
    $paid = bill(300, attributes: ['paid_on' => '2026-10-12']);
    $payment = ['paid_on' => '2026-10-17', 'payment_method' => 'cash'];

    $this->actingAs($this->admin)->post(route('maintenance-bills.pay', $open), $payment)->assertSessionHasErrors(['bill' => "Record what {$open->job_number} cost before paying it."]);
    $this->actingAs($this->admin)->post(route('maintenance-bills.pay', $paid), $payment)->assertSessionHasErrors(['bill' => "{$paid->job_number} is already paid."]);
});

test('undoes a payment recorded by mistake, cancelling its voucher', function () {
    $job = bill(450);
    $job->markPaid(today(), 'cash', 'R-1');

    $this->actingAs($this->admin)->post(route('maintenance-bills.unpay', $job))->assertSessionHasNoErrors();

    $job->refresh();

    expect($job->paid_on)->toBeNull()
        ->and($job->voucher_number)->toBeNull()
        ->and($job->payment_reference)->toBeNull();
});

test('shows the voucher of a paid bill, and none for an unpaid one', function () {
    $paid = bill(450);
    $paid->markPaid(today(), 'cheque', '004512', $this->admin);
    $unpaid = bill(200);

    $this->actingAs($this->admin)
        ->get(route('maintenance-bills.voucher', $paid))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceBills/Voucher')
            ->where('bill.voucherNumber', 'PV-2026-0001')
            ->where('bill.paymentReference', '004512')
            ->where('bill.paidBy', $this->admin->name)
        );

    $this->actingAs($this->admin)->get(route('maintenance-bills.voucher', $unpaid))->assertNotFound();
});

test('lists bills unpaid first, narrowed to a period and a status', function () {
    $unpaid = bill(300, '2026-10-10');
    bill(500, '2026-09-18', ['paid_on' => '2026-09-20']);
    bill(200, '2026-10-01', ['paid_on' => '2026-10-05']);
    MaintenanceJob::factory()->create(['property_id' => $this->property->id]);

    $this->actingAs($this->admin)
        ->get(route('maintenance-bills.index', ['period' => 'this_month']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceBills/Index')
            ->where('bills.total', 2)
            ->where('bills.data.0.id', $unpaid->id)
            ->where('summary.unpaid', ['count' => 1, 'amount' => 300])
            ->where('summary.paid', ['count' => 1, 'amount' => 200])
            ->where('summary.billed', ['count' => 2, 'amount' => 500])
        );

    $this->actingAs($this->admin)
        ->get(route('maintenance-bills.index', ['status' => ['paid']]))
        ->assertInertia(fn (Assert $page) => $page->where('bills.total', 2)->where('facets.status', [['value' => 'unpaid', 'count' => 1], ['value' => 'paid', 'count' => 2]]));
});

test('hides another company’s bills', function () {
    $job = MaintenanceJob::factory()->completed(450)->create();

    $this->actingAs($this->admin)->post(route('maintenance-bills.pay', $job), ['paid_on' => '2026-10-17', 'payment_method' => 'cash'])->assertNotFound();
    $this->actingAs($this->admin)->get(route('maintenance-bills.voucher', $job))->assertNotFound();

    expect($job->fresh()->paid_on)->toBeNull();
});
