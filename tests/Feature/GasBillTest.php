<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\GasBill;
use App\Models\Invoice;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->jebelAli = Property::where('code', PropertySeeder::JEBEL_ALI)->sole();
    // The Gulf Builders crews at Al Quoz pay for their gas on top of the rent.
    $this->gulfBuilders = Contract::where('contract_number', 'CTR-2026-0001')->sole();
});

/**
 * September's metered gas for the Gulf Builders crews at Al Quoz:
 * 150 units at 2.50 with 5% VAT, invoiced today.
 *
 * @return array<string, mixed>
 */
function gasBillInput(array $overrides = []): array
{
    return [
        'contract_id' => test()->gulfBuilders->id,
        'property_id' => test()->alQuoz->id,
        'month' => '2026-09',
        'issue_date' => '2026-10-17',
        'metered' => true,
        'previous_reading' => 1200,
        'current_reading' => 1350,
        'unit_rate' => 2.5,
        'vat_rate' => 5,
        'supplier_reference' => 'ADNOC-88213',
        ...$overrides,
    ];
}

/**
 * The props of an Inertia page.
 *
 * @return array<string, mixed>
 */
function pageProps(string $url): array
{
    return test()->actingAs(test()->admin)->get($url)->assertOk()->viewData('page')['props'];
}

test('bills a month of metered gas to the client on its own invoice', function () {
    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput())
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('gas-bills.index', ['period' => '2026-09']))
        ->assertSessionHas('success', 'Gas bill INV-2026-0051 for September 2026 was issued to '.ClientSeeder::GULF_BUILDERS.'.');

    $bill = GasBill::sole();
    $invoice = $bill->invoice;
    $item = $invoice->items()->sole();

    expect($invoice->invoice_number)->toBe('INV-2026-0051')
        ->and($invoice->kind)->toBe('gas')
        ->and($invoice->client_id)->toBe($this->gulfBuilders->client_id)
        ->and($invoice->period_start->toDateString())->toBe('2026-09-01')
        ->and($invoice->period_end->toDateString())->toBe('2026-09-30')
        ->and($invoice->due_date->toDateString())->toBe('2026-10-24')
        ->and((float) $invoice->subtotal)->toBe(375.0)
        ->and((float) $invoice->vat_amount)->toBe(18.75)
        ->and((float) $invoice->total)->toBe(393.75)
        ->and($invoice->status)->toBe('issued')
        ->and($item->item_type)->toBe('gas')
        ->and((float) $item->quantity)->toBe(150.0)
        ->and((float) $item->unit_price)->toBe(2.5)
        ->and($item->description)->toBe('Gas · Al Quoz Worker Village · 1 Sep 2026 – 30 Sep 2026 · meter 1,200 → 1,350')
        ->and($bill->units())->toBe(150.0)
        ->and($bill->recorded_by)->toBe($this->admin->id);
});

test('charges a fixed amount when the gas is not metered', function () {
    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput(['metered' => false, 'amount' => 480]))
        ->assertSessionHasNoErrors();

    $bill = GasBill::sole();
    $item = $bill->invoice->items()->sole();

    expect($bill->previous_reading)->toBeNull()
        ->and($bill->unit_rate)->toBeNull()
        ->and((float) $bill->invoice->total)->toBe(504.0)
        ->and((float) $item->quantity)->toBe(1.0)
        ->and((float) $item->unit_price)->toBe(480.0);
});

test('refuses gas bills a contract does not call for', function (string $contract, string $property, string $month, string $field) {
    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput([
            'contract_id' => Contract::where('contract_number', $contract)->sole()->id,
            'property_id' => Property::where('code', $property)->sole()->id,
            'month' => $month,
        ]))
        ->assertSessionHasErrors($field);

    expect(GasBill::count())->toBe(0);
})->with([
    'gas included in the rent' => ['CTR-2026-0004', PropertySeeder::JEBEL_ALI, '2026-09', 'contract_id'],
    'a property the contract does not rent at' => ['CTR-2026-0001', PropertySeeder::JEBEL_ALI, '2026-09', 'property_id'],
    'a month before the contract started' => ['CTR-2026-0001', PropertySeeder::AL_QUOZ, '2025-12', 'month'],
    'a month still to come' => ['CTR-2026-0001', PropertySeeder::AL_QUOZ, '2026-11', 'month'],
]);

