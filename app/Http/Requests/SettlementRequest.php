<?php

namespace App\Http\Requests;

use App\Models\Settlement;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Money paid out of a commission, a deposit or extra income: the day (not
 * after today, nor before the money arrived), how much, who to and how.
 * HasSettlements::settle() checks there is enough left.
 */
class SettlementRequest extends ExtraPaymentRecordRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'settled_on' => ['required', 'date', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'paid_to' => ['required', 'string', 'max:255'],
            'method' => ['required', Rule::in(Settlement::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $receivedOn = $this->record()->received_on;

                if ($validator->errors()->isEmpty() && $receivedOn?->gt($this->date('settled_on'))) {
                    $validator->errors()->add('settled_on', "This was received on {$receivedOn->format('j M Y')}, so it cannot be settled before then.");
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['settled_on' => 'settlement date', 'paid_to' => 'paid to', 'method' => 'how it was paid'];
    }
}
