<?php

use App\Models\ChequeStatus;
use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\LandlordSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->jebelAli = Property::where('code', PropertySeeder::JEBEL_ALI)->sole();
    $this->hamdan = Landlord::where('name', LandlordSeeder::HAMDAN)->sole();
    $this->currentLease = HeadLease::where('lease_number', 'HL-2026-0001')->sole();
});

/**
 * @return array<string, mixed>
 */
function validLeaseInput(Property $property, Landlord $landlord, array $overrides = []): array
{
    return [
        'property_id' => $property->id,
        'landlord_id' => $landlord->id,
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'annual_rent' => 120000,
        'payments_per_year' => 12,
        'security_deposit' => 10000,
        'notice_period_days' => 60,
        'status' => 'active',
        ...$overrides,
    ];
}

test('lists landlords with their running leases and rent', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('landlords.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Landlords/Index')
            ->where('landlords.total', 2)
            ->where('summary.activeLeases', 1)
            ->where('summary.annualRent', 780000)
            ->where('summary.nextPayment.dueDate', '2027-01-01')
        );
});

test('adds a landlord and stores the IBAN without spaces', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('landlords.store'), [
            'landlord_type' => 'company',
            'name' => 'Oasis Real Estate L.L.C.',
            'iban' => 'ae07 0331 2345 6789 0123 456',
        ])
        ->assertSessionHasNoErrors();

    $landlord = Landlord::where('name', 'Oasis Real Estate L.L.C.')->sole();

    expect($landlord->company_id)->toBe($this->superAdmin->company_id)
        ->and($landlord->iban)->toBe('AE070331234567890123456');
});

test('rejects an invalid IBAN', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('landlords.store'), ['landlord_type' => 'company', 'name' => 'Bad Bank', 'iban' => 'NOT-AN-IBAN'])
        ->assertSessionHasErrors('iban');
});

test('adds a head lease, builds its cheque schedule and marks the property as leased', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), validLeaseInput($this->alQuoz, $this->hamdan))
        ->assertSessionHasNoErrors();

    $lease = HeadLease::where('property_id', $this->alQuoz->id)->sole();

    $rent = $lease->cheques()->where('purpose', 'rent');

    expect($lease->lease_number)->toBe('HL-2026-0002')
        ->and((clone $rent)->count())->toBe(12)
        ->and((float) (clone $rent)->sum('amount'))->toBe(120000.0)
        ->and((clone $rent)->orderBy('sequence')->pluck('cheque_date')->map->toDateString()->take(3)->all())
        ->toBe(['2026-11-01', '2026-12-01', '2027-01-01'])
        ->and((float) $lease->cheques()->where('purpose', 'security_deposit')->sole()->amount)->toBe(10000.0)
        ->and($lease->cheques()->distinct()->pluck('direction')->all())->toBe(['issued']);

    $this->alQuoz->refresh();

    expect($this->alQuoz->ownership_type)->toBe('leased')
        ->and($this->alQuoz->landlord->name)->toBe(LandlordSeeder::HAMDAN);
});

test('adds a head lease with a new landlord and files its documents under it', function () {
    Storage::fake('public');

    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), validLeaseInput($this->alQuoz, $this->hamdan, [
            'landlord_mode' => 'new',
            'new_landlord' => ['landlord_type' => 'individual', 'name' => 'Saeed Al Mansoori'],
            'documents' => [['document_type' => 'passport', 'file' => UploadedFile::fake()->create('passport.pdf', 100, 'application/pdf')]],
        ]))
        ->assertSessionHasNoErrors();

    $lease = HeadLease::where('property_id', $this->alQuoz->id)->sole();
    $document = $lease->documents()->sole();

    expect($lease->landlord->name)->toBe('Saeed Al Mansoori')
        ->and($lease->landlord->company_id)->toBe($this->superAdmin->company_id)
        ->and($document->property_id)->toBe($this->alQuoz->id)
        ->and($document->document_type)->toBe('passport');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $document->file_url));
});

test('refuses a lease that overlaps another live lease on the same property', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), validLeaseInput($this->jebelAli, $this->hamdan, ['start_date' => '2027-01-01', 'end_date' => '2027-12-31']))
        ->assertSessionHasErrors('start_date');

    expect(HeadLease::where('property_id', $this->jebelAli->id)->count())->toBe(2);
});

test('records a cheque to the landlord as cleared', function () {
    $cheque = $this->currentLease->cheques()->where('status', 'pending')->orderBy('cheque_date')->first();
    $cheque->applyEntry(['cheque_number' => '402605', 'bank_name' => 'Emirates NBD']);

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $cheque), ['cheque_status_id' => ChequeStatus::where('slug', 'approved')->value('id'), 'date' => '2026-10-17'])
        ->assertSessionHasNoErrors();

    expect($cheque->refresh()->status)->toBe('cleared')
        ->and($cheque->cleared_on->toDateString())->toBe('2026-10-17');
});