test('needs the current reading above the previous one', function () {
    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput(['current_reading' => 1100]))
        ->assertSessionHasErrors(['current_reading' => 'The current reading must be higher than the previous one.']);
});

test('bills each month once, unless that bill was voided', function () {
    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput())->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput())
        ->assertSessionHasErrors(['month' => "That month's gas is already billed on INV-2026-0051. Change that bill, or void it first."]);

    $this->actingAs($this->admin)->post(route('invoices.void', Invoice::where('invoice_number', 'INV-2026-0051')->sole()))->assertSessionHasNoErrors();

    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput())->assertSessionHasNoErrors();

    expect(GasBill::count())->toBe(2);
});

test('leaves the contract\'s rent periods to its rent invoices', function () {
    $this->travelTo(now()->setDate(2026, 12, 2));
    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput(['month' => '2026-11']))->assertSessionHasNoErrors();

    $this->actingAs($this->admin)->post(route('contracts.invoices.store', $this->gulfBuilders))->assertSessionHasNoErrors();

    $rent = $this->gulfBuilders->invoices()->where('kind', 'rent')->latest('id')->first();

    expect($rent->period_start->toDateString())->toBe('2026-11-01')
        ->and((float) $rent->total)->toBe(14700.0);
});

test('corrects a bill until something is paid towards it', function () {
    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput())->assertSessionHasNoErrors();
    $bill = GasBill::sole();

    $this->actingAs($this->admin)
        ->put(route('gas-bills.update', $bill), gasBillInput(['current_reading' => 1400]))
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Gas bill INV-2026-0051 was updated.');

    $invoice = $bill->invoice->refresh();

    expect($invoice->invoice_number)->toBe('INV-2026-0051')
        ->and((float) $invoice->total)->toBe(525.0)
        ->and((float) $invoice->items()->sole()->quantity)->toBe(200.0);

    $this->actingAs($this->admin)->post(route('payments.store'), [
        'client_id' => $this->gulfBuilders->client_id,
        'received_on' => '2026-10-17',
        'amount' => 525,
        'method' => 'cash',
        'allocations' => [['invoice_id' => $invoice->id, 'amount' => 525]],
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->admin)->put(route('gas-bills.update', $bill), gasBillInput(['current_reading' => 1500]))->assertSessionHasErrors('bill');
    $this->actingAs($this->admin)->get(route('gas-bills.edit', $bill))->assertRedirect(route('invoices.show', $invoice));

    expect((float) $invoice->refresh()->total)->toBe(525.0)
        ->and($invoice->status)->toBe('paid');
});

test('counts what clients pay towards gas bills as gas income', function () {
    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput())->assertSessionHasNoErrors();
    $gas = Invoice::where('invoice_number', 'INV-2026-0051')->sole();
    $rent = $this->gulfBuilders->invoices()->where('kind', 'rent')->whereDate('period_start', '2026-10-01')->sole();
    $clientPaymentsBefore = pageProps(route('payments.overview'))['totals']['client_payment']['amount'];

    // One payment settles the gas bill and pays part of October's rent.
    $this->actingAs($this->admin)->post(route('payments.store'), [
        'client_id' => $this->gulfBuilders->client_id,
        'received_on' => '2026-10-17',
        'amount' => 1000,
        'method' => 'bank_transfer',
        'allocations' => [['invoice_id' => $gas->id, 'amount' => 393.75], ['invoice_id' => $rent->id, 'amount' => 606.25]],
    ])->assertSessionHasNoErrors();

    $overview = pageProps(route('payments.overview'));
    $income = pageProps(route('reports.income'));

    expect($overview['totals']['gas_payment'])->toBe(['count' => 1, 'amount' => 393.75])
        ->and($overview['totals']['client_payment']['amount'])->toBe(round($clientPaymentsBefore + 606.25, 2))
        ->and($income['statement']['gas_payment']['amount'])->toBe(393.75)
        ->and($income['invoiced']['gas'])->toBe(['count' => 1, 'total' => 393.75]);
});

