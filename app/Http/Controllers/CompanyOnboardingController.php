<?php

namespace App\Http\Controllers;

use App\Http\Requests\CompanyOnboardingRequest;
use App\Mail\AccountCredentials;
use App\Mail\WorkspaceReady;
use App\Models\Company;
use App\Models\User;
use App\Models\UserRole;
use DateTimeZone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use NumberFormatter;

/**
 * Signing a new company up from the marketing site: its details, its
 * workspace and its first users, starting with the super admin. Each user
 * signs in with the password set on the form, or a generated one when a
 * teammate was left without; everyone gets their sign-in by email, and the
 * company gets a summary of the workspace it now has.
 */
class CompanyOnboardingController extends Controller
{
    /**
     * Length of the passwords generated for teammates left without one.
     */
    private const PASSWORD_LENGTH = 14;

    /**
     * The time zone suggested first for countries that span several, where
     * the alphabetical first (America/Adak for the United States) would be
     * a poor guess. Countries with one zone need no entry.
     *
     * @var array<string, string>
     */
    private const MAIN_TIMEZONES = [
        'AU' => 'Australia/Sydney',
        'BR' => 'America/Sao_Paulo',
        'CA' => 'America/Toronto',
        'CL' => 'America/Santiago',
        'CY' => 'Asia/Nicosia',
        'ES' => 'Europe/Madrid',
        'FM' => 'Pacific/Pohnpei',
        'GL' => 'America/Nuuk',
        'KI' => 'Pacific/Tarawa',
        'MH' => 'Pacific/Majuro',
        'MN' => 'Asia/Ulaanbaatar',
        'MX' => 'America/Mexico_City',
        'PF' => 'Pacific/Tahiti',
        'PG' => 'Pacific/Port_Moresby',
        'PT' => 'Europe/Lisbon',
        'RU' => 'Europe/Moscow',
        'US' => 'America/New_York',
        'UZ' => 'Asia/Tashkent',
    ];

    /**
     * Show the sign-up steps, or what was set up once they are done.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Onboarding/Start', [
            'completed' => $request->session()->get('onboarding'),
            'businessTypes' => collect(Company::BUSINESS_TYPES)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
            'roles' => collect(UserRole::BUILT_IN)->map(fn (array $role, string $value) => ['value' => $value, ...$role])->values(),
            ...$this->regions(),
            'maxTeam' => CompanyOnboardingRequest::MAX_TEAM,
            'termsVersion' => Company::TERMS_VERSION,
            'workspaceBase' => url('w'),
        ]);
    }

    /**
     * Every country, with its time zones (the main one first) and its
     * currency where PHP's intl extension knows it, plus every currency and
     * time zone to choose from. Country names are left to the browser.
     *
     * @return array{countries: list<array{code: string, currency: ?string, timezones: list<string>}>, currencies: list<string>, timezones: list<string>}
     */
    private function regions(): array
    {
        return Cache::remember('onboarding.regions', now()->addDay(), function (): array {
            $zonesByCountry = [];

            foreach (DateTimeZone::listIdentifiers() as $zone) {
                $code = (new DateTimeZone($zone))->getLocation()['country_code'] ?? null;

                // Antarctica's research stations do not sign up; "??" marks zones with no country.
                if (is_string($code) && preg_match('/^[A-Z]{2}$/', $code) && $code !== 'AQ') {
                    $zonesByCountry[$code][] = $zone;
                }
            }

            ksort($zonesByCountry);

            $countries = collect($zonesByCountry)->map(fn (array $zones, string $code): array => [
                'code' => $code,
                'currency' => $this->currencyOf($code),
                'timezones' => array_values(array_unique([...array_intersect([self::MAIN_TIMEZONES[$code] ?? null], $zones), ...$zones])),
            ])->values();

            return [
                'countries' => $countries->all(),
                'currencies' => $countries->pluck('currency')->filter()->merge(CompanyProfileController::CURRENCIES)->unique()->sort()->values()->all(),
                'timezones' => DateTimeZone::listIdentifiers(),
            ];
        });
    }

