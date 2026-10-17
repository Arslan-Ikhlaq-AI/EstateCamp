<?php

namespace App\Http\Requests;

use App\Models\Landlord;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class LandlordRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'landlord';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'landlord_type' => ['required', Rule::in(Landlord::TYPES)],
            'name' => ['required', 'string', 'max:255'],
            'contact_person_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'trade_license_number' => ['nullable', 'string', 'max:255'],
            'id_number' => ['nullable', 'string', 'max:50'],
            'tax_registration_number' => ['nullable', 'digits:15'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'account_name' => ['nullable', 'string', 'max:255'],
            'iban' => ['nullable', 'regex:/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/'],
            'address' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Store the IBAN without spaces and in capitals, as banks print it in groups.
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('iban')) {
            $this->merge(['iban' => strtoupper(preg_replace('/\s+/', '', (string) $this->input('iban')))]);
        }
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'landlord_type' => 'landlord type',
            'tax_registration_number' => 'tax registration number',
            'iban' => 'IBAN',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'iban.regex' => 'Enter a valid IBAN, such as AE07 0331 2345 6789 0123 456.',
        ];
    }
}
