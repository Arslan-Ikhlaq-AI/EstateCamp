<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * A bonus, overtime or other addition, and a deduction such as an advance
 * or a fine, added by hand to a salary not yet paid.
 */
class SalaryAdjustmentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'salaryPayment';

    /**
     * Additions or deductions left empty are none.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'additions' => $this->filled('additions') ? $this->input('additions') : 0,
            'deductions' => $this->filled('deductions') ? $this->input('deductions') : 0,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'additions' => ['numeric', 'min:0', 'max:10000000'],
            'deductions' => ['numeric', 'min:0', 'max:10000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $salary = $this->route('salaryPayment');

                if ($salary->isPaid()) {
                    $validator->errors()->add('salary', 'This salary is already paid. Undo the payment to change it.');

                    return;
                }

                $pay = (float) $salary->earned_salary - (float) $salary->absence_deduction + (float) $this->input('additions');

                if (! $validator->errors()->has('deductions') && (float) $this->input('deductions') > round($pay, 2)) {
                    $validator->errors()->add('deductions', 'The deductions are more than the pay for the month.');
                }
            },
        ];
    }
}
