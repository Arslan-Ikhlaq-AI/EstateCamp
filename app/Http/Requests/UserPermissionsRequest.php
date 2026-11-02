<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Models\UserRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * A user's role, camps and permissions, changed on the users page, with a
 * new password to sign in with when one is typed. A staff member's sign-in
 * may go without a role, keeping only what the access level on their staff
 * record opens.
 */
class UserPermissionsRequest extends CompanyUserRequest
{
    protected ?string $recordParameter = 'user';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return parent::authorize() && $this->user()->canManageAccessOf($this->route('user'));
    }

    /**
     * The "choose permissions myself" switch arrives as text from the form.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['custom' => $this->boolean('custom')]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->route('user');

        return [
            'role' => [$user->staffMember !== null ? 'nullable' : 'required', Rule::in(array_keys(UserRole::BUILT_IN)), $this->givableRole($user->role?->slug)],
            ...$this->campRules(),
            'password' => ['nullable', 'string', Password::defaults()],
            'custom' => ['boolean'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'distinct', Rule::in(User::allPermissions())],
        ];
    }

    /**
     * The permission list to store: null to follow the role, or what was
     * ticked of what the signed-in user may give, with whatever else the
     * user already had kept as it was (pages the company has switched off
     * included), so no one takes away what they could not give.
     *
     * @return list<string>|null
     */
    public function chosenPermissions(): ?array
    {
        if (! $this->validated('custom') || $this->validated('role') === UserRole::SUPER_ADMIN) {
            return null;
        }

        $user = $this->route('user');
        $givable = $this->user()->permissionKeys();
        $current = $user->hasCustomPermissions() ? $user->permissions : $user->defaultPermissions();

        return array_values(array_intersect(User::allPermissions(), [
            ...array_intersect($this->validated('permissions', []), $givable),
            ...array_diff($current, $givable),
        ]));
    }
}
