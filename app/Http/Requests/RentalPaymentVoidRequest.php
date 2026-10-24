<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * Voiding a receipt made by mistake, with why.
 */
class RentalPaymentVoidRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'rentalPayment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * A receipt from a cheque follows the cheque: it is voided by marking
     * the cheque as bounced.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $payment = $this->route('rentalPayment');

                if ($payment->isVoid()) {
                    $validator->errors()->add('reason', 'This receipt is already void.');
                } elseif ($payment->cheque_id !== null) {
                    $validator->errors()->add('reason', 'This receipt came from a cheque. Mark the cheque as bounced in the cheque register instead.');
                }
            },
        ];
    }
}
