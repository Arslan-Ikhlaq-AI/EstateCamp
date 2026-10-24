<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesMaintenanceCost;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\Validation\Validator;

/**
 * A maintenance job reported or corrected on its form: where the problem is,
 * what kind, who reported it and who fixes it, and what it cost. A new job
 * also takes the status it starts in; after that the status moves through
 * MaintenanceStatusChangeRequest, so its history is kept.
 */
class MaintenanceJobRequest extends CompanyScopedRequest
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
        $unitIn = fn (string $table): Exists => $this->existsInCompany($table)->where('property_id', $this->integer('property_id'));

        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'unit_type' => ['required', Rule::in(MaintenanceJob::UNIT_TYPES)],
            'room_id' => ['nullable', 'required_if:unit_type,room', 'integer', $unitIn('rooms')],
            'apartment_id' => ['nullable', 'required_if:unit_type,apartment', 'integer', $unitIn('apartments')],
            'shop_id' => ['nullable', 'required_if:unit_type,shop', 'integer', $unitIn('shops')],
            'location' => ['nullable', 'string', 'max:255'],
            'maintenance_category_id' => ['required', 'integer', $this->offered('maintenance_categories', $job?->maintenance_category_id)],
            ...($job ? [] : ['maintenance_status_id' => ['required', 'integer', $this->offered('maintenance_statuses')]]),
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'priority' => ['required', Rule::in(MaintenanceJob::PRIORITIES)],
            'reported_on' => ['required', 'date', 'before_or_equal:today'],
            'reported_by' => ['nullable', 'string', 'max:255'],
            'vendor_name' => ['nullable', 'string', 'max:255'],
            'vendor_phone' => ['nullable', 'string', 'max:40'],
            'completed_on' => ['nullable', 'date', 'before_or_equal:today', 'after_or_equal:reported_on'],
            'notes' => ['nullable', 'string', 'max:5000'],
            ...$this->costRules(),
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $job = $this->route('maintenanceJob');
                $status = $job?->status ?? MaintenanceStatus::query()->find($this->integer('maintenance_status_id'));

                $this->checkFinishedJobCost($validator, $status, $job);
            },
        ];
    }

    /**
     * The job's own details, without where it is, its status or its cost.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        return $this->safe()->only([
            'location', 'maintenance_category_id', 'title', 'description', 'priority',
            'reported_on', 'reported_by', 'vendor_name', 'vendor_phone', 'notes',
        ]);
    }

    /**
     * The room, apartment or shop the problem is in, if not the whole property.
     */
    public function unitId(): ?int
    {
        return match ($this->validated('unit_type')) {
            'room' => $this->integer('room_id'),
            'apartment' => $this->integer('apartment_id'),
            'shop' => $this->integer('shop_id'),
            default => null,
        };
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'property',
            'unit_type' => 'where the problem is',
            'room_id' => 'room',
            'apartment_id' => 'apartment',
            'shop_id' => 'shop',
            'maintenance_category_id' => 'kind of problem',
            'maintenance_status_id' => 'status',
            'reported_on' => 'date reported',
            'completed_on' => 'completion date',
            ...$this->costAttributes(),
        ];
    }

    /**
     * An `exists` rule for an entry of a configuration list that is offered
     * (switched on), or is the one the job already has.
     */
    private function offered(string $table, ?int $currentId = null): Exists
    {
        return Rule::exists($table, 'id')->where(fn ($query) => $query
            ->where('is_active', true)
            ->when($currentId, fn ($query) => $query->orWhere('id', $currentId)));
    }
}
