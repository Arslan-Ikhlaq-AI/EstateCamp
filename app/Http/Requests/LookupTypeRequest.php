<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * A property or room type added or changed on the configuration pages.
 * These lists are shared by every company, so only admins may change them.
 */
class LookupTypeRequest extends FormRequest
{
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
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $table = $this->routeIs('configuration.room-types.*') ? 'room_types' : 'property_types';
        $type = $this->route('roomType') ?? $this->route('propertyType');

        return [
            'name' => ['required', 'string', 'max:100', Rule::unique($table, 'name')->ignore($type instanceof Model ? $type->id : null)],
            'description' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'between:0,999'],
            'is_active' => ['boolean'],
        ];
    }
}
