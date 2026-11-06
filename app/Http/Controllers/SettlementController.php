<?php

namespace App\Http\Controllers;

use App\Http\Requests\SettlementRequest;
use App\Models\Settlement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Paying money out of a commission, a deposit or extra income, and taking a
 * settlement back. The route's `kind` says which of the three it is.
 */
class SettlementController extends Controller
{
    /**
     * Settle part or all of what is left.
     */
    public function store(SettlementRequest $request): RedirectResponse
    {
        $record = $request->record();
        $amount = number_format((float) $record->settle($request->validated(), $request->user())->amount, 2);

        return back()->with('success', "{$amount} of {$record->getAttribute($record::NUMBER_COLUMN)} was settled.");
    }

    /**
     * Take back a settlement entered by mistake.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $record = Settlement::KINDS[$request->route('kind')]::query()
            ->where('company_id', $this->currentCompany($request)->id)
            ->findOrFail($request->route('record'));

        $record->undoSettlement($record->settlements()->findOrFail($request->route('settlement')));

        return back()->with('success', "The settlement on {$record->getAttribute($record::NUMBER_COLUMN)} was taken back.");
    }
}
