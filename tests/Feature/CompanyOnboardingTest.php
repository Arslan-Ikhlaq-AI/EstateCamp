<?php

use App\Http\Requests\CompanyOnboardingRequest;
use App\Mail\AccountCredentials;
use App\Mail\WorkspaceReady;
use App\Models\Company;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A complete sign-up: the company, its workspace, a super admin and two teammates.
 *
 * @return array<string, mixed>
 */
function onboardingInput(array $overrides = []): array
{
    return [
        'name' => 'Atlas Living',
        'logo' => UploadedFile::fake()->image('atlas-logo.png', 256, 256),
        'legal_name' => 'Atlas Living Accommodation L.L.C.',
        'trade_license_number' => 'CN-7788123',
        'expiry_date' => '2027-06-30',
        'tax_registration_number' => '100555666700003',
        'email' => 'Hello@AtlasLiving.test',
        'phone' => '+971 4 555 0101',
        'website' => 'atlasliving.test',
        'country_code' => 'ae',
        'city' => 'Dubai',
        'address_line_1' => 'Office 801, Marina Plaza',
        'business_type' => 'staff_accommodation',
        'slug' => 'atlas-living',
        'default_currency' => 'aed',
        'timezone' => 'Asia/Dubai',
        'admin_name' => 'Layla Haddad',
        'admin_email' => 'layla@atlasliving.test',
        'admin_phone' => '+971 50 555 0102',
        'admin_password' => 'Layla-Passw0rd',
        'admin_password_confirmation' => 'Layla-Passw0rd',
        'team' => [
            ['name' => 'Ravi Menon', 'email' => 'ravi@atlasliving.test', 'role' => UserRole::MANAGER, 'password' => 'Ravi-Passw0rd'],
            // Left without a password, so one is generated.
            ['name' => 'Aisha Karim', 'email' => 'Aisha@AtlasLiving.test', 'role' => UserRole::ACCOUNTANT, 'password' => ''],
        ],
        'terms' => true,
        'terms_version' => Company::TERMS_VERSION,
        ...$overrides,
    ];
}

/**
 * One teammate for the sign-up's team.
 *
 * @return array{name: string, email: string, role: string}
 */
function teammate(array $overrides = []): array
{
    return ['name' => 'Ravi Menon', 'email' => 'ravi@atlasliving.test', 'role' => UserRole::MANAGER, ...$overrides];
}

test('shows the sign-up steps with the roles and kinds of business on offer', function () {
    $this->get(route('onboarding.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Onboarding/Start')
            ->where('completed', null)
            ->has('roles', count(UserRole::BUILT_IN))
            ->where('roles.0.value', UserRole::SUPER_ADMIN)
            ->has('businessTypes', count(Company::BUSINESS_TYPES))
            ->where('maxTeam', CompanyOnboardingRequest::MAX_TEAM)
            ->where('termsVersion', Company::TERMS_VERSION)
            // Every country is offered, each with its currency and its main time zone first.
            ->where('countries', function ($countries) {
                $unitedStates = collect($countries)->firstWhere('code', 'US');

                return count($countries) > 200 && $unitedStates['currency'] === 'USD' && $unitedStates['timezones'][0] === 'America/New_York';
            })
            ->where('timezones', fn ($timezones) => collect($timezones)->contains('Pacific/Auckland'))
        );
});

test('sets up a company from any country, with its own tax number format', function () {
    Mail::fake();
    Storage::fake('public');

    $this->post(route('onboarding.store'), onboardingInput([
        'country_code' => 'us',
        'city' => 'Austin',
        'default_currency' => 'usd',
        'timezone' => 'America/Chicago',
        'phone' => '+1 512 555 0143',
        'tax_registration_number' => '12-3456789',
    ]))->assertSessionHasNoErrors();

    expect(Company::where('slug', 'atlas-living')->sole()->only(['country_code', 'default_currency', 'timezone', 'tax_registration_number']))->toBe([
        'country_code' => 'US',
        'default_currency' => 'USD',
        'timezone' => 'America/Chicago',
        'tax_registration_number' => '12-3456789',
    ]);
});

