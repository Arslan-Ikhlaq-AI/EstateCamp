<?php

namespace App\Http\Requests;

use App\Models\Occupant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class OccupantRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'occupant';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', $this->existsInCompany('clients')],
            'full_name' => ['required', 'string', 'max:255'],
            'gender' => ['required', Rule::in(Occupant::GENDERS)],
            'nationality' => ['nullable', 'string', 'max:100'],
            'id_type' => ['nullable', 'required_with:id_number', Rule::in(Occupant::ID_TYPES)],
            'id_number' => [
                'nullable', 'required_with:id_type', 'string', 'max:50',
                Rule::unique('occupants')
                    ->where('company_id', $this->companyId())
                    ->where('id_type', $this->input('id_type'))
                    ->whereNull('deleted_at')
                    ->ignore($this->route('occupant')),
            ],
            'phone' => ['nullable', 'string', 'max:40'],
            'employee_number' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Someone checked in under a client's contract must check out before
     * moving to another client.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $occupant = $this->route('occupant');

                if ($occupant instanceof Occupant
                    && $occupant->client_id !== $this->integer('client_id')
                    && $occupant->currentStay()->exists()) {
                    $validator->errors()->add('client_id', "{$occupant->full_name} is checked in under their current client's contract. Check them out first.");
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_id' => 'client',
            'full_name' => 'name',
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
            'id_number.unique' => 'Another occupant already has this ID number.',
        ];
    }
}
