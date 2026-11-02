<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets the parent super admin (a platform admin) work inside any company:
 * once they open one from the Companies page or the company switcher, every
 * request treats them as a member of it, with full access, until they go
 * back to their own. Their account itself keeps its own company.
 */
class ActAsChosenCompany
{
    /**
     * The session key holding the company being worked in.
     */
    public const SESSION_KEY = 'acting_company_id';

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $companyId = $request->hasSession() ? $request->session()->get(self::SESSION_KEY) : null;

        if ($user?->is_admin && $companyId !== null) {
            if (Company::whereKey($companyId)->exists()) {
                // Set as the stored value, so saving the account never writes it.
                $user->setRawAttributes(['company_id' => (int) $companyId] + $user->getAttributes(), true);
                $user->unsetRelation('company');
            } else {
                $request->session()->forget(self::SESSION_KEY);
            }
        }

        return $next($request);
    }
}
