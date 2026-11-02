<?php

namespace App\Models\Concerns;

use App\Models\UserRole;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * What a user may do, from the catalog in config/permissions.php: their
 * company's own choice for them when it made one, otherwise their role's
 * defaults (or, for a staff member's sign-in, their access level's), less
 * the pages their company cannot use. Platform admins and super admins
 * may do everything their company can. Area managers and camp bosses do it
 * only at the camps given to them (see LimitedToCamps), and never on the
 * pages that add up the whole company.
 */
trait HasPermissions
{
    /**
     * Permission lists already worked out from their patterns, by pattern list.
     *
     * @var array<string, list<string>>
     */
    private static array $expandedPermissions = [];

    /**
     * The camps the user is limited to, once read.
     *
     * @var list<int>|null
     */
    private ?array $campIds = null;

    /**
     * Every permission in the catalog, as "{page}.{action}", in catalog order.
     *
     * @return list<string>
     */
    public static function allPermissions(): array
    {
        return self::expandPermissions(['*']);
    }

    /**
     * The permissions `$patterns` name, in catalog order. "*" matches any
     * part of a name, and a pattern starting with "!" takes its matches
     * away from those named before it.
     *
     * @param  list<string>  $patterns
     * @return list<string>
     */
    public static function expandPermissions(array $patterns): array
    {
        return self::$expandedPermissions[implode('|', $patterns)] ??= (function () use ($patterns): array {
            $catalog = collect(config('permissions.modules'))
                ->flatMap(fn (array $pages) => collect($pages)->flatMap(fn (array $actions, string $page) => array_map(fn (string $action) => "{$page}.{$action}", array_keys($actions))))
                ->values()
                ->all();
            $granted = [];

            foreach ($patterns as $pattern) {
                $matches = array_filter($catalog, fn (string $permission) => Str::is(ltrim($pattern, '!'), $permission));
                $granted = str_starts_with($pattern, '!') ? array_diff($granted, $matches) : [...$granted, ...$matches];
            }

            return array_values(array_intersect($catalog, $granted));
        })();
    }

    /**
     * Whether the user may do everything their company can, which no one
     * can narrow: platform admins and the company's super admins.
     */
    public function hasFullAccess(): bool
    {
        return $this->is_admin || $this->role?->slug === UserRole::SUPER_ADMIN;
    }

    /**
     * Whether the company chose this user's permissions itself rather than
     * leaving their role's defaults.
     */
    public function hasCustomPermissions(): bool
    {
        return $this->permissions !== null && ! $this->hasFullAccess();
    }

    /**
     * What the user's role, or their access as a staff member, allows
     * before anything is chosen for them. Accounts with neither keep the
     * access they had before roles.
     *
     * @return list<string>
     */
    public function defaultPermissions(): array
    {
        if ($this->hasFullAccess()) {
            return self::allPermissions();
        }

        if ($this->role !== null) {
            $rolePermissions = self::expandPermissions(config("permissions.roles.{$this->role->slug}", []));

            // A staff member given a role keeps the staff pages their access level opens.
            return array_values(array_intersect(self::allPermissions(), [...$rolePermissions, ...$this->staffPermissions(withRestOfApp: false)]));
        }

        if ($this->staffMember !== null) {
            return $this->staffPermissions(withRestOfApp: true);
        }

        return self::expandPermissions(config('permissions.without_role'));
    }

    /**
     * What a staff member's sign-in may do from their staff record: the
     * staff pages their access level opens and, with `$withRestOfApp`,
     * the rest of the app when the record allows it. Nothing for an
     * account that is no one's sign-in.
     *
     * @return list<string>
     */
    public function staffPermissions(bool $withRestOfApp): array
    {
        $member = $this->staffMember;

        if ($member === null) {
            return [];
        }

        $staffPages = self::expandPermissions(config("permissions.staff_access.{$member->access}", []));
        $rest = $withRestOfApp && $member->app_access ? self::expandPermissions(config('permissions.app_access')) : [];

        return array_values(array_intersect(self::allPermissions(), [...$staffPages, ...$rest]));
    }

