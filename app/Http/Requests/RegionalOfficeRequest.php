<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * One of the company's regional offices, added or changed on the
 * configuration page. Its name is unique within the company.
 */
class RegionalOfficeRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'regionalOffice';

    /**
     * The `is_active` switch arrives as text from the form; a code is kept in capitals.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'is_active' => $this->boolean('is_active', true),
            'code' => $this->filled('code') ? strtoupper(trim((string) $this->input('code'))) : null,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', Rule::unique('regional_offices', 'name')->where('company_id', $this->companyId())->ignore($this->route('regionalOffice'))],
            'code' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'is_active' => ['boolean'],
        ];
    }
}