test('publishes the Terms of Service a company accepts', function () {
    $this->get(route('terms'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Legal/Terms')->where('version', Company::TERMS_VERSION));
});

test('sets up the company with its logo, super admin and teammates, and emails each of them', function () {
    Mail::fake();
    Storage::fake('public');

    $this->post(route('onboarding.store'), onboardingInput())
        ->assertRedirect(route('onboarding.create'))
        ->assertSessionHas('onboarding.workspaceUrl', route('workspace', 'atlas-living'));

    $company = Company::where('slug', 'atlas-living')->sole();

    expect($company->only(['business_type', 'email', 'website', 'country_code', 'default_currency', 'status', 'contact_person_name', 'contact_person_email']))->toBe([
        'business_type' => 'staff_accommodation',
        'email' => 'hello@atlasliving.test',
        'website' => 'https://atlasliving.test',
        'country_code' => 'AE',
        'default_currency' => 'AED',
        'status' => 'active',
        'contact_person_name' => 'Layla Haddad',
        'contact_person_email' => 'layla@atlasliving.test',
    ])->and($company->expiry_date->toDateString())->toBe('2027-06-30')
        ->and($company->logo_url)->toStartWith("/storage/companies/{$company->id}/")
        ->and($company->terms_version)->toBe(Company::TERMS_VERSION)
        ->and($company->terms_accepted_at)->not->toBeNull()
        ->and($company->terms_accepted_ip)->toBe('127.0.0.1');

    Storage::disk('public')->assertExists(Str::after($company->logo_url, '/storage/'));

    $users = $company->users()->with('role')->orderBy('id')->get();

    // Nobody signing up becomes a platform admin, which would open every company's data.
    expect($users->map(fn (User $user) => [$user->email, $user->role->slug, $user->is_admin])->all())->toBe([
        ['layla@atlasliving.test', UserRole::SUPER_ADMIN, false],
        ['ravi@atlasliving.test', UserRole::MANAGER, false],
        ['aisha@atlasliving.test', UserRole::ACCOUNTANT, false],
    ]);

    Mail::assertQueuedCount(4);
    Mail::assertQueued(WorkspaceReady::class, fn (WorkspaceReady $mail) => $mail->hasTo('hello@atlasliving.test') && $mail->company->is($company));

    $credentials = fn (string $email) => Mail::queued(AccountCredentials::class, fn (AccountCredentials $mail) => $mail->hasTo($email))->sole();

    // The passwords set on the form are the ones saved and emailed; the one left blank was generated.
    expect($credentials('layla@atlasliving.test'))->password->toBe('Layla-Passw0rd')->isGenerated->toBeFalse()
        ->and($credentials('ravi@atlasliving.test'))->password->toBe('Ravi-Passw0rd')->isGenerated->toBeFalse()
        ->and($credentials('aisha@atlasliving.test'))->isGenerated->toBeTrue()
        ->and(strlen($credentials('aisha@atlasliving.test')->password))->toBe(14);

    $users->each(fn (User $user) => expect(Hash::check($credentials($user->email)->password, $user->password))->toBeTrue());

    $this->post('/login', ['email' => 'layla@atlasliving.test', 'password' => 'Layla-Passw0rd']);
    $this->assertAuthenticatedAs($users->first());
});

test('turns away a sign-up that cannot be set up, creating nothing', function (array $overrides, string $field) {
    Mail::fake();
    Storage::fake('public');
    Company::factory()->create(['slug' => 'taken-name', 'tax_registration_number' => '100999888700003']);
    User::factory()->create(['email' => 'existing@atlasliving.test']);

    // Nothing typed is flashed back, so no password is stored in the session.
    $this->post(route('onboarding.store'), onboardingInput($overrides))
        ->assertSessionHasErrors($field)
        ->assertSessionMissing('_old_input');

    expect(Company::count())->toBe(1)
        ->and(User::count())->toBe(1)
        ->and(Storage::disk('public')->allFiles())->toBe([]);
    Mail::assertNothingQueued();
})->with([
    'no logo' => [['logo' => null], 'logo'],
    'a PDF instead of a logo' => [fn () => ['logo' => UploadedFile::fake()->create('logo.pdf', 100, 'application/pdf')], 'logo'],
    'an SVG logo, which could carry script' => [fn () => ['logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml')], 'logo'],
    'a logo over 2 MB' => [fn () => ['logo' => UploadedFile::fake()->image('logo.png', 512, 512)->size(2049)], 'logo'],
    'a logo under 64 pixels' => [fn () => ['logo' => UploadedFile::fake()->image('logo.png', 48, 48)], 'logo'],
    'a workspace address in use' => [['slug' => 'Taken-Name'], 'slug'],
    'a reserved workspace address' => [['slug' => 'admin'], 'slug'],
    'a workspace address with spaces' => [['slug' => 'atlas living'], 'slug'],
    'a tax number already registered' => [['tax_registration_number' => '100999888700003'], 'tax_registration_number'],
    'a malformed tax number' => [['tax_registration_number' => 'VAT#1234!'], 'tax_registration_number'],
    'a super admin who already has an account' => [['admin_email' => 'Existing@AtlasLiving.test'], 'admin_email'],
    'a teammate who already has an account' => [['team' => [teammate(['email' => 'existing@atlasliving.test'])]], 'team.0.email'],
    'a teammate with the super admin’s email' => [['team' => [teammate(['email' => 'layla@atlasliving.test'])]], 'team.0.email'],
    'two teammates with one email' => [['team' => [teammate(), teammate(['email' => 'RAVI@atlasliving.test'])]], 'team.1.email'],
    'a role that is not offered' => [['team' => [teammate(['role' => 'owner'])]], 'team.0.role'],
    'no password for the super admin' => [['admin_password' => '', 'admin_password_confirmation' => ''], 'admin_password'],
    'a super admin password that is too short' => [['admin_password' => 'short', 'admin_password_confirmation' => 'short'], 'admin_password'],
    'passwords that do not match' => [['admin_password_confirmation' => 'Another-Passw0rd'], 'admin_password_confirmation'],
    'a teammate password that is too short' => [['team' => [teammate(['password' => 'short'])]], 'team.0.password'],
    'more teammates than allowed' => [['team' => array_map(fn (int $number) => teammate(['email' => "member{$number}@atlasliving.test"]), range(1, CompanyOnboardingRequest::MAX_TEAM + 1))], 'team'],
    'the terms not accepted' => [['terms' => false], 'terms'],
    'terms older than the ones in force' => [['terms_version' => '2020-01-01'], 'terms_version'],
    'the hidden field filled in' => [['fax' => '+971 4 000 0000'], 'fax'],
]);

test('checks one step at a time without setting anything up', function () {
    Company::factory()->create(['slug' => 'taken-name']);
    User::factory()->create(['email' => 'existing@atlasliving.test']);

    $this->withHeaders(['Precognition' => 'true', 'Precognition-Validate-Only' => 'business_type,slug'])
        ->post(route('onboarding.store'), ['business_type' => 'real_estate', 'slug' => 'atlas-living'])
        ->assertSuccessfulPrecognition();

    // Only the fields asked about are checked: the teammate's missing name is not reported.
    $this->withHeaders(['Precognition' => 'true', 'Precognition-Validate-Only' => 'slug,team.*.email'])
        ->postJson(route('onboarding.store'), ['slug' => 'taken-name', 'team' => [['email' => 'existing@atlasliving.test']]])
        ->assertUnprocessable()
        ->assertOnlyJsonValidationErrors(['slug', 'team.0.email']);

    expect(Company::count())->toBe(1);
});

test('limits how many sign-ups one visitor can send in an hour', function () {
    foreach (range(1, 10) as $attempt) {
        $this->post(route('onboarding.store'))->assertSessionHasErrors('name');
    }

    $this->post(route('onboarding.store'))->assertTooManyRequests();
});

test('opens the sign-in page under the company’s name from its workspace address', function () {
    Company::factory()->create(['name' => 'Atlas Living', 'slug' => 'atlas-living']);

    $this->get('/w/atlas-living')->assertRedirect(route('login', ['workspace' => 'atlas-living']));

    $this->get(route('login', ['workspace' => 'atlas-living']))
        ->assertInertia(fn (Assert $page) => $page->component('Auth/Login')->where('workspace.name', 'Atlas Living'));

    $this->get('/w/nobody-here')->assertNotFound();
});

test('emails a user their workspace, role and password, encrypted while it waits to be sent', function () {
    $company = Company::factory()->create([
        'name' => 'Atlas Living',
        'slug' => 'atlas-living',
        'logo_url' => '/storage/companies/1/atlas-logo.png',
        'terms_version' => Company::TERMS_VERSION,
        'terms_accepted_at' => now(),
    ]);
    $user = User::factory()->create(['company_id' => $company->id, 'user_role_id' => UserRole::builtIn(UserRole::MANAGER)->id]);

    $mail = new AccountCredentials($user, 'Tmp9xYz42QwErt', isGenerated: true);

    $mail->assertSeeInHtml('Tmp9xYz42QwErt')
        ->assertSeeInText('Tmp9xYz42QwErt')
        ->assertSeeInHtml('Temporary password')
        ->assertSeeInHtml(url('/storage/companies/1/atlas-logo.png'))
        ->assertSeeInHtml($company->workspaceUrl())
        ->assertSeeInHtml('Manager');

    expect($mail)->toBeInstanceOf(ShouldBeEncrypted::class);

    // A password chosen at sign-up is not called temporary.
    (new AccountCredentials($user, 'Ravi-Passw0rd', isGenerated: false))
        ->assertSeeInHtml('Ravi-Passw0rd')
        ->assertDontSeeInHtml('Temporary password');

    (new WorkspaceReady($company))
        ->assertSeeInHtml('Version '.Company::TERMS_VERSION)
        ->assertSeeInHtml($user->name)
        ->assertSeeInHtml('Manager')
        ->assertSeeInText($company->workspaceUrl());
});
