<?php

use App\Models\Company;
use App\Models\MaintenanceContract;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);
    Storage::fake(MaintenanceContract::DOCUMENT_DISK);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->jebelAli = $this->company->properties()->where('code', PropertySeeder::JEBEL_ALI)->sole();
});

/**
 * A year's fire safety contract for the demo camp, its systems given out of the form's order.
 *
 * @return array<string, mixed>
 */
function contractInput(array $overrides = []): array
{
    return [
        'property_id' => test()->property->id,
        'vendor_name' => 'Fire Shield Safety Systems L.L.C.',
        'vendor_phone' => '+971 50 334 9120',
        'vendor_licence_number' => 'DCD-FS-19436',
        'start_date' => '2026-10-01',
        'end_date' => '2027-09-30',
        'contract_value' => 12000,
        'payment_terms' => 'quarterly',
        'visit_frequency' => 'quarterly',
        'coverage' => ['sprinklers', 'fire_alarm', 'extinguishers'],
        'certificate_number' => 'CD-AQZ-2026-70321',
        'certificate_expires_on' => '2027-10-01',
        ...$overrides,
    ];
}

test('adds a fire safety contract with its signed copy', function () {
    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), [...contractInput(), 'document' => UploadedFile::fake()->create('signed.pdf', 120, 'application/pdf')])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $contract = MaintenanceContract::sole();

    expect($contract->contract_number)->toBe('AMC-2026-0001')
        ->and($contract->service)->toBe('fire_safety')
        ->and($contract->company_id)->toBe($this->company->id)
        ->and($contract->property_id)->toBe($this->property->id)
        ->and($contract->status)->toBe('active')
        ->and($contract->coverage)->toBe(['fire_alarm', 'extinguishers', 'sprinklers'])
        ->and($contract->created_by)->toBe($this->admin->id)
        ->and($contract->document_name)->toBe('signed.pdf');

    Storage::disk(MaintenanceContract::DOCUMENT_DISK)->assertExists($contract->document_path);

    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety.show', $contract))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Amcs/Show')
            ->where('contract.state', 'active')
            ->where('contract.paymentCount', 4)
            ->where('contract.installment', 3000)
            ->where('contract.certificate.state', 'valid')
        );
    $this->actingAs($this->admin)->get(route('amcs.fire-safety.document', $contract))->assertOk();
});

test('needs the systems covered, from those offered for its kind', function () {
    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), contractInput(['coverage' => []]))
        ->assertSessionHasErrors('coverage');

    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), contractInput(['coverage' => ['passenger_lifts']]))
        ->assertSessionHasErrors('coverage.0');

    $this->actingAs($this->admin)
        ->post(route('amcs.lifts.store'), contractInput(['coverage' => ['passenger_lifts'], 'visit_frequency' => 'monthly']))
        ->assertSessionHasNoErrors();

    expect(MaintenanceContract::sole()->service)->toBe('lifts');
});

test('refuses a second running contract of the same kind for a property', function () {
    $existing = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'start_date' => '2026-06-01', 'end_date' => '2027-05-31']);

    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), contractInput())
        ->assertSessionHasErrors(['start_date' => "This property is already covered by {$existing->contract_number} from 1 Jun 2026 to 31 May 2027."]);

    // Another kind of contract does not clash, and a cancelled one leaves the property free.
    $this->actingAs($this->admin)
        ->post(route('amcs.pest-control.store'), contractInput(['coverage' => ['bed_bugs']]))
        ->assertSessionHasNoErrors();

    $existing->update(['status' => 'cancelled']);

    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), contractInput())
        ->assertSessionHasNoErrors();
});

