<?php

namespace App\Http\Requests;

use App\Models\Payment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Recording that a cheque cleared or bounced.
 */
class PaymentStatusRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'payment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(Payment::STATUSES)],
        ];
    }

    /**
     * Cash, card and transfers are received at once; only cheques change status.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->route('payment')->method !== 'cheque') {
                    $validator->errors()->add('status', 'Only a cheque can be marked as pending, cleared or bounced.');
                }
            },
        ];
    }
}
