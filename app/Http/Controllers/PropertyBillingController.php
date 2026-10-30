<?php

namespace App\Http\Controllers;

use App\Http\Requests\BillingPaymentRequest;
use App\Models\Payment;
use App\Models\Property;
use App\Models\RoomRental;
use Illuminate\Http\RedirectResponse;

/**
 * Money collected from the billing tab of a property's room allocation,
 * where each company pays its bill as a whole.
 */
class PropertyBillingController extends Controller
{
    /**
     * Record what a company paid today towards its bill up to the end of the
     * period on screen. A contract's payment issues any invoice still due
     * and settles the oldest open invoices first; a short-term rental's is
     * a rent receipt. Whatever is left unpaid carries into the next bill.
     * A short-term rental's cheque goes into the cheque register in hand,
     * to be submitted later.
     */
    public function store(BillingPaymentRequest $request, Property $property): RedirectResponse
    {
        $account = $request->account($property);
        $amount = number_format((float) $request->validated('amount'), 2);

        if ($account instanceof RoomRental && $request->validated('method') === 'cheque') {
            $cheque = $account->receiveCheque($request->cheque(), $request->user());

            return back()->with('success', "Cheque {$cheque->cheque_number} of {$amount} from {$account->client->name} was added to the cheques to submit.");
        }

        $payment = $account->collectPayment((float) $request->validated('amount'), $request->date('through'), $request->validated('method'), $request->user());
        $number = $payment instanceof Payment ? $payment->payment_number : $payment->receipt_number;

        return back()->with('success', "Payment {$number} of {$amount} from {$account->client->name} was recorded.");
    }
}
