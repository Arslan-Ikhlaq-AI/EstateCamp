<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The company profile form. Any member of the company may change it, apart
 * from its status and expiry, which are not on the form.
 */
class CompanyProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->company_id !== null;
    }

    /**
     * Country and currency codes are stored in capitals.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'country_code' => strtoupper((string) $this->input('country_code')),
            'default_currency' => strtoupper((string) $this->input('default_currency')),
            'remove_logo' => $this->boolean('remove_logo'),
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
            'name' => ['required', 'string', 'max:255'],
            'legal_name' => ['nullable', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:60'],
            'description' => ['nullable', 'string', 'max:2000'],
            'website' => ['nullable', 'url', 'max:2048'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:2048'],
            'remove_logo' => ['boolean'],
            'trade_license_number' => ['nullable', 'string', 'max:100'],
            'tax_registration_number' => ['nullable', 'digits:15'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'contact_person_name' => ['nullable', 'string', 'max:255'],
            'contact_person_phone' => ['nullable', 'string', 'max:40'],
            'contact_person_email' => ['nullable', 'email', 'max:255'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country_code' => ['required', 'string', 'size:2', 'alpha'],
            'default_currency' => ['required', 'string', 'size:3', 'alpha'],
            'timezone' => ['required', 'timezone:all'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'tax_registration_number' => 'tax registration number (TRN)',
            'country_code' => 'country',
            'default_currency' => 'currency',
        ];
    }
}
