<?php

namespace App\Http\Requests;

use App\Models\ChequeStatus;
use App\Models\MaintenanceStatus;
use App\Models\StaffMember;
use App\Models\StaffRole;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * A type added or changed on the configuration pages: a property or room
 * type, a maintenance status or category, a cheque status, or a staff role.
 * These lists are shared by every company, so only admins may change them.
 */
class LookupTypeRequest extends FormRequest
{
    /**
     * Each list's table and the route parameter holding the type being changed, by route name.
     */
    private const LISTS = [
        'configuration.property-types.*' => ['property_types', 'propertyType'],
        'configuration.room-types.*' => ['room_types', 'roomType'],
        'configuration.maintenance-statuses.*' => ['maintenance_statuses', 'maintenanceStatus'],
        'configuration.maintenance-categories.*' => ['maintenance_categories', 'maintenanceCategory'],
        'configuration.cheque-statuses.*' => ['cheque_statuses', 'chequeStatus'],
        'configuration.staff-roles.*' => ['staff_roles', 'staffRole'],
    ];

    public function authorize(): bool
    {
        return Gate::allows('manage-configuration');
    }

    /**
     * The `is_active` switch arrives as text from the form.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['is_active' => $this->boolean('is_active', true)]);

        if ($this->routeIs('configuration.staff-roles.*')) {
            $this->merge(['app_access' => $this->boolean('app_access')]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        [$table, $parameter] = collect(self::LISTS)->first(fn (array $list, string $routeName) => $this->routeIs($routeName), self::LISTS['configuration.property-types.*']);
        $type = $this->route($parameter);

        $rules = [
            'name' => ['required', 'string', 'max:100', Rule::unique($table, 'name')->ignore($type instanceof Model ? $type->id : null)],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'between:0,999'],
            'is_active' => ['boolean'],
        ];

        if ($table === 'maintenance_statuses') {
            $rules['stage'] = ['required', Rule::in(MaintenanceStatus::STAGES)];
            $rules['color'] = ['required', Rule::in(MaintenanceStatus::COLORS)];
        }

        if ($table === 'cheque_statuses') {
            $rules['stage'] = ['required', Rule::in(ChequeStatus::STAGES), $this->keepsChequeStage($type)];
            $rules['color'] = ['required', Rule::in(ChequeStatus::COLORS)];
        }

        if ($table === 'staff_roles') {
            $rules['level'] = ['required', Rule::in(StaffRole::LEVELS)];
            $rules['staff_access'] = ['required', Rule::in(StaffMember::ACCESS_LEVELS)];
            $rules['app_access'] = ['boolean'];
        }

        return $rules;
    }

    /**
     * A cheque status keeps its stage while cheques are in it, since a
     * cheque's status must always be one of its stage, and while it is the
     * only status cheques can enter its stage with.
     */
    private function keepsChequeStage(mixed $status): Closure
    {
        return function (string $attribute, mixed $stage, Closure $fail) use ($status) {
            if (! $status instanceof ChequeStatus || $stage === $status->stage) {
                return;
            }

            if ($status->cheques()->exists()) {
                $fail('Cheques are in this status, so what it means cannot change. Add a new status instead.');
            } elseif (! ChequeStatus::query()->where('stage', $status->stage)->whereKeyNot($status->id)->exists()) {
                $fail('This is the only status for what it means now. Add another one for that first.');
            }
        };
    }
}
