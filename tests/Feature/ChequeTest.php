<?php

use App\Models\Apartment;
use App\Models\Cheque;
use App\Models\Client;
use App\Models\Company;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\LandlordSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);
    Storage::fake('local');

    $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->alNoor = Client::where('name', ClientSeeder::AL_NOOR)->sole();
    $this->apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();
});

/**
 * A three-year contract for one apartment at 5,200 a month, billed (and
 * paid by cheque) quarterly, with a 10,000 deposit.
 *
 * @return array<string, mixed>
 */
function chequeContractInput(Client $client, Apartment $apartment, array $overrides = []): array
{
    $input = [
        'client_id' => $client->id,
        'start_date' => '2026-11-01',
        'end_date' => '2029-10-31',
        'billing_cycle' => 'quarterly',
        'payment_terms_days' => 7,
        'security_deposit' => 10000,
        ...$overrides,
    ];

    return [
        ...$input,
        'lines' => [[
            'unit_type' => 'apartment', 'property_id' => $apartment->property_id, 'apartment_id' => $apartment->id, 'quantity' => 1,
            'monthly_rate' => 5200, 'billing_basis' => 'contracted', 'vat_rate' => 0,
            'start_date' => $input['start_date'], 'end_date' => $input['end_date'],
        ]],
    ];
}

/**
 * Entries for the given places in the schedule with a number, bank and front photo.
 *
 * @param  list<string>  $keys
 * @return list<array<string, mixed>>
 */
function chequesInHand(array $keys): array
{
    return array_map(fn (string $key) => [
        'key' => $key,
        'cheque_number' => (string) random_int(100000, 999999),
        'bank_name' => 'Emirates NBD',
        'front_image' => UploadedFile::fake()->image("{$key}.jpg"),
    ], $keys);
}

function storedContract(): Contract
{
    return Contract::where('contract_number', 'CTR-2026-0012')->sole();
}

/**
 * The stored contract, with this year's cheques collected and activated.
 */
function activeChequeContract(User $user, Client $client, Apartment $apartment): Contract
{
    test()->actingAs($user)->post(route('contracts.store'), chequeContractInput($client, $apartment))->assertSessionHasNoErrors();
    $contract = storedContract();
    collectChequesDueThisYear($contract);
    $contract->activate();

    return $contract->refresh();
}

test('builds a three-year contract\'s cheques from its billing cycle, four a year', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), [
            ...chequeContractInput($this->alNoor, $this->apartment),
            'cheques' => chequesInHand(['security_deposit:1', 'rent:1', 'rent:2', 'rent:3', 'rent:4']),
        ])
        ->assertSessionHasNoErrors();

    $contract = storedContract();
    $rent = fn () => $contract->cheques()->where('purpose', 'rent');
    $deposit = $contract->cheques()->where('purpose', 'security_deposit')->sole();

    expect($rent()->count())->toBe(12)
        ->and($rent()->distinct()->pluck('amount')->map(fn ($amount) => (float) $amount)->all())->toBe([15600.0])
        ->and($rent()->orderBy('sequence')->pluck('cheque_date')->map->toDateString()->take(3)->all())->toBe(['2026-11-01', '2027-02-01', '2027-05-01'])
        ->and($rent()->where('sequence', 1)->value('period_end')->toDateString())->toBe('2027-01-31')
        ->and($rent()->where('status', 'received')->pluck('sequence')->sort()->values()->all())->toBe([1, 2, 3, 4])
        ->and($rent()->where('status', 'pending')->count())->toBe(8)
        ->and((float) $deposit->amount)->toBe(10000.0)
        ->and($deposit->status)->toBe('received')
        ->and($deposit->direction)->toBe('received');

    Storage::disk('local')->assertExists($deposit->front_image_path);
});

test('saves a draft contract before its cheques are handed over', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), chequeContractInput($this->alNoor, $this->apartment))
        ->assertSessionHasNoErrors();

    expect(storedContract()->cheques()->count())->toBe(13)
        ->and(storedContract()->cheques()->distinct()->pluck('status')->all())->toBe(['pending']);
});

test('needs this year\'s cheques with a front photo once the contract is running', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);

    $this->actingAs($this->superAdmin)
        ->put(route('contracts.update', $contract), [
            ...chequeContractInput($this->alNoor, $this->apartment),
            'cheques' => [
                ['key' => 'rent:1', 'remove_front_image' => true],
                ['key' => 'rent:2', 'cheque_number' => '', 'bank_name' => ''],
                ['key' => 'rent:5', 'cheque_number' => '', 'bank_name' => ''],
            ],
        ])
        ->assertSessionHasErrors(['cheques.0.front_image', 'cheques.1.cheque_number', 'cheques.1.bank_name'])
        ->assertSessionDoesntHaveErrors(['cheques.2.cheque_number']);
});

