<?php

namespace App\Http\Requests;

use App\Models\ExtraIncome;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Extra income for a property, added or corrected on its form: who paid,
 * what for, how much, the day it was received (not after today) and how,
 * with the invoice. It is always recorded as received; it is cancelled
 * through ExtraIncomeStatusRequest. `from_payments` sends a new one back
 * to the property's payments it was added from.
 */
class ExtraIncomeRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'extraIncome';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'title' => ['required', 'string', 'max:255'],
            'received_from' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'received_on' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['required', Rule::in(ExtraIncome::METHODS)],
            'invoice_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'invoice' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'remove_invoice' => ['nullable', 'boolean'],
            'from_payments' => ['nullable', 'boolean'],
        ];
    }

    /**
     * The income's own details, without its property, status or invoice.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        return $this->safe()->only(['title', 'received_from', 'amount', 'received_on', 'method', 'invoice_number', 'notes']);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['property_id' => 'property', 'received_from' => 'received from', 'received_on' => 'date received', 'method' => 'payment method'];
    }
}
