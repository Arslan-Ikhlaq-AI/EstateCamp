<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * Marking a cheque's money as moved in one step, on a given day: a client's
 * cheque cashed, or one the company handed over paid.
 */
class ChequeSettleRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'cheque';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Only a client's cheque in hand or at the bank, or one handed over.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $cheque = $this->route('cheque');

                if (! $cheque->canBeSettled()) {
                    $validator->errors()->add('cheque', 'This cheque cannot be marked as '.($cheque->direction === 'received' ? 'cashed' : 'paid').' now.');
                }
            },
        ];
    }
}
