<?php

use App\Models\Apartment;
use App\Models\Cheque;
use App\Models\ChequeStatus;
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
        'monthly_rent' => 5200,
        ...$overrides,
    ];

    return [
        ...$input,
        'lines' => [['unit_type' => 'apartment', 'property_id' => $apartment->property_id, 'apartment_id' => $apartment->id]],
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

/**
 * The id of the cheque status with this slug.
 */
function chequeStatusId(string $slug): int
{
    return ChequeStatus::where('slug', $slug)->sole()->id;
}

function storedContract(): Contract
{
    return Contract::where('contract_number', 'CTR-2026-0012')->sole();
}

/**
 * The stored contract, active once saved, with this year's cheques collected.
 */
function activeChequeContract(User $user, Client $client, Apartment $apartment): Contract
{
    test()->actingAs($user)->post(route('contracts.store'), chequeContractInput($client, $apartment))->assertSessionHasNoErrors();
    $contract = storedContract();
    collectChequesDueThisYear($contract);

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

test('saves a contract before its cheques are handed over', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), chequeContractInput($this->alNoor, $this->apartment))
        ->assertSessionHasNoErrors();

    expect(storedContract()->cheques()->count())->toBe(13)
        ->and(storedContract()->cheques()->distinct()->pluck('status')->all())->toBe(['pending']);
});

test('saves a running contract with this year\'s cheques still to collect', function () {
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
        ->assertSessionHasNoErrors();
});

test('a cleared cheque becomes a payment that settles its period, invoicing the period first', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    [$deposit, $first] = [
        $contract->cheques()->where('purpose', 'security_deposit')->sole(),
        $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole(),
    ];
    $this->travelTo(now()->setDate(2026, 11, 3));

    foreach ([$first, $deposit] as $cheque) {
        $this->actingAs($this->superAdmin)->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('submitted'), 'date' => '2026-11-01'])->assertSessionHasNoErrors();
        $this->actingAs($this->superAdmin)->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('approved'), 'date' => '2026-11-03'])->assertSessionHasNoErrors();
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
        ->and($payment->received_on->toDateString())->toBe('2026-11-03')
        ->and($first->chequeStatus->slug)->toBe('approved')
        ->and($first->cleared_on->toDateString())->toBe('2026-11-03');
});

test('a bounced cheque comes off its invoice, and its replacement takes its place', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    $cheque = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $this->travelTo(now()->setDate(2026, 11, 5));
    $cheque->deposit(today()->subDays(3));
    $cheque->clear(today()->subDays(2));

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('bounced'), 'date' => '2026-11-04', 'reason' => 'Insufficient funds'])
        ->assertSessionHasNoErrors();

    expect($cheque->refresh()->status)->toBe('bounced')
        ->and($cheque->chequeStatus->slug)->toBe('bounced')
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
        ->and($replacement->chequeStatus->slug)->toBe('created')
        ->and($replacement->sequence)->toBe(1)
        ->and($replacement->period_start->toDateString())->toBe('2026-11-01')
        ->and($replacement->cheque_date->toDateString())->toBe('2026-11-10')
        ->and($cheque->refresh()->canBeReplaced())->toBeFalse();
});

test('refuses moves a cheque cannot take yet', function (string $target, string $status, string $error, string $contractStatus = 'active') {
    $this->actingAs($this->superAdmin)->post(route('contracts.store'), chequeContractInput($this->alNoor, $this->apartment));
    storedContract()->forceFill(['status' => $contractStatus])->save();
    $cheque = storedContract()->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $cheque->forceFill(['status' => $status, 'cheque_number' => '123456', 'bank_name' => 'Mashreq'])->save();

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId($target), 'date' => '2026-10-17'])
        ->assertSessionHasErrors($error);

    expect($cheque->refresh()->status)->toBe($status)
        ->and($cheque->updates()->count())->toBe(0);
})->with([
    'approving a cheque still to collect' => ['approved', 'pending', 'cheque_status_id'],
    'approving a cheque never submitted' => ['approved', 'received', 'cheque_status_id'],
    'moving a client cheque to a landlord status' => ['issued', 'received', 'cheque_status_id'],
    'submitting for a draft contract' => ['submitted', 'received', 'action', 'draft'],
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

    $this->actingAs($outsider)->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('cancelled'), 'date' => '2026-10-17'])->assertNotFound();
    $this->actingAs($outsider)->put(route('cheques.update', $cheque), ['cheque_date' => '2026-11-01', 'amount' => 1])->assertNotFound();
    $this->actingAs($outsider)
        ->post(route('cheques.bulk-status'), ['cheque_ids' => [$cheque->id], 'cheque_status_id' => chequeStatusId('cancelled'), 'date' => '2026-10-17'])
        ->assertSessionHasErrors('cheque_ids.0');

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
            ->where('facets.status', fn ($options) => collect($options)->pluck('value')->all() === ['pending', 'created', 'submitted', 'approved', 'bounced', 'returned', 'cancelled'])
            ->where('cheques.data', fn ($cheques) => collect($cheques)->contains(
                fn (array $cheque) => $cheque['chequeStatus']['slug'] === 'created' && $cheque['history'][0]['by'] === $this->superAdmin->name
            ))
            ->has('statuses', 8)
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

