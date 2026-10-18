<?php

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

    expect($lease->lease_number)->toBe('HL-2026-0002')
        ->and($lease->payments()->count())->toBe(12)
        ->and((float) $lease->payments()->sum('amount'))->toBe(120000.0)
        ->and($lease->payments()->orderBy('installment_number')->pluck('due_date')->map->toDateString()->take(3)->all())
        ->toBe(['2026-11-01', '2026-12-01', '2027-01-01']);

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

test('records a cheque paid to the landlord', function () {
    $instalment = $this->currentLease->payments()->where('status', 'scheduled')->orderBy('installment_number')->first();

    $this->actingAs($this->superAdmin)
        ->patch(route('landlord-payments.update', $instalment), [
            'status' => 'paid',
            'paid_on' => '2026-10-17',
            'payment_method' => 'cheque',
            'cheque_number' => '402605',
        ])
        ->assertSessionHasNoErrors();

    expect($instalment->refresh()->status)->toBe('paid')
        ->and($instalment->paid_on->toDateString())->toBe('2026-10-17');
});

test('needs a payment date to mark an instalment paid', function () {
    $instalment = $this->currentLease->payments()->where('status', 'scheduled')->first();

    $this->actingAs($this->superAdmin)
        ->patch(route('landlord-payments.update', $instalment), ['status' => 'paid', 'payment_method' => 'bank_transfer'])
        ->assertSessionHasErrors('paid_on');
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

    expect($this->currentLease->payments()->count())->toBe(12)
        ->and((float) $this->currentLease->payments()->max('amount'))->toBe(195000.0);
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

test('lists landlord payments with what is still scheduled', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('landlord-payments.index', ['status' => ['scheduled']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('LandlordPayments/Index')
            ->where('payments.total', 8)
            ->where('summary.overdue.count', 0)
            ->where('summary.remaining', 1560000)
        );
});

test('hides other companies\' landlords and leases', function () {
    $otherLease = HeadLease::factory()->create();

    $this->actingAs($this->superAdmin)->get(route('landlords.show', $otherLease->landlord))->assertNotFound();
    $this->actingAs($this->superAdmin)->get(route('head-leases.show', $otherLease))->assertNotFound();
    $this->actingAs($this->superAdmin)->get(route('head-leases.edit', $otherLease))->assertNotFound();

    $otherLease->rebuildSchedule();

    $this->actingAs($this->superAdmin)
        ->patch(route('landlord-payments.update', $otherLease->payments()->first()), ['status' => 'cancelled', 'payment_method' => 'cash'])
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
