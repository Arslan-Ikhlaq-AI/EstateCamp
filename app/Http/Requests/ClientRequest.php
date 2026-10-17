<?php

namespace App\Http\Requests;

use App\Models\Client;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class ClientRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'client';

    /**
     * Get the validation rules that apply to the request. Companies give a
     * trade licence; individuals give an identity document.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isIndividual = $this->input('client_type') === 'individual';

        return [
            'client_type' => ['required', Rule::in(Client::TYPES)],
            'name' => ['required', 'string', 'max:255'],
            'contact_person_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'trade_license_number' => ['nullable', 'string', 'max:255'],
            'tax_registration_number' => ['nullable', 'digits:15'],
            'id_type' => [Rule::requiredIf($isIndividual), 'nullable', Rule::in(Client::ID_TYPES)],
            'id_number' => [
                Rule::requiredIf($isIndividual), 'nullable', 'string', 'max:50',
                Rule::unique('clients')
                    ->where('company_id', $this->companyId())
                    ->where('id_type', $this->input('id_type'))
                    ->whereNull('deleted_at')
                    ->ignore($this->route('client')),
            ],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in(Client::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * The validated input. An identity document is only kept for individuals.
     *
     * @return array<string, mixed>
     */
    public function clientAttributes(): array
    {
        $attributes = $this->validated();

        if ($attributes['client_type'] === 'company') {
            $attributes['id_type'] = null;
            $attributes['id_number'] = null;
        }

        return $attributes;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_type' => 'client type',
            'tax_registration_number' => 'tax registration number',
            'id_type' => 'ID type',
            'id_number' => 'ID number',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'id_number.unique' => 'Another client already has this ID number.',
        ];
    }
}