    /**
     * Everything the user may do now: their permissions, less the pages
     * their company has switched off, and for someone limited to some
     * camps, less the pages about the whole company.
     *
     * @return list<string>
     */
    public function permissionKeys(): array
    {
        $granted = $this->hasCustomPermissions()
            ? array_values(array_intersect(self::allPermissions(), $this->permissions))
            : $this->defaultPermissions();

        $company = $this->company;
        $companyWide = $this->campPropertyIds() === null ? [] : config('permissions.company_wide');

        return array_values(array_filter($granted, function (string $permission) use ($company, $companyWide): bool {
            $page = Str::before($permission, '.');

            return ($company === null || $company->hasFeature($page)) && ! in_array($page, $companyWide, true);
        }));
    }

    /**
     * The properties (camps) the user is limited to, or null when they see
     * every one: an area manager or camp boss sees only those given to them
     * on the users page, and none until some are.
     *
     * @return list<int>|null
     */
    public function campPropertyIds(): ?array
    {
        if ($this->is_admin || ! array_key_exists((string) $this->role?->slug, UserRole::CAMP_ROLES)) {
            return null;
        }

        // Read without the Property model, whose own queries ask for these.
        return $this->campIds ??= DB::table('property_user')
            ->where('user_id', $this->id)
            ->orderBy('property_id')
            ->pluck('property_id')
            ->map(fn (int|string $id) => (int) $id)
            ->all();
    }

    /**
     * The camps the signed-in user is limited to, or null when no one is
     * signed in (the console, the queue) or they see every camp.
     *
     * @return list<int>|null
     */
    public static function signedInCampIds(): ?array
    {
        $user = Auth::hasUser() ? Auth::user() : null;

        return $user instanceof self ? $user->campPropertyIds() : null;
    }

    /**
     * Whether the user may do `$permission` (such as `rooms.create`).
     */
    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissionKeys(), true);
    }

    /**
     * Whether the user may change `$user`'s role and permissions: someone
     * else in their company who is not a platform admin, and a super admin
     * only when they are one too.
     */
    public function canManageAccessOf(self $user): bool
    {
        return $this->hasPermission('users.manage')
            && $user->company_id === $this->company_id
            && $user->isNot($this)
            && ! $user->is_admin
            && (! $user->hasFullAccess() || $this->hasFullAccess());
    }

    /**
     * Whether the user may give someone `$role` (a UserRole slug): only a
     * super admin makes another, and a role's defaults may not reach past
     * what the user may do themselves.
     */
    public function canGiveRole(string $role): bool
    {
        if ($role === UserRole::SUPER_ADMIN) {
            return $this->hasFullAccess();
        }

        $company = $this->company;
        $defaults = array_filter(self::expandPermissions(config("permissions.roles.{$role}", [])), fn (string $permission) => $company?->hasFeature(Str::before($permission, '.')) ?? true);

        return array_diff($defaults, $this->permissionKeys()) === [];
    }

    /**
     * The page to open the app on: the dashboard, a staff member's own
     * page, or else the first page the user may open.
     */
    public function homeRoute(): string
    {
        $permissions = $this->permissionKeys();

        if (in_array('dashboard.view', $permissions, true)) {
            return 'dashboard';
        }

        if ($this->staffMember !== null) {
            return 'my.index';
        }

        // A page's first "view" route is its list; the users page has only "manage".
        foreach (config('permissions.modules') as $pages) {
            foreach ($pages as $page => $actions) {
                $routes = $actions['view'] ?? ($page === 'users' ? $actions['manage'] : []);

                if ($routes !== [] && in_array($page.'.'.($page === 'users' ? 'manage' : 'view'), $permissions, true)) {
                    return $routes[0];
                }
            }
        }

        return 'profile.edit';
    }
}
