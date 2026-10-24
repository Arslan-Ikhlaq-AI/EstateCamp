<?php

use App\Models\Company;
use App\Models\PropertyType;
use App\Models\RoomType;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(PortfolioSeeder::class);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->member = User::factory()->create(['company_id' => $this->admin->company_id, 'is_admin' => false]);
    $this->company = Company::findOrFail($this->admin->company_id);
});

/**
 * @return array<string, mixed>
 */
function companyProfileInput(array $overrides = []): array
{
    return [
        'name' => 'Horizon Facilities Management',
        'legal_name' => 'Horizon Facilities Management L.L.C.',
        'short_name' => 'Horizon FM',
        'tax_registration_number' => '100234567800003',
        'email' => 'hello@horizonfm.test',
        'website' => 'https://horizonfm.test',
        'city' => 'Dubai',
        'country_code' => 'ae',
        'default_currency' => 'aed',
        'timezone' => 'Asia/Dubai',
        ...$overrides,
    ];
}

test('shows the company profile with its figures', function () {
    $this->actingAs($this->member)
        ->get(route('configuration.company'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/Company')
            ->where('company.name', $this->company->name)
            ->where('figures.properties', $this->company->properties()->count())
            ->has('currencies')
            ->has('timezones')
        );
});

test('saves the company profile and its logo, leaving the status alone', function () {
    Storage::fake('public');

    $this->actingAs($this->member)
        ->put(route('configuration.company.update'), companyProfileInput([
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
            'status' => 'suspended',
        ]))
        ->assertRedirect(route('configuration.company'))
        ->assertSessionHas('success');

    $this->company->refresh();

    expect($this->company->legal_name)->toBe('Horizon Facilities Management L.L.C.')
        ->and($this->company->country_code)->toBe('AE')
        ->and($this->company->default_currency)->toBe('AED')
        ->and($this->company->status)->toBe('active');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $this->company->logo_url));
});

test('removes the company logo', function () {
    $this->company->update(['logo_url' => '/storage/companies/logo.png']);

    $this->actingAs($this->member)
        ->put(route('configuration.company.update'), companyProfileInput(['remove_logo' => true]))
        ->assertSessionHasNoErrors();

    expect($this->company->refresh()->logo_url)->toBeNull();
});

test('rejects an invalid company profile', function (array $overrides, string $field) {
    $this->actingAs($this->member)
        ->put(route('configuration.company.update'), companyProfileInput($overrides))
        ->assertSessionHasErrors($field);
})->with([
    'missing name' => [['name' => ''], 'name'],
    'a malformed tax number' => [['tax_registration_number' => 'VAT#1234!'], 'tax_registration_number'],
    'unknown time zone' => [['timezone' => 'Mars/Olympus'], 'timezone'],
    'three-letter country' => [['country_code' => 'ARE'], 'country_code'],
]);

test('lists the property types with how many of the company\'s properties use each', function () {
    $type = PropertyType::where('slug', 'worker_accommodation')->sole();

    $this->actingAs($this->member)
        ->get(route('configuration.property-types'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/Types')
            ->where('kind', 'property')
            ->where('canManage', false)
            ->where('types.0.slug', $type->slug)
            ->where('types.0.usage', $type->properties()->where('company_id', $this->company->id)->count())
            ->where('types.0.inUse', true)
        );
});

test('lets an admin add a type, with a slug from its name', function () {
    $this->actingAs($this->admin)
        ->post(route('configuration.room-types.store'), ['name' => 'Family Suite', 'description' => 'Two rooms and a kitchenette', 'is_active' => true])
        ->assertSessionHasNoErrors();

    $type = RoomType::where('name', 'Family Suite')->sole();

    expect($type->slug)->toBe('family_suite')
        ->and($type->sort_order)->toBe((int) RoomType::max('sort_order'));
});

test('keeps a type\'s slug when an admin renames it', function () {
    $type = PropertyType::where('slug', 'staff_accommodation')->sole();

    $this->actingAs($this->admin)
        ->put(route('configuration.property-types.update', $type), ['name' => 'Staff housing', 'sort_order' => 5, 'is_active' => false])
        ->assertSessionHasNoErrors();

    $type->refresh();

    expect($type->name)->toBe('Staff housing')
        ->and($type->slug)->toBe('staff_accommodation')
        ->and($type->is_active)->toBeFalse();
});

test('refuses to delete a type in use, and deletes one that is not', function () {
    $used = PropertyType::where('slug', 'worker_accommodation')->sole();
    $unused = PropertyType::create(['name' => 'Warehouse', 'slug' => 'warehouse', 'sort_order' => 9]);

    $this->actingAs($this->admin)
        ->delete(route('configuration.property-types.destroy', $used))
        ->assertSessionHasErrors('type');

    $this->actingAs($this->admin)
        ->delete(route('configuration.property-types.destroy', $unused))
        ->assertSessionHasNoErrors();

    expect(PropertyType::whereKey($used->id)->exists())->toBeTrue()
        ->and(PropertyType::whereKey($unused->id)->exists())->toBeFalse();
});

test('only admins can change the shared type lists', function () {
    $type = RoomType::firstOrFail();

    $this->actingAs($this->member)->post(route('configuration.room-types.store'), ['name' => 'Cabin'])->assertForbidden();
    $this->actingAs($this->member)->put(route('configuration.room-types.update', $type), ['name' => 'Renamed'])->assertForbidden();
    $this->actingAs($this->member)->delete(route('configuration.room-types.destroy', $type))->assertForbidden();
});

test('users without a company cannot open the company profile', function () {
    $this->actingAs(User::factory()->create(['company_id' => null]))
        ->get(route('configuration.company'))
        ->assertForbidden();
});
