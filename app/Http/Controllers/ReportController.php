<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The reports home: every report the user can open, grouped by what it
 * covers.
 */
class ReportController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        return Inertia::render('Reports/Index', [
            'company' => $company ? ['name' => $company->name] : null,
        ]);
    }
}