test('needs a date to mark a cheque cleared', function () {
    $cheque = $this->currentLease->cheques()->where('status', 'pending')->first();
    $cheque->applyEntry(['cheque_number' => '402606', 'bank_name' => 'Emirates NBD']);

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $cheque), ['cheque_status_id' => ChequeStatus::where('slug', 'approved')->value('id')])
        ->assertSessionHasErrors('date');
});

test('keeps a schedule that already has paid cheques when the rent changes', function () {
    $this->actingAs($this->superAdmin)
        ->put(route('head-leases.update', $this->currentLease), validLeaseInput($this->jebelAli, $this->currentLease->landlord, [
            'start_date' => '2026-01-01',
            'end_date' => '2028-12-31',
            'annual_rent' => 800000,
            'payments_per_year' => 4,
        ]))
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', fn (string $message) => str_contains($message, 'schedule was kept'));

    expect($this->currentLease->cheques()->where('purpose', 'rent')->count())->toBe(12)
        ->and((float) $this->currentLease->cheques()->where('purpose', 'rent')->max('amount'))->toBe(195000.0);
});

test('starts a renewal with the next term prefilled', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('head-leases.create', ['renew' => $this->currentLease->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('HeadLeases/Form')
            ->where('prefill.start_date', '2029-01-01')
            ->where('prefill.end_date', '2031-12-31')
            ->where('prefill.renewed_from_id', $this->currentLease->id)
            ->where('renewing.number', 'HL-2026-0001')
        );
});

test('lists the cheques still to write for landlords', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('cheques.index', ['direction' => ['issued'], 'status' => ['pending']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Cheques/Index')
            ->where('cheques.total', 8)
            ->where('cheques.data.0.chequeDate', '2027-01-01')
            ->where('cheques.data.0.party.name', LandlordSeeder::AL_MARSA)
        );
});

test('sends the old landlord payments address to the cheques landlords hold', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('landlord-payments.index'))
        ->assertRedirect('/cheques?direction%5B%5D=issued');
});

test('hides other companies\' landlords and leases', function () {
    $otherLease = HeadLease::factory()->create();

    $this->actingAs($this->superAdmin)->get(route('landlords.show', $otherLease->landlord))->assertNotFound();
    $this->actingAs($this->superAdmin)->get(route('head-leases.show', $otherLease))->assertNotFound();
    $this->actingAs($this->superAdmin)->get(route('head-leases.edit', $otherLease))->assertNotFound();

    $otherLease->syncCheques();

    $this->actingAs($this->superAdmin)
        ->post(route('cheques.status', $otherLease->cheques()->first()), ['cheque_status_id' => ChequeStatus::where('slug', 'cancelled')->value('id'), 'date' => '2026-10-17'])
        ->assertNotFound();
});

test('cannot lease another company\'s property', function () {
    $otherProperty = Property::factory()->create();

    $this->actingAs($this->superAdmin)
        ->post(route('head-leases.store'), validLeaseInput($otherProperty, $this->hamdan))
        ->assertSessionHasErrors('property_id');
});

test('shows a head lease with its property, what the property holds and its documents', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('head-leases.show', $this->currentLease))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('HeadLeases/Show')
            ->where('property.code', PropertySeeder::JEBEL_ALI)
            ->where('property.rooms', $this->jebelAli->rooms()->count())
            ->where('property.shops', $this->jebelAli->shops()->count())
            ->where('property.apartments', $this->jebelAli->apartments()->count())
            ->has('documents', $this->jebelAli->documents()->count())
            ->where('documents.0.head_lease_id', $this->currentLease->id)
        );
});

test('shows a leased property\'s landlord with their details, their other properties and its head leases', function () {
    $marsaTower = Property::factory()->create([
        'company_id' => $this->jebelAli->company_id,
        'name' => 'Marsa Tower',
        'ownership_type' => 'leased',
        'landlord_id' => $this->jebelAli->landlord_id,
    ]);
    Property::factory()->create(['company_id' => $this->jebelAli->company_id, 'ownership_type' => 'leased', 'landlord_id' => $this->hamdan->id]);

    $this->actingAs($this->superAdmin)
        ->get(route('properties.show', $this->jebelAli))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Properties/Show')
            ->where('landlord.name', LandlordSeeder::AL_MARSA)
            ->where('landlord.type', 'company')
            ->where('landlord.contactName', 'Khalid Al Marsa')
            ->where('landlord.phone', '+971 4 456 7890')
            ->where('landlord.email', 'leasing@almarsa.test')
            ->where('landlord.address', 'Office 702, Marsa Plaza, Dubai Festival City, Dubai')
            ->where('landlord.tradeLicenseNumber', 'CN-1187742')
            ->where('landlord.taxRegistrationNumber', '100456789000003')
            ->where('landlord.bankName', 'Emirates NBD')
            ->where('landlord.iban', 'AE070331234567890123456')
            ->has('landlord.properties', 1)
            ->where('landlord.properties.0.id', $marsaTower->id)
            ->has('leases', 2)
            ->where('leases.0.number', 'HL-2026-0001')
            ->where('leases.0.status', 'active')
            ->where('leases.0.landlordName', LandlordSeeder::AL_MARSA)
            ->where('leases.1.number', 'HL-2025-0001')
            ->where('leases.1.status', 'expired')
        );
});
