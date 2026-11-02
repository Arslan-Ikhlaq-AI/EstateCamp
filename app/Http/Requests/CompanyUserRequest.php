<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\UserRole;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * A user added to the company from the users page, with their role (and
 * for an area manager or camp boss, the camps they look after) and the
 * password they sign in with, which is also emailed to them.
 */
class CompanyUserRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique(User::class, 'email')],
            'role' => ['required', Rule::in(array_keys(UserRole::BUILT_IN)), $this->givableRole()],
            'password' => ['required', 'string', Password::defaults()],
            ...$this->campRules(),
        ];
    }

    /**
     * The camps an area manager or camp boss looks after: some of the
     * company's properties, and only one for a camp boss.
     *
     * @return array<string, array<mixed>>
     */
    protected function campRules(): array
    {
        $limit = UserRole::CAMP_ROLES[$this->input('role')] ?? null;

        return [
            'property_ids' => [Rule::requiredIf($this->givesCamps()), 'array', ...($limit === null ? [] : ["max:{$limit}"])],
            'property_ids.*' => ['integer', 'distinct', $this->existsInCompany('properties')],
        ];
    }

    /**
     * Whether the chosen role sees only the camps given with it.
     */
    public function givesCamps(): bool
    {
        return array_key_exists((string) $this->input('role'), UserRole::CAMP_ROLES);
    }

    /**
     * The camps to give the user: none unless their role is limited to some.
     *
     * @return list<int>
     */
    public function campIds(): array
    {
        return $this->givesCamps() ? array_map('intval', $this->validated('property_ids', [])) : [];
    }

    /**
     * A role the signed-in user may give (see User::canGiveRole()), or the
     * one the user being changed already has.
     */
    protected function givableRole(?string $currentRole = null): Closure
    {
        return function (string $attribute, mixed $role, Closure $fail) use ($currentRole) {
            if (is_string($role) && $role !== $currentRole && ! $this->user()->canGiveRole($role)) {
                $fail($role === UserRole::SUPER_ADMIN
                    ? 'Only a super admin can make someone a super admin.'
                    : 'This role can do things you cannot, so only someone who can do them may give it.');
            }
        };
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'This email already has an account.',
            'password.required' => 'Choose the password they will sign in with.',
            'property_ids.required' => 'Choose the camps they look after.',
            'property_ids.max' => 'A camp boss runs one camp. Make them an area manager to give them more.',
        ];
    }
}
