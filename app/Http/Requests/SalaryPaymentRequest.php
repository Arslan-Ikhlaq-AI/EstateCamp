<?php

namespace App\Http\Requests;

use App\Models\SalaryPayment;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Salaries paid: one staff member's, or every salary still to pay in a
 * month (which then names the month as YYYY-MM), on a day, by a method,
 * with a reference such as the transfer or cheque number.
 */
class SalaryPaymentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'salaryPayment';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...($this->route('salaryPayment') ? [] : ['month' => ['required', 'date_format:Y-m']]),
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'payment_method' => ['nullable', Rule::in(SalaryPayment::PAYMENT_METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->route('salaryPayment')?->isPaid()) {
                    $validator->errors()->add('salary', 'This salary is already paid.');
                }
            },
        ];
    }

    /**
     * The first day of the month being paid, when paying a whole month.
     */
    public function month(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d', $this->validated('month').'-01')->startOfDay();
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['paid_on' => 'payment date', 'payment_method' => 'payment method'];
    }
}
