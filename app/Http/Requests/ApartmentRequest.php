<?php

namespace App\Http\Requests;

use App\Models\Apartment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ApartmentRequest extends FormRequest
{
    /**
     * Only members of a company can save apartments, and only their own.
     * Another company's apartment answers 404 so its existence is not revealed.
     */
    public function authorize(): bool
    {
        $apartment = $this->route('apartment');

        if ($apartment instanceof Apartment && $apartment->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => [
                'required', 'integer',
                Rule::exists('properties', 'id')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at'),
            ],
            'apartment_number' => [
                'required', 'string', 'max:30',
                Rule::unique('apartments')
                    ->where('property_id', $this->integer('property_id'))
                    ->whereNull('deleted_at')
                    ->ignore($this->route('apartment')),
            ],
            'block' => ['nullable', 'string', 'max:50'],
            'floor_number' => ['nullable', 'integer', 'between:-5,200'],
            'bedrooms' => ['required', 'integer', 'between:0,20'],
            'bathrooms' => ['required', 'integer', 'between:0,20'],
            'area_sqm' => ['nullable', 'numeric', 'gt:0', 'max:10000'],
            'furnishing_status' => ['nullable', Rule::in(Apartment::FURNISHING_STATUSES)],
            'max_occupants' => ['nullable', 'integer', 'between:1,100'],
            'amenities' => ['array'],
            'amenities.*' => ['distinct', Rule::in(Apartment::AMENITIES)],
            'monthly_rent' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'utility_account_number' => ['nullable', 'string', 'max:50'],
            'status' => ['required', Rule::in(Apartment::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'property',
            'apartment_number' => 'apartment number',
            'floor_number' => 'floor',
            'max_occupants' => 'maximum occupants',
            'monthly_rent' => 'monthly rent',
            'security_deposit' => 'security deposit',
            'utility_account_number' => 'utility account number',
            'furnishing_status' => 'furnishing',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'apartment_number.unique' => 'This property already has an apartment with that number.',
        ];
    }
}
