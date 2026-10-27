<?php

use App\Models\Cheque;
use App\Models\Company;
use App\Models\Landlord;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\PropertyType;
use App\Models\RoomType;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * One upload for each document every property must have.
 *
 * @return list<array<string, mixed>>
 */
function requiredPropertyDocuments(): array
{
    return array_map(fn (string $type) => [
        'document_type' => $type,
        'file' => UploadedFile::fake()->create("{$type}.pdf", 100, 'application/pdf'),
    ], PropertyDocument::REQUIRED_TYPES);
}

/**
 * @return array<string, mixed>
 */
function validPropertyInput(array $overrides = []): array
{
    return [
        'name' => 'Sonapur Labour Camp',
        'code' => 'HFM-SNP-01',
        'property_type_id' => PropertyType::where('slug', 'worker_accommodation')->value('id'),
        'status' => 'active',
        'country_code' => 'ae',
        'city' => 'Dubai',
        'area' => 'Muhaisnah 2',
        'makani_number' => '3012345678',
        'ownership_type' => 'leased',
        'landlord_mode' => 'existing',
        'landlord_id' => Landlord::where('name', 'Al Marsa Properties L.L.C.')->value('id'),
        'lease_start_date' => '2026-01-01',
        'lease_end_date' => '2027-12-31',
        'annual_rent' => 240000,
        'payments_per_year' => 4,
        'documents' => requiredPropertyDocuments(),
        ...$overrides,
    ];
}

test('guests are redirected to the login page', function () {
    $this->get(route('properties.create'))->assertRedirect(route('login'));
});

