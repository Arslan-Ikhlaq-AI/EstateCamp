<?php

namespace App\Http\Requests;

use App\Models\Commission;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * A commission or deposit left for later has arrived, in cash or by a
 * cheque with its number, bank and date.
 */
class ExtraPaymentReceiveRequest extends ExtraPaymentRecordRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isCheque = $this->input('method') === 'cheque';

        return [
            'received_on' => ['required', 'date', 'before_or_equal:today'],
            'method' => ['required', Rule::in(Commission::METHODS)],
            'cheque_number' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:30'],
            'bank_name' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:255'],
            'cheque_date' => [Rule::requiredIf($isCheque), 'nullable', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['received_on' => 'date received', 'method' => 'how it was paid', 'bank_name' => 'bank'];
    }
}
