<?php

namespace App\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * The month to prepare the payroll for, as YYYY-MM: this month or one before it.
 */
class PayrollMonthRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'month' => ['required', 'date_format:Y-m', 'before_or_equal:'.today()->format('Y-m')],
        ];
    }

    /**
     * The first day of the chosen month.
     */
    public function month(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d', $this->validated('month').'-01')->startOfDay();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'month.before_or_equal' => 'The payroll can be prepared for this month or an earlier one.',
        ];
    }
}