test('a cleared cheque becomes a payment that settles its period, invoicing the period first', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    [$deposit, $first] = [
        $contract->cheques()->where('purpose', 'security_deposit')->sole(),
        $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole(),
    ];
    $this->travelTo(now()->setDate(2026, 11, 3));

    foreach ([$first, $deposit] as $cheque) {
        $this->actingAs($this->superAdmin)->post(route('cheques.transition', $cheque), ['action' => 'deposit', 'date' => '2026-11-01'])->assertSessionHasNoErrors();
        $this->actingAs($this->superAdmin)->post(route('cheques.transition', $cheque), ['action' => 'clear', 'date' => '2026-11-03'])->assertSessionHasNoErrors();
    }

    $invoice = $contract->invoices()->sole();
    $payment = $first->refresh()->payment;

    expect($invoice->period_start->toDateString())->toBe('2026-11-01')
        ->and((float) $invoice->total)->toBe(25600.0)
        ->and($invoice->refresh()->status)->toBe('paid')
        ->and($payment->method)->toBe('cheque')
        ->and($payment->status)->toBe('cleared')
        ->and((float) $payment->amount)->toBe(15600.0)
        ->and($payment->cheque_number)->toBe($first->cheque_number)
        ->and($payment->received_on->toDateString())->toBe('2026-11-03');
});

test('a bounced cheque comes off its invoice, and its replacement takes its place', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    $cheque = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $this->travelTo(now()->setDate(2026, 11, 5));
    $cheque->deposit(today()->subDays(3));
    $cheque->clear(today()->subDays(2));

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.transition', $cheque), ['action' => 'bounce', 'date' => '2026-11-04', 'reason' => 'Insufficient funds'])
        ->assertSessionHasNoErrors();

    expect($cheque->refresh()->status)->toBe('bounced')
        ->and($cheque->bounce_reason)->toBe('Insufficient funds')
        ->and($cheque->payment->status)->toBe('bounced')
        ->and((float) $contract->invoices()->sole()->amount_paid)->toBe(0.0);

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.replace', $cheque), [
            'cheque_date' => '2026-11-10',
            'amount' => 15600,
            'cheque_number' => '555001',
            'bank_name' => 'Mashreq',
            'front_image' => UploadedFile::fake()->image('replacement.jpg'),
        ])
        ->assertSessionHasNoErrors();

    $replacement = $cheque->replacement;

    expect($replacement->status)->toBe('received')
        ->and($replacement->sequence)->toBe(1)
        ->and($replacement->period_start->toDateString())->toBe('2026-11-01')
        ->and($replacement->cheque_date->toDateString())->toBe('2026-11-10')
        ->and($cheque->refresh()->canBeReplaced())->toBeFalse();
});

test('refuses steps a cheque cannot take yet', function (string $action, string $status) {
    $this->actingAs($this->superAdmin)->post(route('contracts.store'), chequeContractInput($this->alNoor, $this->apartment));
    $cheque = storedContract()->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $cheque->forceFill(['status' => $status, 'cheque_number' => '123456', 'bank_name' => 'Mashreq'])->save();

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.transition', $cheque), ['action' => $action, 'date' => '2026-10-17'])
        ->assertSessionHasErrors('action');

    expect($cheque->refresh()->status)->toBe($status);
})->with([
    'clearing a cheque still to collect' => ['clear', 'pending'],
    'clearing a cheque never deposited' => ['clear', 'received'],
    'depositing for a draft contract' => ['deposit', 'received'],
]);

test('keeps the cheque schedule once a cheque has cleared, even when the terms change', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    $this->travelTo(now()->setDate(2026, 11, 3));
    $first = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $first->deposit(today());
    $first->clear(today());

    $this->actingAs($this->superAdmin)
        ->put(route('contracts.update', $contract), chequeContractInput($this->alNoor, $this->apartment, ['billing_cycle' => 'monthly']))
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', fn (string $message) => str_contains($message, 'schedule was kept'));

    expect($contract->cheques()->where('purpose', 'rent')->count())->toBe(12);
});

test('cancels the cheques still expected after a contract is terminated', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);

    $contract->terminate(today());

    expect($contract->cheques()->where('status', 'cancelled')->count())->toBe(8)
        ->and($contract->cheques()->where('status', 'received')->count())->toBe(5);
});

