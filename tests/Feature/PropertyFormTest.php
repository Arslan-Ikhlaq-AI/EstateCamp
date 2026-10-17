<?php

use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\PropertyType;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

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
        'landlord_name' => 'Al Marsa Properties L.L.C.',
        'lease_start_date' => '2026-01-01',
        'lease_end_date' => '2027-12-31',
        'documents' => [],
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
            );
    });

    test('adds a property with its cover and documents', function () {
        Storage::fake('public');

        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput([
                'cover_image' => UploadedFile::fake()->image('cover.jpg'),
                'documents' => [[
                    'document_type' => 'tenancy_contract',
                    'title' => 'Ejari',
                    'file' => UploadedFile::fake()->create('ejari.pdf', 200, 'application/pdf'),
                    'issued_on' => '2026-01-01',
                    'expires_on' => '2027-12-31',
                ]],
            ]))
            ->assertRedirect(route('properties.index'))
            ->assertSessionHas('success', 'Sonapur Labour Camp was added.');

        $property = Property::where('code', 'HFM-SNP-01')->sole();
        $document = $property->documents()->sole();

        expect($property->company_id)->toBe($this->superAdmin->company_id)
            ->and($property->country_code)->toBe('AE')
            ->and($property->landlord_name)->toBe('Al Marsa Properties L.L.C.');
        expect($document->title)->toBe('Ejari');
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $property->cover_image_url));
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $document->file_url));
    });

    test('drops landlord and lease details from owned properties', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('properties.store'), validPropertyInput(['ownership_type' => 'owned']))
            ->assertRedirect(route('properties.index'));

        $property = Property::where('code', 'HFM-SNP-01')->sole();

        expect($property->landlord_name)->toBeNull()
            ->and($property->lease_end_date)->toBeNull();
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
        'leased without a landlord' => [['landlord_name' => ''], 'landlord_name'],
        'short Makani number' => [['makani_number' => '123'], 'makani_number'],
        'document without a file' => [['documents' => [['document_type' => 'insurance_policy']]], 'documents.0.file'],
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
                ->has('property.documents', 3)
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
                ]],
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
