<?php

namespace App\Http\Requests;

use App\Models\Company;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Signing a new company up: who it is, its workspace, and the people who
 * will use it, starting with the super admin. The form validates one step
 * at a time through Precognition, so each step's rules are checked before
 * the next one opens.
 */
class CompanyOnboardingRequest extends FormRequest
{
    /**
     * The most teammates that can be added while signing up; more can be added later.
     */
    public const MAX_TEAM = 10;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Codes are stored in capitals, addresses and the workspace in lower case,
     * and a website typed without its scheme is taken to be https.
     */
    protected function prepareForValidation(): void
    {
        $text = fn (string $key): ?string => filled($this->input($key)) ? trim((string) $this->input($key)) : null;
        $website = $text('website');
        $team = is_array($this->input('team')) ? $this->input('team') : [];

        $this->merge([
            'slug' => Str::lower((string) $text('slug')),
            'email' => Str::lower((string) $text('email')),
            'admin_email' => Str::lower((string) $text('admin_email')),
            'country_code' => strtoupper((string) $text('country_code')),
            'default_currency' => strtoupper((string) $text('default_currency')),
            'website' => $website && ! Str::startsWith(Str::lower($website), ['http://', 'https://']) ? "https://{$website}" : $website,
            'team' => array_map(fn ($member) => is_array($member) ? [...$member, 'email' => Str::lower(trim((string) ($member['email'] ?? '')))] : $member, $team),
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // The company.
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'trade_license_number' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date'],
            'tax_registration_number' => ['nullable', 'digits:15', Rule::unique(Company::class)->withoutTrashed()],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:40', 'regex:/^\+?[0-9\s\-().]{6,}$/'],
            'website' => ['nullable', 'url', 'max:2048'],
            'country_code' => ['required', 'string', 'size:2', 'alpha'],
            'city' => ['nullable', 'string', 'max:100'],
            'address_line_1' => ['nullable', 'string', 'max:255'],

            // Its workspace. Removed companies keep their address, so old links never open another company.
            'business_type' => ['required', Rule::in(array_keys(Company::BUSINESS_TYPES))],
            'slug' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::notIn(Company::RESERVED_SLUGS), Rule::unique(Company::class)],
            'default_currency' => ['required', 'string', 'size:3', 'alpha'],
            'timezone' => ['required', 'timezone:all'],

            // The super admin, then everyone else.
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', Rule::unique(User::class, 'email')],
            'admin_phone' => ['nullable', 'string', 'max:40', 'regex:/^\+?[0-9\s\-().]{6,}$/'],
            'team' => ['array', 'max:'.self::MAX_TEAM],
            'team.*.name' => ['required', 'string', 'max:255'],
            'team.*.email' => ['required', 'email', 'max:255', 'distinct:ignore_case', 'different:admin_email', Rule::unique(User::class, 'email')],
            'team.*.role' => ['required', Rule::in(array_keys(UserRole::BUILT_IN))],

            'terms' => ['accepted'],
            // Left empty by people; bots that fill every field are turned away.
            'fax' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slug.regex' => 'Use lower-case letters, numbers and single hyphens, such as horizon-fm.',
            'slug.unique' => 'This workspace address is already taken. Try another one.',
            'slug.not_in' => 'This workspace address is reserved. Try another one.',
            'phone.regex' => 'Enter a phone number with digits only, such as +971 4 321 7788.',
            'admin_phone.regex' => 'Enter a phone number with digits only, such as +971 50 123 4567.',
            'tax_registration_number.unique' => 'A company with this TRN is already registered.',
            'admin_email.unique' => 'This email already has an EstateCamp account.',
            'team.*.email.unique' => 'This email already has an EstateCamp account.',
            'team.*.email.distinct' => 'This email is used for more than one person.',
            'team.*.email.different' => 'This is the super admin’s email. Use a different one.',
            'team.max' => 'You can add up to :max teammates now, and more once your workspace is live.',
            'terms.accepted' => 'Please accept the terms to launch your workspace.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'company name',
            'email' => 'company email',
            'phone' => 'company phone',
            'expiry_date' => 'licence expiry date',
            'tax_registration_number' => 'tax registration number (TRN)',
            'country_code' => 'country',
            'business_type' => 'business type',
            'slug' => 'workspace address',
            'default_currency' => 'currency',
            'timezone' => 'time zone',
            'admin_name' => 'full name',
            'admin_email' => 'work email',
            'admin_phone' => 'mobile number',
            'team.*.name' => 'name',
            'team.*.email' => 'email',
            'team.*.role' => 'role',
        ];
    }
}
