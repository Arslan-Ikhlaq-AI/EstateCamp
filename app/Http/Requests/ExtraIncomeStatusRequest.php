<?php

namespace App\Http\Requests;

use App\Models\ExtraIncome;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Extra income cancelled, as added by mistake, or counted as received
 * again.
 */
class ExtraIncomeStatusRequest extends CompanyScopedRequest
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
            'status' => ['required', Rule::in(ExtraIncome::STATUSES)],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $income = $this->route('extraIncome');

                if ($income->status === $this->input('status')) {
                    $validator->errors()->add('status', "{$income->income_number} is already {$this->input('status')}.");
                }
            },
        ];
    }
}
