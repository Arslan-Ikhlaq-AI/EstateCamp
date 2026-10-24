<?php

namespace App\Http\Requests;

use App\Models\StaffMember;
use App\Models\StaffRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

/**
 * A staff member added or changed on their form: who they are, their role
 * and where they work, their identity documents and their salary. Someone
 * who resigned or was let go needs the day they left.
 *
 * With `can_sign_in` they get a sign-in that logs in with their email, with
 * the access chosen; a new sign-in needs a password, an existing one keeps
 * its password unless a new one is given.
 */
class StaffMemberRequest extends CompanyScopedRequest
{
    private const ALLOWANCES = ['housing_allowance', 'transport_allowance', 'other_allowance'];

    protected ?string $recordParameter = 'staffMember';

    /**
     * Allowances left empty are none; an IBAN is kept without spaces, in
     * capitals; the sign-in switches arrive as text from the form.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'can_sign_in' => $this->boolean('can_sign_in'),
            'app_access' => $this->boolean('app_access'),
            ...collect(self::ALLOWANCES)->mapWithKeys(fn (string $field) => [$field => $this->filled($field) ? $this->input($field) : 0])->all(),
            'iban' => $this->filled('iban') ? strtoupper(preg_replace('/\s+/', '', (string) $this->input('iban'))) : null,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $staff = $this->route('staffMember');
        $money = ['numeric', 'min:0', 'max:10000000'];
        $canSignIn = $this->boolean('can_sign_in');

        return [
            'full_name' => ['required', 'string', 'max:255'],
            'gender' => ['required', Rule::in(StaffMember::GENDERS)],
            'nationality' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date', 'after:1900-01-01', 'before:today'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => [
                'nullable',
                Rule::requiredIf($canSignIn),
                'email',
                'max:255',
                ...($canSignIn ? [Rule::unique('users', 'email')->ignore($staff?->user_id)] : []),
            ],

            'work_level' => ['required', Rule::in(StaffRole::LEVELS)],
            'staff_role_id' => ['required', 'integer', $this->offered(Rule::exists('staff_roles', 'id'), $staff?->staff_role_id)],
            'regional_office_id' => [
                'nullable',
                'required_if:work_level,regional',
                'integer',
                $this->offered(Rule::exists('regional_offices', 'id')->where('company_id', $this->companyId()), $staff?->regional_office_id),
            ],
            'property_id' => ['nullable', 'required_if:work_level,site', 'integer', $this->existsInCompany('properties')],
            'employment_type' => ['required', Rule::in(StaffMember::EMPLOYMENT_TYPES)],
            'joined_on' => ['required', 'date', 'after:1950-01-01'],
            'status' => ['required', Rule::in(StaffMember::STATUSES)],
            'left_on' => ['nullable', Rule::requiredIf(fn () => in_array($this->input('status'), StaffMember::LEFT_STATUSES, true)), 'date', 'after_or_equal:joined_on'],

            'emirates_id_number' => ['nullable', 'string', 'max:30'],
            'emirates_id_expiry' => ['nullable', 'date'],
            'passport_number' => ['nullable', 'string', 'max:30'],
            'passport_expiry' => ['nullable', 'date'],
            'visa_number' => ['nullable', 'string', 'max:30'],
            'visa_expiry' => ['nullable', 'date'],

            'basic_salary' => ['required', ...$money],
            ...collect(self::ALLOWANCES)->mapWithKeys(fn (string $field) => [$field => $money])->all(),
            'salary_payment_method' => ['nullable', Rule::in(StaffMember::PAYMENT_METHODS)],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'iban' => ['nullable', 'string', 'regex:/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/'],

            'can_sign_in' => ['boolean'],
            'access' => ['nullable', Rule::requiredIf($canSignIn), Rule::in(StaffMember::ACCESS_LEVELS)],
            'app_access' => ['boolean'],
            'password' => ['nullable', Rule::requiredIf($canSignIn && ! $staff?->user_id), Password::defaults()],

            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                // Only someone who uses the rest of the app may open it to a sign-in.
                if ($this->boolean('can_sign_in') && $this->boolean('app_access') && ! $this->route('staffMember')?->app_access && $this->user()->cannot('use-app')) {
                    $validator->errors()->add('app_access', 'Only someone who uses the rest of the app can give a sign-in access to it.');
                }
            },
        ];
    }

    /**
     * The staff member's own details, without where they work. Someone still
     * employed has no leaving day.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        $details = $this->safe()->except(['work_level', 'regional_office_id', 'property_id', 'can_sign_in', 'access', 'app_access', 'password']);

        if (! in_array($details['status'], StaffMember::LEFT_STATUSES, true)) {
            $details['left_on'] = null;
        }

        return $details;
    }

    /**
     * The sign-in, as StaffMember::syncSignIn() takes it.
     *
     * @return array{canSignIn: bool, access: ?string, appAccess: bool, password: ?string}
     */
    public function signIn(): array
    {
        $canSignIn = $this->boolean('can_sign_in');

        return [
            'canSignIn' => $canSignIn,
            'access' => $canSignIn ? $this->validated('access') : null,
            'appAccess' => $canSignIn && $this->boolean('app_access'),
            'password' => $this->validated('password'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'full_name' => 'name',
            'work_level' => 'where they work',
            'staff_role_id' => 'role',
            'regional_office_id' => 'regional office',
            'property_id' => 'camp or building',
            'joined_on' => 'joining date',
            'left_on' => 'leaving date',
            'emirates_id_expiry' => 'Emirates ID expiry',
            'passport_expiry' => 'passport expiry',
            'visa_expiry' => 'visa expiry',
            'basic_salary' => 'basic salary',
            'salary_payment_method' => 'payment method',
            'iban' => 'IBAN',
            'access' => 'access',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'iban.regex' => 'Enter a valid IBAN, such as AE07 0331 2345 6789 0123 456.',
            'left_on.required' => 'Enter the day they left.',
            'email.required' => 'Enter the email they will sign in with.',
            'email.unique' => 'Another account already signs in with this email.',
            'password.required' => 'Choose a password for their sign-in.',
        ];
    }

    /**
     * Limit an `exists` rule to entries that are switched on, or the one the staff member already has.
     */
    private function offered(Exists $rule, ?int $currentId): Exists
    {
        return $rule->where(fn ($query) => $query->where('is_active', true)->when($currentId, fn ($query) => $query->orWhere('id', $currentId)));
    }
}
