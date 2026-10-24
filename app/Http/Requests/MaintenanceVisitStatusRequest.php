<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * A visit moving to another status: confirmed by the contractor, done (on
 * a day up to today, with who came, the service report number and a copy
 * of the report), missed, cancelled, or back on the schedule.
 */
class MaintenanceVisitStatusRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'maintenanceVisit';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $visit = $this->route('maintenanceVisit');

        return [
            'status' => ['required', Rule::in($visit->allowedStatuses())],
            'completed_on' => [
                'nullable',
                'required_if:status,done',
                'date',
                'before_or_equal:today',
                'after_or_equal:'.$visit->contract->start_date->toDateString(),
            ],
            'technician_name' => ['nullable', 'string', 'max:255'],
            'report_number' => ['nullable', 'string', 'max:100'],
            'report' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * What is recorded with the move.
     *
     * @return array{completed_on: mixed, technician_name: ?string, report_number: ?string, notes: ?string}
     */
    public function details(): array
    {
        return [
            'completed_on' => $this->date('completed_on'),
            'technician_name' => $this->validated('technician_name'),
            'report_number' => $this->validated('report_number'),
            'notes' => $this->validated('notes'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['completed_on' => 'date done', 'technician_name' => 'technician', 'report_number' => 'report number', 'report' => 'service report'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.in' => 'This visit cannot move to that status from where it is now.',
            'completed_on.required_if' => 'Enter the day the visit was done.',
            'completed_on.before_or_equal' => 'A visit cannot be done in the future.',
            'completed_on.after_or_equal' => 'The visit cannot be done before the contract started.',
        ];
    }
}
