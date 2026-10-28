<?php

namespace App\Http\Requests;

use App\Models\MaintenanceJob;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Paying a maintenance bill: the day, how, and a reference such as the
 * transfer or cheque number. The amount charged can come with it, for
 * work whose cost was not recorded yet or has changed since.
 */
class MaintenanceBillPaymentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'maintenanceJob';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'payment_method' => ['required', Rule::in(MaintenanceJob::PAYMENT_METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'amount' => ['nullable', 'numeric', 'gt:0', 'max:100000000'],
        ];
    }

    /**
     * Only a bill with an amount (on file, or given now), not yet paid, can be paid.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $job = $this->route('maintenanceJob');

                if (! $job->isBill() && ! $this->filled('amount')) {
                    $validator->errors()->add('bill', "Record what {$job->job_number} cost before paying it.");
                } elseif ($job->isPaid()) {
                    $validator->errors()->add('bill', "{$job->job_number} is already paid.");
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['paid_on' => 'payment date', 'payment_method' => 'payment method', 'amount' => 'amount charged'];
    }
}
