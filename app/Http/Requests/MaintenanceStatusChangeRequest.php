<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesMaintenanceCost;
use App\Models\MaintenanceStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A maintenance job moving to another status, on a given day, with a note.
 * Moving it to a finished status asks for the amount charged and the
 * invoice, unless the job already has them.
 */
class MaintenanceStatusChangeRequest extends CompanyScopedRequest
{
    use ValidatesMaintenanceCost;

    protected ?string $recordParameter = 'maintenanceJob';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $job = $this->route('maintenanceJob');

        return [
            'maintenance_status_id' => [
                'required',
                'integer',
                Rule::exists('maintenance_statuses', 'id')->where('is_active', true),
                Rule::notIn([$job->maintenance_status_id]),
            ],
            'changed_on' => ['required', 'date', 'before_or_equal:today', 'after_or_equal:'.$job->reported_on->toDateString()],
            'note' => ['nullable', 'string', 'max:2000'],
            ...$this->costRules(),
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            fn (Validator $validator) => $this->checkFinishedJobCost(
                $validator,
                MaintenanceStatus::query()->find($this->integer('maintenance_status_id')),
                $this->route('maintenanceJob'),
            ),
        ];
    }

    public function newStatus(): MaintenanceStatus
    {
        return MaintenanceStatus::query()->findOrFail($this->validated('maintenance_status_id'));
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['maintenance_status_id' => 'status', 'changed_on' => 'date', ...$this->costAttributes()];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'maintenance_status_id.not_in' => 'The job is already in this status.',
            'changed_on.after_or_equal' => 'The date cannot be before the problem was reported.',
        ];
    }
}
