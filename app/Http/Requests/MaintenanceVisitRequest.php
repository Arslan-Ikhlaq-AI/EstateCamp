<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Visits added to a contract's schedule, as the contractor gave them: one
 * or more dates within the contract's term, each with an optional time.
 */
class MaintenanceVisitRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'maintenanceContract';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $contract = $this->route('maintenanceContract');

        return [
            'visits' => ['required', 'array', 'min:1', 'max:60'],
            'visits.*.scheduled_on' => [
                'required',
                'date',
                'after_or_equal:'.$contract->start_date->toDateString(),
                'before_or_equal:'.$contract->end_date->toDateString(),
            ],
            'visits.*.scheduled_time' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['visits.*.scheduled_on' => 'visit date', 'visits.*.scheduled_time' => 'visit time'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $contract = $this->route('maintenanceContract');
        $term = "{$contract->start_date->format('j M Y')} to {$contract->end_date->format('j M Y')}";

        return [
            'visits.required' => 'Add at least one visit date.',
            'visits.*.scheduled_on.after_or_equal' => "Visits must fall within the contract, from {$term}.",
            'visits.*.scheduled_on.before_or_equal' => "Visits must fall within the contract, from {$term}.",
        ];
    }
}
