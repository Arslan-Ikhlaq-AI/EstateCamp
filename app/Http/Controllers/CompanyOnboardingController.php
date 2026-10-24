<?php

namespace App\Http\Controllers;

use App\Http\Requests\CompanyOnboardingRequest;
use App\Mail\AccountCredentials;
use App\Mail\WorkspaceReady;
use App\Models\Company;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Signing a new company up from the marketing site: its details, its
 * workspace and its first users, starting with the super admin. Every user
 * gets a generated password by email, and the company gets a summary of
 * the workspace it now has.
 */
class CompanyOnboardingController extends Controller
{
    /**
     * Length of the passwords generated for new users.
     */
    private const PASSWORD_LENGTH = 14;

    /**
     * Show the sign-up steps, or what was set up once they are done.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Onboarding/Start', [
            'completed' => $request->session()->get('onboarding'),
            'businessTypes' => collect(Company::BUSINESS_TYPES)->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])->values(),
            'roles' => collect(UserRole::BUILT_IN)->map(fn (array $role, string $value) => ['value' => $value, ...$role])->values(),
            'currencies' => CompanyProfileController::CURRENCIES,
            'timezones' => CompanyProfileController::TIMEZONES,
            'maxTeam' => CompanyOnboardingRequest::MAX_TEAM,
            'workspaceBase' => url('w'),
        ]);
    }

    /**
     * Create the company and its users, then email each of them.
     */
    public function store(CompanyOnboardingRequest $request): RedirectResponse
    {
        $details = $request->validated();

        [$company, $accounts] = DB::transaction(function () use ($details) {
            $company = Company::create([
                ...collect($details)->only([
                    'name', 'legal_name', 'slug', 'business_type', 'trade_license_number', 'expiry_date', 'tax_registration_number',
                    'email', 'phone', 'website', 'country_code', 'city', 'address_line_1', 'default_currency', 'timezone',
                ])->all(),
                'status' => 'active',
                // The super admin is who the platform talks to about the account.
                'contact_person_name' => $details['admin_name'],
                'contact_person_email' => $details['admin_email'],
                'contact_person_phone' => $details['admin_phone'] ?? null,
            ]);

            $people = [
                ['name' => $details['admin_name'], 'email' => $details['admin_email'], 'role' => UserRole::SUPER_ADMIN],
                ...($details['team'] ?? []),
            ];

            $accounts = array_map(fn (array $person) => $this->createAccount($company, $person), $people);

            return [$company, $accounts];
        });

        Mail::to($company->email)->queue(new WorkspaceReady($company));

        foreach ($accounts as ['user' => $user, 'password' => $password]) {
            Mail::to($user)->queue(new AccountCredentials($user, $password));
        }

        return to_route('onboarding.create')->with('onboarding', [
            'company' => $company->name,
            'workspaceUrl' => $company->workspaceUrl(),
            'companyEmail' => $company->email,
            'users' => array_map(fn (array $account) => [
                'name' => $account['user']->name,
                'email' => $account['user']->email,
                'role' => $account['user']->role->name,
            ], $accounts),
        ]);
    }

    /**
     * A user of the company with `$person`'s role and a generated password.
     * They read it in their email, which also shows the address is theirs.
     * None of them is a platform admin: that flag opens every company's data.
     *
     * @param  array{name: string, email: string, role: string}  $person
     * @return array{user: User, password: string}
     */
    private function createAccount(Company $company, array $person): array
    {
        $password = Str::password(self::PASSWORD_LENGTH, symbols: false);

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

        return ['user' => $user, 'password' => $password];
    }
}
