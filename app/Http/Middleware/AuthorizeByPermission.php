<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuses a route to a user without a permission that opens it, as
 * config/permissions.php lists them. A route listed under several
 * permissions opens with any one of them; a route not listed needs none.
 */
class AuthorizeByPermission
{
    /**
     * The permissions opening each route, by route name.
     *
     * @var array<string, list<string>>|null
     */
    private static ?array $routePermissions = null;

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $permissions = self::forRoute($request->route()?->getName());

        if ($permissions !== []) {
            $user = $request->user();

            abort_unless($user !== null && collect($permissions)->contains(fn (string $permission) => $user->hasPermission($permission)), Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }

    /**
     * The permissions that open route `$name`, any one of them enough.
     *
     * @return list<string>
     */
    public static function forRoute(?string $name): array
    {
        if (self::$routePermissions === null) {
            self::$routePermissions = [];

            foreach (config('permissions.modules') as $pages) {
                foreach ($pages as $page => $actions) {
                    foreach ($actions as $action => $routes) {
                        foreach ($routes as $route) {
                            self::$routePermissions[$route][] = "{$page}.{$action}";
                        }
                    }
                }
            }
        }

        return self::$routePermissions[$name] ?? [];
    }
}