test('moves a cheque through the company\'s statuses, noting each move in its history', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    $cheque = $contract->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();
    $clearing = ChequeStatus::create(['name' => 'Under clearing', 'slug' => 'under_clearing', 'stage' => 'deposited', 'color' => 'amber', 'sort_order' => 4]);
    $this->travelTo(now()->setDate(2026, 11, 4));

    $this->actingAs($this->superAdmin)->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('submitted'), 'date' => '2026-11-01'])->assertSessionHasNoErrors();
    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $cheque), ['cheque_status_id' => $clearing->id, 'date' => '2026-11-02', 'note' => 'Bank asked for the account holder\'s signature'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Cheque '.$cheque->cheque_number.' is now Under clearing.');

    expect($cheque->refresh()->status)->toBe('deposited')
        ->and($cheque->chequeStatus->is($clearing))->toBeTrue()
        ->and($cheque->deposited_on->toDateString())->toBe('2026-11-01')
        ->and($cheque->payment)->toBeNull();

    $this->actingAs($this->superAdmin)->post(route('cheques.status', $cheque), ['cheque_status_id' => chequeStatusId('approved'), 'date' => '2026-11-04'])->assertSessionHasNoErrors();

    $history = $cheque->updates()->with(['status', 'previousStatus'])->orderBy('id')->get();

    expect($cheque->refresh()->status)->toBe('cleared')
        ->and($cheque->payment)->not->toBeNull()
        ->and($history->map(fn ($update) => "{$update->previousStatus?->slug}>{$update->status->slug}")->all())
        ->toBe(['pending>created', 'created>submitted', 'submitted>under_clearing', 'under_clearing>approved'])
        ->and($history[2]->note)->toBe('Bank asked for the account holder\'s signature')
        ->and($history[2]->changed_on->toDateString())->toBe('2026-11-02')
        ->and($history[3]->user_id)->toBe($this->superAdmin->id);
});

test('updates several cheques at once, leaving those that cannot take the move', function () {
    $contract = activeChequeContract($this->superAdmin, $this->alNoor, $this->apartment);
    [$first, $second, $later] = collect([1, 2, 5])->map(fn (int $sequence) => $contract->cheques()->where('purpose', 'rent')->where('sequence', $sequence)->sole())->all();

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.bulk-status'), [
            'cheque_ids' => [$first->id, $second->id, $later->id],
            'cheque_status_id' => chequeStatusId('submitted'),
            'date' => '2026-10-17',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', '2 cheques moved to Submitted. 1 could not move to it yet and was left as it was.');

    expect($first->refresh()->status)->toBe('deposited')
        ->and($second->refresh()->chequeStatus->slug)->toBe('submitted')
        ->and($later->refresh()->status)->toBe('pending')
        ->and($later->updates()->count())->toBe(0);

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.bulk-status'), ['cheque_ids' => [$later->id], 'cheque_status_id' => chequeStatusId('approved'), 'date' => '2026-10-17'])
        ->assertSessionHasErrors('cheque_status_id');
});

test('lets an admin add cheque statuses, keeping the stage of one cheques are in', function () {
    $created = ChequeStatus::where('slug', 'created')->sole();

    $this->actingAs($this->superAdmin)
        ->post(route('configuration.cheque-statuses.store'), ['name' => 'Under clearing', 'stage' => 'deposited', 'color' => 'amber', 'is_active' => true])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->superAdmin)
        ->put(route('configuration.cheque-statuses.update', $created), ['name' => 'Collected', 'stage' => 'deposited', 'color' => 'cyan'])
        ->assertSessionHasErrors('stage');

    $this->actingAs($this->superAdmin)
        ->put(route('configuration.cheque-statuses.update', $created), ['name' => 'Collected', 'stage' => 'received', 'color' => 'cyan'])
        ->assertSessionHasNoErrors();

    expect(ChequeStatus::where('slug', 'under_clearing')->sole()->stage)->toBe('deposited')
        ->and($created->refresh()->name)->toBe('Collected')
        ->and($created->slug)->toBe('created');

    $this->actingAs($this->superAdmin)
        ->get(route('configuration.cheque-statuses'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/Types')
            ->where('kind', 'chequeStatus')
            ->where('types', fn ($types) => collect($types)->firstWhere('slug', 'created')['inUse'] === true)
        );
});

test('deletes a cheque status only when no cheque used it and its stage keeps another', function () {
    $clearing = ChequeStatus::create(['name' => 'Under clearing', 'slug' => 'under_clearing', 'stage' => 'deposited', 'color' => 'amber', 'sort_order' => 9]);

    $this->actingAs($this->superAdmin)->delete(route('configuration.cheque-statuses.destroy', ChequeStatus::where('slug', 'created')->sole()))->assertSessionHasErrors('type');
    $this->actingAs($this->superAdmin)->delete(route('configuration.cheque-statuses.destroy', ChequeStatus::where('slug', 'returned')->sole()))->assertSessionHasErrors('type');
    $this->actingAs($this->superAdmin)->delete(route('configuration.cheque-statuses.destroy', $clearing))->assertSessionHasNoErrors();

    expect(ChequeStatus::whereKey($clearing->id)->exists())->toBeFalse()
        ->and(ChequeStatus::where('slug', 'returned')->exists())->toBeTrue();
});
