<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ActAsChosenCompany;
use App\Http\Requests\Admin\CompanyFeaturesRequest;
use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Company permissions: which pages each company on the platform may use.
 * A page switched off here is gone for everyone in the company, whatever
 * their own permissions say. The parent super admin can also open any
 * company and work inside it (see ActAsChosenCompany).
 */
class CompanyController extends Controller
{
    /**
     * List every company with how many users it has and how many of its pages are off.
     */
    public function index(): Response
    {
        $pageCount = count(collect(Company::features())->flatten());

        return Inertia::render('Admin/Companies', [
            'companies' => Company::query()
                ->withCount('users')
                ->orderBy('name')
                ->get()
                ->map(fn (Company $company) => [
                    ...$company->only(['id', 'name', 'slug', 'logo_url', 'status', 'email']),
                    'users' => $company->users_count,
                    'disabled' => count($company->disabled_features ?? []),
                    'pages' => $pageCount,
                ]),
        ]);
    }

    /**
     * Show a company's pages, under each top menu, with which are on.
     */
    public function edit(Company $company): Response
    {
        $alwaysOn = config('permissions.always_on');

        return Inertia::render('Admin/CompanyFeatures', [
            'company' => [
                ...$company->only(['id', 'name', 'slug', 'logo_url', 'status', 'email']),
                'users' => $company->users()->count(),
            ],
            'modules' => collect(Company::features())->map(fn (array $pages, string $module) => [
                'key' => $module,
                'pages' => array_map(fn (string $page) => ['key' => $page, 'alwaysOn' => in_array($page, $alwaysOn, true)], $pages),
            ])->values(),
            'disabled' => $company->disabled_features ?? [],
        ]);
    }

    /**
     * Save which of a company's pages are off.
     */
    public function update(CompanyFeaturesRequest $request, Company $company): RedirectResponse
    {
        $disabled = $request->validated('disabled_features');

        $company->forceFill(['disabled_features' => $disabled === [] ? null : array_values($disabled)])->save();

        return back()->with('success', "{$company->name}’s permissions were saved.");
    }

    /**
     * Work inside `$company`, with full access, until going back.
     */
    public function open(Request $request, Company $company): RedirectResponse
    {
        $request->session()->put(ActAsChosenCompany::SESSION_KEY, $company->id);

        return to_route('dashboard')->with('success', "You are now working in {$company->name}.");
    }

    /**
     * Go back to the parent super admin's own company.
     */
    public function leave(Request $request): RedirectResponse
    {
        $request->session()->forget(ActAsChosenCompany::SESSION_KEY);

        return to_route('dashboard')->with('success', 'You are back in your own company.');
    }
}