test('lists the bills and the contracts still to bill for the month', function () {
    $this->actingAs($this->admin)
        ->get(route('gas-bills.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('GasBills/Index')
            ->where('toBill.month', '2026-10')
            ->where('toBill.contracts', fn ($contracts) => collect($contracts)->pluck('key')->all() === [
                "{$this->gulfBuilders->id}-{$this->alQuoz->id}",
                Contract::where('contract_number', 'CTR-2026-0009')->sole()->id."-{$this->jebelAli->id}",
            ])
            ->where('bills.total', 0)
            ->where('summary.contracts', 2)
        );

    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput(['month' => '2026-10']))->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->get(route('gas-bills.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('toBill.contracts', fn ($contracts) => collect($contracts)->pluck('contract.number')->all() === ['CTR-2026-0009'])
            ->where('bills.total', 1)
            ->where('bills.data.0.invoice.number', 'INV-2026-0051')
            ->where('bills.data.0.units', 150)
            ->where('bills.data.0.canEdit', true)
            ->where('summary.billed', ['count' => 1, 'amount' => 393.75])
            ->where('summary.outstanding.amount', 393.75)
        );
});

test('shows a contract\'s gas bills on its page', function () {
    $this->actingAs($this->admin)->post(route('gas-bills.store'), gasBillInput())->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->get(route('contracts.show', $this->gulfBuilders))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contract.gasIncluded', false)
            ->where('can.billGas', true)
            ->has('gasBills', 1)
            ->where('gasBills.0.invoice.total', 393.75)
        );
});

test('a rent cheque pays its own period\'s rent before a gas bill for the same days', function () {
    Storage::fake('local');
    $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

    $this->actingAs($this->admin)->post(route('contracts.store'), [
        'client_id' => Client::where('name', ClientSeeder::AL_NOOR)->sole()->id,
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'billing_cycle' => 'monthly',
        'payment_terms_days' => 7,
        'gas_included' => false,
        'lines' => [[
            'unit_type' => 'apartment', 'property_id' => $this->alQuoz->id, 'apartment_id' => $apartment->id, 'quantity' => 1,
            'monthly_rate' => 5200, 'billing_basis' => 'contracted', 'vat_rate' => 0,
            'start_date' => '2026-11-01', 'end_date' => '2027-10-31',
        ]],
    ])->assertSessionHasNoErrors();

    $contract = Contract::where('contract_number', 'CTR-2026-0012')->sole();
    collectChequesDueThisYear($contract);
    $contract->activate();
    $this->travelTo(now()->setDate(2026, 11, 20));

    $this->actingAs($this->admin)
        ->post(route('gas-bills.store'), gasBillInput(['contract_id' => $contract->id, 'month' => '2026-11', 'issue_date' => '2026-11-20']))
        ->assertSessionHasNoErrors();

    $cheque = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $cheque->deposit(today());
    $cheque->clear(today());

    $rent = $contract->invoices()->where('kind', 'rent')->sole();
    $gas = $contract->invoices()->where('kind', 'gas')->sole();

    expect($contract->gas_included)->toBeFalse()
        ->and($rent->period_start->toDateString())->toBe('2026-11-01')
        ->and($rent->status)->toBe('paid')
        ->and($gas->status)->toBe('issued')
        ->and((float) $gas->amount_paid)->toBe(0.0);
});