    /**
     * The currency used in a country, or null when the intl extension is
     * missing or the country has none of its own.
     */
    private function currencyOf(string $countryCode): ?string
    {
        if (! class_exists(NumberFormatter::class)) {
            return null;
        }

        $currency = (new NumberFormatter("en_{$countryCode}", NumberFormatter::CURRENCY))->getTextAttribute(NumberFormatter::CURRENCY_CODE);

        return preg_match('/^[A-Z]{3}$/', (string) $currency) && $currency !== 'XXX' ? $currency : null;
    }

    /**
     * Create the company and its users, then email each of them.
     */
    public function store(CompanyOnboardingRequest $request): RedirectResponse
    {
        $details = $request->validated();

        [$company, $accounts] = DB::transaction(function () use ($details, $request) {
            $company = Company::create([
                ...collect($details)->only([
                    'name', 'legal_name', 'slug', 'business_type', 'trade_license_number', 'expiry_date', 'tax_registration_number',
                    'email', 'phone', 'website', 'country_code', 'city', 'address_line_1', 'default_currency', 'timezone',
                ])->all(),
                'status' => 'active',
                // The record of who accepted which Terms of Service, and when.
                'terms_version' => Company::TERMS_VERSION,
                'terms_accepted_at' => now(),
                'terms_accepted_ip' => $request->ip(),
                // The super admin is who the platform talks to about the account.
                'contact_person_name' => $details['admin_name'],
                'contact_person_email' => $details['admin_email'],
                'contact_person_phone' => $details['admin_phone'] ?? null,
            ]);

            // Stored where the company profile keeps it, which needs the company's id first.
            $company->update(['logo_url' => '/storage/'.$request->file('logo')->store("companies/{$company->id}", 'public')]);

            $people = [
                ['name' => $details['admin_name'], 'email' => $details['admin_email'], 'role' => UserRole::SUPER_ADMIN, 'password' => $details['admin_password']],
                ...($details['team'] ?? []),
            ];

            $accounts = array_map(fn (array $person) => $this->createAccount($company, $person), $people);

            return [$company, $accounts];
        });

        Mail::to($company->email)->queue(new WorkspaceReady($company));

        foreach ($accounts as ['user' => $user, 'password' => $password, 'isGenerated' => $isGenerated]) {
            Mail::to($user)->queue(new AccountCredentials($user, $password, $isGenerated));
        }

        return to_route('onboarding.create')->with('onboarding', [
            'company' => $company->name,
            'logoUrl' => $company->logo_url,
            'workspaceUrl' => $company->workspaceUrl(),
            'companyEmail' => $company->email,
            'users' => array_map(fn (array $account) => [
                'name' => $account['user']->name,
                'email' => $account['user']->email,
                'role' => $account['user']->role->name,
                'isGenerated' => $account['isGenerated'],
            ], $accounts),
        ]);
    }

    /**
     * A user of the company with `$person`'s role, signing in with the
     * password chosen for them or, when none was, a generated one. None of
     * them is a platform admin: that flag opens every company's data.
     *
     * @param  array{name: string, email: string, role: string, password?: ?string}  $person
     * @return array{user: User, password: string, isGenerated: bool}
     */
    private function createAccount(Company $company, array $person): array
    {
        $isGenerated = blank($person['password'] ?? null);
        $password = $isGenerated ? Str::password(self::PASSWORD_LENGTH, symbols: false) : $person['password'];

        $user = new User;
        $user->forceFill([
            'name' => $person['name'],
            'email' => $person['email'],
            'password' => $password,
            'company_id' => $company->id,
            'user_role_id' => UserRole::builtIn($person['role'])->id,
            'is_admin' => false,
            'email_verified_at' => now(),
        ])->save();

        return ['user' => $user, 'password' => $password, 'isGenerated' => $isGenerated];
    }
}
