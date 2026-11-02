<?php

namespace App\Http\Controllers;

use App\Http\Requests\CompanyUserRequest;
use App\Http\Requests\UserPermissionsRequest;
use App\Mail\AccountCredentials;
use App\Models\Company;
use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The company's users and what each of them may do: their role, which
 * brings its default permissions, or a list chosen for them page by page
 * (see config/permissions.php); and for area managers and camp bosses, the
 * camps they see. Users may give only what they may do themselves, and no
 * one changes their own access.
 */
class CompanyUserController extends Controller
{
    /**
     * List the company's users with their role and how much they may do.
     */
    public function index(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $editor = $request->user();

        return Inertia::render('Configuration/Users', [
            'company' => $company->only(['id', 'name']),
            'users' => $company->users()
                ->with(['role', 'staffMember', 'properties:id,name'])
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->summary($user, $editor)),
            'available' => count($this->availablePermissions($company)),
            'roles' => $this->roles($editor, $company),
            'properties' => $this->properties($company),
        ]);
    }

    /**
     * Add a user with a role (and their camps) and the password chosen for
     * them, emailed to them, then open their permissions.
     */
    public function store(CompanyUserRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $password = $request->validated('password');

        $user = new User;
        $user->forceFill([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $password,
            'company_id' => $company->id,
            'user_role_id' => UserRole::builtIn($request->validated('role'))->id,
            'is_admin' => false,
            // The company vouches for the address, as it does for its staff.
            'email_verified_at' => now(),
        ])->save();

        $user->properties()->sync($request->campIds());

        // Chosen for them, so the email asks them to change it once signed in.
        Mail::to($user)->queue(new AccountCredentials($user, $password));

        return to_route('configuration.users.edit', $user)->with('success', "{$user->name} was added. They sign in with {$user->email} and the password you chose.");
    }

    /**
     * Show a user's role and every permission, page by page under each top
     * menu, with what the signed-in user may change.
     */
    public function edit(Request $request, User $user): Response
    {
        $this->ensureSameCompany($request, $user);

        $company = $this->currentCompany($request);
        $editor = $request->user();
        $member = $user->staffMember;

        return Inertia::render('Configuration/UserPermissions', [
            'user' => [
                ...$this->summary($user, $editor),
                'staff' => $member ? [
                    'id' => $member->id,
                    'access' => $member->access,
                    'appAccess' => (bool) $member->app_access,
                    'isRemoved' => $member->trashed(),
                ] : null,
                // What is ticked now: their own list, or their role's defaults.
                'permissions' => $user->hasCustomPermissions() ? array_values(array_intersect(User::allPermissions(), $user->permissions)) : $user->defaultPermissions(),
                'defaults' => $user->defaultPermissions(),
                // What a staff sign-in brings to a role, and what it has without one.
                'staffPages' => $user->staffPermissions(withRestOfApp: false),
                'staffDefaults' => $user->staffPermissions(withRestOfApp: true),
                'propertyIds' => $user->properties()->pluck('properties.id'),
            ],
            'modules' => collect(config('permissions.modules'))->map(fn (array $pages, string $module) => [
                'key' => $module,
                'pages' => collect($pages)->map(fn (array $actions, string $page) => [
                    'key' => $page,
                    'actions' => array_keys($actions),
                    'enabled' => $company->hasFeature($page),
                ])->values(),
            ])->values(),
            'roles' => $this->roles($editor, $company),
            'givable' => $editor->permissionKeys(),
            'companyWide' => config('permissions.company_wide'),
            'properties' => $this->properties($company),
        ]);
    }

    /**
     * Save a user's role, camps and permissions, and a new password when
     * one was typed, which ends any sign-in they asked to be remembered. It
     * is not emailed: whoever set it tells them. A staff member's sign-in
     * may be left without a role.
     */
    public function update(UserPermissionsRequest $request, User $user): RedirectResponse
    {
        $role = $request->validated('role');
        $password = $request->validated('password');

        $user->user_role_id = $role === null ? null : UserRole::builtIn($role)->id;
        $user->permissions = $request->chosenPermissions();

        if ($password !== null) {
            $user->password = $password;
            $user->remember_token = Str::random(60);
        }

        $user->save();
        $user->properties()->sync($request->campIds());

        return back()->with('success', $password === null
            ? "{$user->name}’s access was saved."
            : "{$user->name}’s access was saved. They now sign in with {$user->email} and the new password.");
    }

    /**
     * One user as the users page lists them.
     *
     * @return array{id: int, name: string, email: string, kind: string, role: array{slug: string, name: string}|null, staffAccess: string|null, camps: list<string>|null, custom: bool, permissionCount: int, isYou: bool, canEdit: bool}
     */
    private function summary(User $user, User $editor): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            // Who they are to the company, which decides where their access comes from.
            'kind' => match (true) {
                (bool) $user->is_admin => 'platform_admin',
                $user->role?->slug === UserRole::SUPER_ADMIN => 'super_admin',
                $user->role !== null => 'role',
                $user->staffMember !== null => 'staff',
                default => 'no_role',
            },
            'role' => $user->role?->only(['slug', 'name']),
            'staffAccess' => $user->staffMember?->access,
            'camps' => $user->campPropertyIds() === null ? null : $user->properties->pluck('name')->all(),
            'custom' => $user->hasCustomPermissions(),
            'permissionCount' => count($user->permissionKeys()),
            'isYou' => $user->is($editor),
            'canEdit' => $editor->canManageAccessOf($user),
        ];
    }

    /**
     * The roles on offer, each with its default permissions in this company
     * and whether the signed-in user may give it.
     *
     * and for a role limited to some camps, how many it may have (null
     * for any number).
     *
     * @return list<array{value: string, name: string, description: string, permissions: list<string>, givable: bool, camps: bool, campLimit: int|null}>
     */
    private function roles(User $editor, Company $company): array
    {
        $available = $this->availablePermissions($company);

        return collect(UserRole::BUILT_IN)->map(function (array $role, string $slug) use ($editor, $available): array {
            $isCamp = array_key_exists($slug, UserRole::CAMP_ROLES);
            $permissions = array_intersect(User::expandPermissions(config("permissions.roles.{$slug}", [])), $available);

            return [
                'value' => $slug,
                ...$role,
                'permissions' => array_values($isCamp ? array_filter($permissions, fn (string $permission) => ! in_array(Str::before($permission, '.'), config('permissions.company_wide'), true)) : $permissions),
                'givable' => $editor->canGiveRole($slug),
                'camps' => $isCamp,
                'campLimit' => UserRole::CAMP_ROLES[$slug] ?? null,
            ];
        })->values()->all();
    }

    /**
     * The company's properties, to give area managers and camp bosses.
     *
     * @return list<array{id: int, name: string, code: string|null}>
     */
    private function properties(Company $company): array
    {
        return $company->properties()->orderBy('name')->get(['id', 'name', 'code'])->map(fn ($property) => $property->only(['id', 'name', 'code']))->all();
    }

    /**
     * Every permission on a page the company may use.
     *
     * @return list<string>
     */
    private function availablePermissions(Company $company): array
    {
        return array_values(array_filter(User::allPermissions(), fn (string $permission) => $company->hasFeature(Str::before($permission, '.'))));
    }
}
