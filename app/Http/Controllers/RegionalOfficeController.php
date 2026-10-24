<?php

namespace App\Http\Controllers;

use App\Http\Requests\RegionalOfficeRequest;
use App\Models\Company;
use App\Models\RegionalOffice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The configuration page for the company's regional offices. Unlike the
 * shared type lists, each company keeps its own, so any member of the
 * company can manage them.
 */
class RegionalOfficeController extends Controller
{
    /**
     * List the offices with how many staff work at each.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        return Inertia::render('Configuration/RegionalOffices', [
            'company' => $company?->only(['id', 'name']),
            'offices' => $company
                ? $company->regionalOffices()
                    ->withCount([
                        'staffMembers as staff_count' => fn ($query) => $query->current(),
                        'staffMembers as ever_count' => fn ($query) => $query->withTrashed(),
                    ])
                    ->orderBy('name')
                    ->get()
                    ->map(fn (RegionalOffice $office) => [
                        ...$office->only(['id', 'name', 'code', 'city', 'address', 'phone', 'is_active']),
                        'staffCount' => $office->staff_count,
                        'inUse' => $office->ever_count > 0,
                    ])
                : [],
        ]);
    }

    /**
     * Add a regional office.
     */
    public function store(RegionalOfficeRequest $request): RedirectResponse
    {
        $office = $this->currentCompany($request)->regionalOffices()->create($request->validated());

        return back()->with('success', "{$office->name} was added.");
    }

    /**
     * Save changes to a regional office.
     */
    public function update(RegionalOfficeRequest $request, RegionalOffice $regionalOffice): RedirectResponse
    {
        $regionalOffice->update($request->validated());

        return back()->with('success', "{$regionalOffice->name} was updated.");
    }

    /**
     * Delete an office nobody works or has worked at; one in use can be switched off instead.
     *
     * @throws ValidationException When staff are or were placed at the office.
     */
    public function destroy(Request $request, RegionalOffice $regionalOffice): RedirectResponse
    {
        $this->ensureSameCompany($request, $regionalOffice);

        if ($regionalOffice->staffMembers()->withTrashed()->exists()) {
            throw ValidationException::withMessages([
                'office' => "Staff are placed at {$regionalOffice->name}, so it cannot be deleted. Switch it off to stop it being offered.",
            ]);
        }

        $regionalOffice->delete();

        return back()->with('success', "{$regionalOffice->name} was deleted.");
    }
}
