<?php

namespace App\Http\Requests;

use App\Models\OtherPayment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * A one-off payment for a property, added or corrected on its form: what
 * it was for, who is paid, how much, the day, and its receipt. A new one is
 * paid now or left to pay; after that its status changes through
 * OtherPaymentStatusRequest. A paid one needs how it was paid, on a day
 * not after today.
 */
class OtherPaymentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'otherPayment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isPaid = $this->isPaid();

        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            ...($this->route('otherPayment') ? [] : ['status' => ['required', Rule::in(['paid', 'pending'])]]),
            'title' => ['required', 'string', 'max:255'],
            'paid_to' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'payment_date' => ['required', 'date', ...($isPaid ? ['before_or_equal:today'] : [])],
            'method' => [$isPaid ? 'required' : 'nullable', Rule::in(OtherPayment::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'remove_receipt' => ['nullable', 'boolean'],
        ];
    }

    /**
     * Whether the payment is (or is being recorded as) paid.
     */
    public function isPaid(): bool
    {
        return $this->route('otherPayment')?->isPaid() ?? $this->input('status') === 'paid';
    }

    /**
     * The payment's own details, without its property, status or receipt.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        return $this->safe()->only(['title', 'paid_to', 'amount', 'payment_date', 'method', 'reference', 'notes']);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['property_id' => 'property', 'paid_to' => 'paid to', 'payment_date' => 'date', 'method' => 'payment method'];
    }
}