test('lists the contracts of its kind with where each stands and what needs attention', function () {
    MaintenanceContract::factory()->create(['property_id' => $this->property->id]);
    $expiring = MaintenanceContract::factory()->expiring()->create(['property_id' => $this->jebelAli->id]);
    MaintenanceContract::factory()->expired()->create(['property_id' => $this->jebelAli->id]);
    MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'service' => 'lifts', 'coverage' => ['passenger_lifts']]);
    MaintenanceContract::factory()->create(['vendor_name' => 'Another company\'s contractor']);

    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Amcs/Index')
            ->where('service', 'fire_safety')
            ->has('contracts.data', 3)
            ->where('contracts.data.0.number', $expiring->contract_number)
            ->where('contracts.data.0.canRenew', true)
            ->where('contracts.data.2.state', 'expired')
            ->where('summary.running', 2)
            ->where('summary.covered', 2)
            ->where('summary.uncovered', [])
            ->where('summary.renewalsDue', 1)
            ->where('facets.state', fn ($facets) => collect($facets)->pluck('count', 'value')->all() === ['upcoming' => 0, 'active' => 1, 'expiring' => 1, 'expired' => 1, 'cancelled' => 0])
        );

    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety', ['state' => ['expiring']]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('contracts.data', 1)
            ->where('contracts.data.0.state', 'expiring')
        );

    // Lifts cover only Al Quoz, so Jebel Ali shows as uncovered there.
    $this->actingAs($this->admin)
        ->get(route('amcs.lifts'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('contracts.data', 1)
            ->where('summary.uncovered.0.id', $this->jebelAli->id)
        );
});

test('works out the visits, payments and next visit from the term', function () {
    $contract = new MaintenanceContract([
        'start_date' => '2026-06-01',
        'end_date' => '2027-05-31',
        'contract_value' => 12000,
        'payment_terms' => 'quarterly',
        'visit_frequency' => 'quarterly',
        'status' => 'active',
    ]);

    // With no visit recorded, the next one is the next date on the schedule from the start.
    expect($contract->nextVisitOn()->toDateString())->toBe('2026-12-01')
        ->and($contract->visitCount())->toBe(4)
        ->and($contract->installmentAmount())->toBe(3000.0);

    $contract->last_visit_on = '2026-07-10';
    expect($contract->nextVisitOn()->toDateString())->toBe('2026-10-10');

    $contract->forceFill(['visit_frequency' => 'weekly', 'payment_terms' => 'per_visit', 'last_visit_on' => '2026-10-20']);
    expect($contract->nextVisitOn()->toDateString())->toBe('2026-10-27')
        ->and($contract->paymentCount())->toBe(52);

    // None after the end of the term, or once the contract is over.
    $contract->forceFill(['visit_frequency' => 'yearly', 'last_visit_on' => '2026-06-01']);
    expect($contract->nextVisitOn())->toBeNull();

    $contract->forceFill(['visit_frequency' => 'monthly', 'status' => 'cancelled']);
    expect($contract->state())->toBe('cancelled')
        ->and($contract->nextVisitOn())->toBeNull();
});

test('renews a contract for the next term with the same contractor', function () {
    $contract = MaintenanceContract::factory()->expiring(20)->create(['property_id' => $this->property->id, 'vendor_name' => 'Red Line Fire Protection']);

    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety.create', ['renew' => $contract->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Amcs/Form')
            ->where('renewing.number', $contract->contract_number)
            ->where('prefill.renewed_from_id', $contract->id)
            ->where('prefill.vendor_name', 'Red Line Fire Protection')
            ->where('prefill.start_date', '2026-11-12')
            ->where('prefill.end_date', '2027-11-11')
        );

    $this->actingAs($this->admin)
        ->post(route('amcs.fire-safety.store'), contractInput(['renewed_from_id' => $contract->id, 'start_date' => '2026-11-12', 'end_date' => '2027-11-11']))
        ->assertSessionHasNoErrors();

    $renewal = MaintenanceContract::whereKeyNot($contract->id)->sole();

    expect($renewal->renewed_from_id)->toBe($contract->id)
        ->and($renewal->state())->toBe('upcoming');

    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety.show', $contract))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contract.canRenew', false)
            ->where('contract.renewal.number', $renewal->contract_number)
        );

    // The next term is lined up, so nothing is left to renew.
    $this->actingAs($this->admin)
        ->get(route('amcs.fire-safety'))
        ->assertInertia(fn (Assert $page) => $page->where('summary.renewalsDue', 0));
});

