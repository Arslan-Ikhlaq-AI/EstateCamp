<?php

namespace App\Http\Controllers;

use App\Http\Requests\CashHandoverRequest;
use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\RentalPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cash collected at a property by the camp boss, handed over to the
 * company less what the camp boss paid out of it for the property's bills.
 * An admin confirms the handover from the property's payments page, and
 * from then on none of it counts as cash with the camp boss.
 */
class PropertyCashHandoverController extends Controller
{
    /**
     * Settle the cash receipts and the bills paid in cash on screen with
     * the signed-in admin now. Those already settled, voided, unpaid or not
     * cash are left alone.
     *
     * @throws ValidationException When none of them is still to settle.
     */
    public function store(CashHandoverRequest $request, Property $property): RedirectResponse
    {
        [$receipts, $spent] = DB::transaction(function () use ($request, $property) {
            $settled = ['handed_over_at' => now(), 'handed_over_to' => $request->user()->id];
            $receipts = $request->receipts($property);
            $bills = $request->bills($property);
            $others = $request->others($property);

            RentalPayment::query()->whereKey($receipts->modelKeys())->update($settled);
            MaintenanceJob::query()->whereKey($bills->modelKeys())->update($settled);
            OtherPayment::query()->whereKey($others->modelKeys())->update($settled);

            return [$receipts, $bills->toBase()->concat($others)];
        });

        if ($receipts->isEmpty() && $spent->isEmpty()) {
            throw ValidationException::withMessages(['receipts' => 'This cash has already been confirmed.']);
        }

        $collected = (float) $receipts->sum('amount');
        $paidOut = (float) $spent->sum('amount');
        $money = fn (float $amount) => number_format($amount, 2);

        if ($spent->isEmpty()) {
            return back()->with('success', "Cash of {$money($collected)} from {$receipts->count()} ".str('receipt')->plural($receipts->count()).' was confirmed as received.');
        }

        return back()->with('success', $collected >= $paidOut
            ? "Cash of {$money($collected - $paidOut)} was confirmed as received: {$money($collected)} collected less {$money($paidOut)} spent on bills."
            : "The camp boss spent {$money($paidOut)} on bills, {$money($paidOut - $collected)} more than the {$money($collected)} collected; the company owes that back.");
    }
}
