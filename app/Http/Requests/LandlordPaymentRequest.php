<?php

namespace App\Http\Requests;

use App\Models\HeadLeasePayment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Recording what happened to one instalment owed to a landlord.
 */
class LandlordPaymentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'head_lease_payment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(HeadLeasePayment::STATUSES)],
            'paid_on' => ['required_if:status,paid', 'nullable', 'date', 'before_or_equal:today'],
            'payment_method' => ['required', Rule::in(HeadLeasePayment::METHODS)],
            'cheque_number' => ['nullable', 'required_if:payment_method,cheque', 'string', 'max:30'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'paid_on' => 'payment date',
            'payment_method' => 'payment method',
        ];
    }
}
