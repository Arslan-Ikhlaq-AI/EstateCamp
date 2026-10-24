<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * A visit moved to another day (and time) within its contract's term, such
 * as when the contractor asks to come later. A visit already done or
 * cancelled stays where it is.
 */
class MaintenanceVisitRescheduleRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'maintenanceVisit';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $contract = $this->route('maintenanceVisit')->contract;

        return [
            'scheduled_on' => [
                'required',
                'date',
                'after_or_equal:'.$contract->start_date->toDateString(),
                'before_or_equal:'.$contract->end_date->toDateString(),
            ],
            'scheduled_time' => ['nullable', 'date_format:H:i'],
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
                if (in_array($this->route('maintenanceVisit')->status, ['done', 'cancelled'], true)) {
                    $validator->errors()->add('scheduled_on', 'A visit that is done or cancelled cannot be moved. Put it back on the schedule first.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['scheduled_on' => 'visit date', 'scheduled_time' => 'visit time'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'scheduled_on.after_or_equal' => 'The visit must fall within the contract.',
            'scheduled_on.before_or_equal' => 'The visit must fall within the contract.',
        ];
    }
}