test('corrects a contract, cancels it and removes its signed copy', function () {
    $contract = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'document_path' => 'amcs/1/1/contract.pdf', 'document_name' => 'contract.pdf']);
    Storage::disk(MaintenanceContract::DOCUMENT_DISK)->put($contract->document_path, 'pdf');

    $this->actingAs($this->admin)
        ->put(route('amcs.fire-safety.update', $contract), contractInput(['vendor_name' => 'Fire Shield Safety', 'status' => 'cancelled', 'remove_document' => true]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('amcs.fire-safety.show', $contract));

    $contract->refresh();

    expect($contract->vendor_name)->toBe('Fire Shield Safety')
        ->and($contract->state())->toBe('cancelled')
        ->and($contract->document_path)->toBeNull();

    Storage::disk(MaintenanceContract::DOCUMENT_DISK)->assertMissing('amcs/1/1/contract.pdf');
});

test('another company\'s contract, or one opened under another kind\'s pages, is not found', function () {
    $other = MaintenanceContract::factory()->create(['document_path' => 'amcs/x/contract.pdf']);
    Storage::disk(MaintenanceContract::DOCUMENT_DISK)->put($other->document_path, 'pdf');

    $this->actingAs($this->admin)->get(route('amcs.fire-safety.show', $other))->assertNotFound();
    $this->actingAs($this->admin)->get(route('amcs.fire-safety.document', $other))->assertNotFound();
    $this->actingAs($this->admin)->put(route('amcs.fire-safety.update', $other), contractInput())->assertNotFound();

    $owner = User::factory()->create(['company_id' => $other->company_id]);
    $this->actingAs($owner)->get(route('amcs.fire-safety.document', $other))->assertOk();

    $lifts = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'service' => 'lifts', 'coverage' => ['passenger_lifts']]);

    $this->actingAs($this->admin)->get(route('amcs.fire-safety.show', $lifts))->assertNotFound();
    $this->actingAs($this->admin)->get(route('amcs.lifts.show', $lifts))->assertOk();
});

test('every kind of contract has its pages, starting from its usual visits and payments', function () {
    foreach (MaintenanceContract::SERVICES as $service) {
        $name = 'amcs.'.str_replace('_', '-', $service);
        $contract = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'service' => $service, 'coverage' => [MaintenanceContract::COVERAGE[$service][0]]]);

        $this->actingAs($this->admin)
            ->get(route($name))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Amcs/Index')->where('service', $service)->has('contracts.data', 1));

        $this->actingAs($this->admin)
            ->get(route("{$name}.create"))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Amcs/Form')
                ->where('coverage', MaintenanceContract::COVERAGE[$service])
                ->where('prefill.visit_frequency', MaintenanceContract::DEFAULTS[$service]['visit_frequency'])
                ->where('prefill.payment_terms', MaintenanceContract::DEFAULTS[$service]['payment_terms'])
            );

        $this->actingAs($this->admin)->get(route("{$name}.show", $contract))->assertOk()->assertInertia(fn (Assert $page) => $page->component('Amcs/Show'));
        $this->actingAs($this->admin)->get(route("{$name}.edit", $contract))->assertOk()->assertInertia(fn (Assert $page) => $page->component('Amcs/Form'));
    }
});

test('the contract pages need a signed-in member of a company', function () {
    $this->get(route('amcs.lifts'))->assertRedirect(route('login'));

    $withoutCompany = User::factory()->create();

    $this->actingAs($withoutCompany)
        ->get(route('amcs.lifts'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Amcs/Index')->where('company', null));
    $this->actingAs($withoutCompany)->get(route('amcs.lifts.create'))->assertForbidden();
    $this->actingAs($withoutCompany)->post(route('amcs.lifts.store'), contractInput(['coverage' => ['passenger_lifts']]))->assertForbidden();
});

test('builds valid contracts from the factory', function () {
    $contract = MaintenanceContract::factory()->create();

    expect($contract->property)->toBeInstanceOf(Property::class)
        ->and($contract->company_id)->toBe($contract->property->company_id)
        ->and($contract->state())->toBe('active');
});