test('users without a company cannot add properties', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('properties.create'))
        ->assertForbidden();
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);
        Storage::fake('public');

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    });

    test('shows the add form with its options', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('properties.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Properties/Form')
                ->where('property', null)
                ->has('propertyTypes', 3)
                ->where('documentTypes', PropertyDocument::TYPES)
                ->has('landlords', 1)
                ->where('landlords.0.name', 'Al Marsa Properties L.L.C.')
            );
    });

    test('adds a property with its cover and documents', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'cover_image' => UploadedFile::fake()->image('cover.jpg'),
                'documents' => [[
                    'document_type' => 'tenancy_contract',
                    'title' => 'Ejari',
                    'file' => UploadedFile::fake()->create('ejari.pdf', 200, 'application/pdf'),
                    'issued_on' => '2026-01-01',
                    'expires_on' => '2027-12-31',
                ], ...array_slice(requiredPropertyDocuments(), 1)],
            ]))
            ->assertRedirect(route('properties.index'))
            ->assertSessionHas('success', 'Sonapur Labour Camp was added.');

        $property = Property::where('code', 'HFM-SNP-01')->sole();
        $document = $property->documents()->where('document_type', 'tenancy_contract')->sole();

        expect($property->company_id)->toBe($this->superAdmin->company_id)
            ->and($property->country_code)->toBe('AE')
            ->and($property->landlord->name)->toBe('Al Marsa Properties L.L.C.')
            ->and($property->documents()->count())->toBe(4);
        expect($document->title)->toBe('Ejari');
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $property->cover_image_url));
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $document->file_url));
    });

    test('adds a new landlord from the property form and links it', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'landlord_mode' => 'new',
                'landlord_id' => null,
                'new_landlord' => [
                    'landlord_type' => 'individual',
                    'name' => 'Saeed Al Mansoori',
                    'phone' => '+971 50 222 3344',
                    'email' => 'saeed@example.test',
                ],
            ]))
            ->assertRedirect(route('properties.index'));

        $landlord = Landlord::where('name', 'Saeed Al Mansoori')->sole();

        expect($landlord->company_id)->toBe($this->superAdmin->company_id)
            ->and($landlord->landlord_type)->toBe('individual')
            ->and($landlord->phone)->toBe('+971 50 222 3344')
            ->and(Property::where('code', 'HFM-SNP-01')->sole()->landlord_id)->toBe($landlord->id);
    });

    test('rejects another company\'s landlord', function () {
        $otherLandlord = Company::factory()->create()->landlords()->create(['landlord_type' => 'company', 'name' => 'Elsewhere Holdings']);

        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput(['landlord_id' => $otherLandlord->id]))
            ->assertSessionHasErrors('landlord_id');

        $this->assertDatabaseMissing('properties', ['code' => 'HFM-SNP-01']);
    });

    test('adds rooms, shops and apartments in numbered batches', function () {
        $dormitory = RoomType::where('slug', 'dormitory')->value('id');

        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'total_floors' => 3,
                'total_units' => 8,
                'units' => [
                    'rooms' => [
                        ['count' => 3, 'first_number' => '101', 'room_type_id' => $dormitory, 'capacity' => 4, 'rent_per_bed' => 450],
                        ['count' => 2, 'first_number' => '201', 'room_type_id' => $dormitory, 'capacity' => 6],
                    ],
                    'shops' => [['count' => 2, 'first_number' => 'S-09', 'area_sqm' => 30]],
                    'apartments' => [['count' => 1, 'first_number' => 'A-101', 'bedrooms' => 2, 'bathrooms' => 1]],
                ],
            ]))
            ->assertRedirect(route('properties.index'))
            ->assertSessionHas('success', 'Sonapur Labour Camp was added. 5 rooms, 2 shops and 1 apartment were added.');

        $property = Property::where('code', 'HFM-SNP-01')->sole();

        expect($property->rooms()->orderBy('room_number')->pluck('room_number')->all())->toBe(['101', '102', '103', '201', '202'])
            ->and($property->rooms()->where('room_number', '101')->sole()->beds()->count())->toBe(4)
            ->and((float) $property->rooms()->where('room_number', '101')->sole()->rent_per_bed)->toBe(450.0)
            ->and($property->total_rooms)->toBe(5)
            ->and($property->total_capacity)->toBe(24)
            ->and($property->shops()->orderBy('shop_number')->pluck('shop_number')->all())->toBe(['S-09', 'S-10'])
            ->and($property->apartments()->sole()->apartment_number)->toBe('A-101')
            ->and($property->total_floors)->toBe(3)
            ->and($property->total_units)->toBe(8);
    });

    test('adds a batch of more than a hundred rooms', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'total_units' => 150,
                'units' => ['rooms' => [['count' => 150, 'first_number' => '101', 'room_type_id' => RoomType::value('id'), 'capacity' => 1]]],
            ]))
            ->assertRedirect(route('properties.index'));

        $property = Property::where('code', 'HFM-SNP-01')->sole();

        expect($property->rooms()->count())->toBe(150)
            ->and($property->rooms()->orderByDesc('room_number')->value('room_number'))->toBe('250');
    });

    test('counts the property\'s saved units against its number of units', function () {
        $property = Property::where('code', 'HFM-JBA-01')->sole();
        $originalTotal = $property->total_units;

        $this->actingAs($this->superAdmin)
            ->put(route('properties.update', $property), validPropertyInput([
                'code' => 'HFM-JBA-01',
                'total_units' => $property->unitCount(),
                'units' => ['shops' => [['count' => 1, 'first_number' => 'S-90']]],
            ]))
            ->assertSessionHasErrors('total_units');

        expect($property->refresh()->total_units)->toBe($originalTotal);
    });

    test('rejects unit numbers already used in the property', function () {
        $property = Property::where('code', 'HFM-AQZ-01')->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('properties.update', $property), validPropertyInput([
                'code' => 'HFM-AQZ-01',
                'units' => ['rooms' => [['count' => 2, 'first_number' => '100', 'room_type_id' => RoomType::value('id'), 'capacity' => 2]]],
            ]))
            ->assertSessionHasErrors(['units.rooms.0.first_number' => 'Room 101 already exists in this property.']);

        expect($property->rooms()->where('room_number', '100')->exists())->toBeFalse();
    });

    test('drops landlord and lease details from owned properties', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput(['ownership_type' => 'owned']))
            ->assertRedirect(route('properties.index'));

        $property = Property::where('code', 'HFM-SNP-01')->sole();

        expect($property->landlord_id)->toBeNull()
            ->and($property->lease_end_date)->toBeNull()
            ->and($property->headLeases()->exists())->toBeFalse()
            ->and(Landlord::count())->toBe(1);
    });

    test('sets up the head lease of a leased property and files its documents under it', function () {
        $this->travelTo('2026-10-17');

        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput(['ejari_number' => 'EJ-2026-555', 'security_deposit' => 20000]))
            ->assertRedirect(route('properties.index'));

        $property = Property::where('code', 'HFM-SNP-01')->sole();
        $lease = $property->headLeases()->sole();

        expect($lease->landlord_id)->toBe($property->landlord_id)
            ->and($lease->start_date->toDateString())->toBe('2026-01-01')
            ->and($lease->end_date->toDateString())->toBe('2027-12-31')
            ->and((float) $lease->annual_rent)->toBe(240000.0)
            ->and($lease->ejari_number)->toBe('EJ-2026-555')
            ->and($lease->status)->toBe('active')
            ->and($lease->cheques()->where('purpose', 'rent')->count())->toBe(8)
            ->and($property->documents()->where('head_lease_id', $lease->id)->count())->toBe(4);
    });

    test('updates the terms of the property\'s current lease and rebuilds its schedule', function () {
        $this->travelTo('2026-10-17');
        $this->actingAs($this->superAdmin)->post(route('properties.store'), validPropertyInput());
        $property = Property::where('code', 'HFM-SNP-01')->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('properties.update', $property), validPropertyInput(['annual_rent' => 300000, 'payments_per_year' => 2]))
            ->assertRedirect(route('properties.index'));

        $lease = $property->headLeases()->sole();

        expect((float) $lease->annual_rent)->toBe(300000.0)
            ->and($lease->cheques()->where('purpose', 'rent')->count())->toBe(4);
    });

    test('records the cheque details and photos entered with a leased property', function () {
        $this->travelTo('2026-10-17');
        Storage::fake('local');

        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'cheques' => [[
                    'key' => 'rent:1',
                    'cheque_number' => '000123',
                    'bank_name' => 'Emirates NBD',
                    'front_image' => UploadedFile::fake()->image('front.jpg'),
                    'back_image' => UploadedFile::fake()->image('back.jpg'),
                ]],
            ]))
            ->assertRedirect(route('properties.index'));

        $property = Property::where('code', 'HFM-SNP-01')->sole();
        $lease = $property->headLeases()->sole();
        $cheque = $lease->cheques()->where('purpose', 'rent')->where('sequence', 1)->sole();

        expect($cheque->cheque_number)->toBe('000123')
            ->and($cheque->bank_name)->toBe('Emirates NBD')
            ->and($cheque->status)->toBe('issued')
            ->and($lease->cheques()->where('purpose', 'rent')->where('status', 'pending')->count())->toBe(7);

        Storage::disk('local')->assertExists([$cheque->front_image_path, $cheque->back_image_path]);

        $this->actingAs($this->superAdmin)
            ->get(route('properties.edit', $property))
            ->assertInertia(fn (Assert $page) => $page
                ->has('property.lease.cheques', 8)
                ->where('property.lease.cheques.0.key', 'rent:1')
                ->where('property.lease.cheques.0.cheque_number', '000123')
                ->where('property.lease.hasLockedCheques', false)
            );
    });

    test('splits the rent into a number of cheques a year that does not divide twelve months', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput(['lease_end_date' => '2026-12-31', 'annual_rent' => 250000, 'payments_per_year' => 5]))
            ->assertRedirect(route('properties.index'));

        $rent = Property::where('code', 'HFM-SNP-01')->sole()->headLeases()->sole()->cheques()->where('purpose', 'rent')->orderBy('sequence')->get();

        expect($rent->map(fn (Cheque $cheque) => [$cheque->period_start->toDateString(), $cheque->period_end->toDateString()])->all())->toBe([
            ['2026-01-01', '2026-02-28'],
            ['2026-03-01', '2026-04-30'],
            ['2026-05-01', '2026-07-31'],
            ['2026-08-01', '2026-09-30'],
            ['2026-10-01', '2026-12-31'],
        ])->and($rent->map(fn (Cheque $cheque) => (float) $cheque->amount)->unique()->values()->all())->toBe([50000.0]);
    });

    test('rejects invalid input', function (array $overrides, string $field) {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput($overrides))
            ->assertSessionHasErrors($field);

        $this->assertDatabaseMissing('properties', ['name' => 'Sonapur Labour Camp']);
    })->with([
        'missing name' => [['name' => ''], 'name'],
        'code taken in the company' => [['code' => 'HFM-AQZ-01'], 'code'],
        'lease ends before it starts' => [['lease_end_date' => '2025-12-31'], 'lease_end_date'],
        'leased without a landlord' => [['landlord_id' => null], 'landlord_id'],
        'new landlord without a name' => [['landlord_mode' => 'new', 'new_landlord' => ['landlord_type' => 'company', 'name' => '']], 'new_landlord.name'],
        'new landlord of an unknown type' => [['landlord_mode' => 'new', 'new_landlord' => ['landlord_type' => 'trust', 'name' => 'Saeed']], 'new_landlord.landlord_type'],
        'short Makani number' => [['makani_number' => '123'], 'makani_number'],
        'overlapping unit batches' => [['units' => ['shops' => [['count' => 3, 'first_number' => 'S-01'], ['count' => 1, 'first_number' => 'S-03']]]], 'units.shops.1.first_number'],
        'unit number without a digit' => [['units' => ['shops' => [['count' => 1, 'first_number' => 'Kiosk']]]], 'units.shops.0.first_number'],
        'apartment batch without bedrooms' => [['units' => ['apartments' => [['count' => 1, 'first_number' => 'A-1', 'bathrooms' => 1]]]], 'units.apartments.0.bedrooms'],
        'document without a file' => [['documents' => [['document_type' => 'insurance_policy']]], 'documents.0.file'],
        'leased without an annual rent' => [['annual_rent' => null], 'annual_rent'],
        'more than twelve cheques a year' => [['payments_per_year' => 13], 'payments_per_year'],
        'missing the required documents' => [['documents' => []], 'documents'],
        'more units than the property holds' => [['total_units' => 2, 'units' => ['shops' => [['count' => 3, 'first_number' => 'S-01']]]], 'total_units'],
        'batch larger than any property' => [['units' => ['shops' => [['count' => 10001, 'first_number' => 'S-01']]]], 'units.shops.0.count'],
    ]);

    test('shows the edit form filled with the property and its documents', function () {
        $property = Property::where('code', 'HFM-JBA-01')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('properties.edit', $property))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Properties/Form')
                ->where('property.name', 'Jebel Ali Staff Residence')
                ->where('property.lease_end_date', '2028-12-31')
                ->where('property.landlord_id', Landlord::where('name', 'Al Marsa Properties L.L.C.')->value('id'))
                ->has('property.documents', 3)
                ->has('banks')
            );
    });

    test('updates a property, keeping listed documents and removing the rest', function () {
        $property = Property::where('code', 'HFM-JBA-01')->sole();
        $documents = $property->documents()->orderBy('id')->get();

        $this->actingAs($this->superAdmin)
            ->put(route('properties.update', $property), validPropertyInput([
                'name' => 'Jebel Ali Residence',
                'code' => 'HFM-JBA-01',
                'documents' => [[
                    'id' => $documents[0]->id,
                    'document_type' => $documents[0]->document_type,
                    'title' => 'Renewed Ejari',
                ], ...requiredPropertyDocuments()],
            ]))
            ->assertRedirect(route('properties.index'));

        expect($property->refresh()->name)->toBe('Jebel Ali Residence');
        expect($documents[0]->refresh()->title)->toBe('Renewed Ejari')
            ->and($documents[0]->file_url)->not->toBeEmpty();
        $this->assertSoftDeleted($documents[1]);
        $this->assertSoftDeleted($documents[2]);
    });

    test('hides other companies\' properties', function () {
        $otherProperty = Property::factory()->create();

        $this->actingAs($this->superAdmin)
            ->get(route('properties.edit', $otherProperty))
            ->assertNotFound();

        $this->actingAs($this->superAdmin)
            ->put(route('properties.update', $otherProperty), validPropertyInput())
            ->assertNotFound();
    });
});