test('needs this year\'s cheques with a photo to save an active head lease', function () {
    $hamdan = Landlord::where('name', LandlordSeeder::HAMDAN)->sole();
    $input = [
        'property_id' => $this->alQuoz->id,
        'landlord_id' => $hamdan->id,
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'annual_rent' => 120000,
        'payments_per_year' => 2,
        'status' => 'active',
    ];

    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), [...$input, 'cheques' => [['key' => 'rent:1', 'cheque_number' => '000101', 'bank_name' => 'Emirates NBD']]])
        ->assertSessionHasErrors('cheques.0.front_image');

    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), [...$input, 'cheques' => chequesInHand(['rent:1', 'rent:2'])])
        ->assertSessionHasNoErrors();

    $lease = HeadLease::where('property_id', $this->alQuoz->id)->sole();

    expect($lease->cheques()->pluck('status')->all())->toBe(['issued', 'issued'])
        ->and((float) $lease->cheques()->sum('amount'))->toBe(120000.0);
});

test('shows cheque photos only to the company\'s own users', function () {
    $this->actingAs($this->superAdmin)->post(route('contracts.store'), [
        ...chequeContractInput($this->alNoor, $this->apartment),
        'cheques' => chequesInHand(['rent:1']),
    ]);
    $cheque = storedContract()->cheques()->where('sequence', 1)->where('purpose', 'rent')->sole();

    auth()->logout();
    $this->get(route('cheques.image', [$cheque, 'front']))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->create(['company_id' => Company::factory()->create()->id]))
        ->get(route('cheques.image', [$cheque, 'front']))
        ->assertNotFound();
    $this->actingAs($this->superAdmin)->get(route('cheques.image', [$cheque, 'front']))->assertOk();
    $this->actingAs($this->superAdmin)->get(route('cheques.image', [$cheque, 'back']))->assertNotFound();
});

test('hides other companies\' cheques', function () {
    $this->actingAs($this->superAdmin)->post(route('contracts.store'), chequeContractInput($this->alNoor, $this->apartment));
    $cheque = storedContract()->cheques()->first();
    $outsider = User::factory()->create(['company_id' => Company::factory()->create()->id]);

    $this->actingAs($outsider)->post(route('cheques.transition', $cheque), ['action' => 'cancel'])->assertNotFound();
    $this->actingAs($outsider)->put(route('cheques.update', $cheque), ['cheque_date' => '2026-11-01', 'amount' => 1])->assertNotFound();

    expect($cheque->refresh()->status)->toBe('pending');
});

test('lists cheques by direction with what to bank and what goes out', function () {
    $this->actingAs($this->superAdmin)->post(route('contracts.store'), [
        ...chequeContractInput($this->alNoor, $this->apartment),
        'cheques' => chequesInHand(['rent:1']),
    ]);

    $this->actingAs($this->superAdmin)
        ->get(route('cheques.index', ['direction' => ['received'], 'search' => 'CTR-2026-0012']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Cheques/Index')
            ->where('cheques.total', 13)
            ->where('cheques.data.0.agreement.number', 'CTR-2026-0012')
            ->where('cheques.data.0.party.name', ClientSeeder::AL_NOOR)
            ->where('facets.status', fn ($options) => collect($options)->pluck('value')->all() === Cheque::DIRECTION_STATUSES['received'])
            ->has('summary.toDeposit')
            ->has('summary.dueToPay')
        );
});

test('builds the cheque schedule of a contract that has none', function () {
    $contract = Contract::where('contract_number', 'CTR-2026-0003')->sole();
    $contract->cheques()->delete();

    $this->actingAs($this->superAdmin)
        ->post(route('contracts.cheques.store', $contract))
        ->assertSessionHasNoErrors();

    expect($contract->cheques()->where('purpose', 'rent')->count())->toBe(8)
        ->and($contract->cheques()->where('purpose', 'security_deposit')->count())->toBe(1);
});

test('raises bounced cheques and cheques to deposit on the dashboard', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    $cheque = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $this->travelTo(now()->setDate(2026, 11, 5));
    $cheque->deposit(today());
    $cheque->bounce(today(), 'Account closed');

    $this->actingAs($this->superAdmin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications', fn ($notifications) => collect($notifications)->contains(
                fn (array $notification) => $notification['type'] === 'cheque_bounced' && $notification['subject'] === ClientSeeder::AL_NOOR
            ))
            ->has('cheques.forecast', 12)
            ->where('cheques.upcoming.0.status', 'bounced')
        );
});
