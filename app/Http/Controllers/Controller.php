<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * The signed-in user's company. Users who do not belong to a company may
     * not manage company records.
     */
    protected function currentCompany(Request $request): Company
    {
        $company = Company::find($request->user()->company_id);

        abort_if($company === null, 403);

        return $company;
    }

    /**
     * Answer 404 for another company's record, so its existence is not revealed.
     */
    protected function ensureSameCompany(Request $request, Model $record): void
    {
        abort_unless($record->company_id === $request->user()->company_id, 404);
    }
}
