<?php

namespace App\Http\Requests;

use App\Models\OtherPayment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A one-off payment moving to another status: paid (on a day, and how),
 * back to still to pay, or cancelled.
 */
class OtherPaymentStatusRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'otherPayment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(OtherPayment::STATUSES)],
            'date' => ['nullable', 'required_if:status,paid', 'date', 'before_or_equal:today'],
            'method' => ['nullable', 'required_if:status,paid', Rule::in(OtherPayment::METHODS)],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $payment = $this->route('otherPayment');

                if ($payment->status === $this->input('status')) {
                    $validator->errors()->add('status', "{$payment->payment_number} is already {$this->input('status')}.");
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['method' => 'payment method'];
    }
}
