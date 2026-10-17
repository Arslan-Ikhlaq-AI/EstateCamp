<?php

namespace App\Http\Requests;

use App\Http\Controllers\PropertyController;
use App\Models\Property;
use App\Models\PropertyDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PropertyRequest extends FormRequest
{
    /**
     * Only members of a company can save properties, and only their own.
     * Another company's property answers 404 so its existence is not revealed.
     */
    public function authorize(): bool
    {
        $property = $this->route('property');

        if ($property instanceof Property && $property->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * Landlord and lease details only apply to leased properties.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('ownership_type') !== 'leased') {
            $this->merge([
                'landlord_name' => null,
                'landlord_phone' => null,
                'lease_start_date' => null,
                'lease_end_date' => null,
            ]);
        }

        if ($this->filled('country_code')) {
            $this->merge(['country_code' => strtoupper($this->input('country_code'))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $property = $this->route('property');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required', 'string', 'max:50',
                Rule::unique('properties')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at')
                    ->ignore($property),
            ],
            'property_type_id' => ['required', 'integer', Rule::exists('property_types', 'id')],
            'status' => ['required', Rule::in(PropertyController::STATUSES)],
            'cover_image' => ['nullable', 'image', 'max:5120'],

            'country_code' => ['required', 'regex:/^[A-Z]{2}$/'],
            'city' => ['nullable', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:255'],
            'street' => ['nullable', 'string', 'max:255'],
            'building_name' => ['nullable', 'string', 'max:255'],
            'plot_number' => ['nullable', 'string', 'max:50'],
            'makani_number' => ['nullable', 'digits:10'],
            'po_box' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'map_url' => ['nullable', 'url', 'max:2048'],

            'contact_person_name' => ['nullable', 'string', 'max:255'],
            'contact_person_phone' => ['nullable', 'string', 'max:40'],

            'ownership_type' => ['nullable', Rule::in(PropertyController::OWNERSHIP_TYPES)],
            'landlord_name' => ['nullable', 'required_if:ownership_type,leased', 'string', 'max:255'],
            'landlord_phone' => ['nullable', 'string', 'max:40'],
            'lease_start_date' => ['nullable', 'required_if:ownership_type,leased', 'date'],
            'lease_end_date' => ['nullable', 'required_if:ownership_type,leased', 'date', 'after_or_equal:lease_start_date'],

            'notes' => ['nullable', 'string', 'max:5000'],

            'documents' => ['array', 'max:20'],
            'documents.*.id' => ['nullable', 'integer'],
            'documents.*.document_type' => ['required', Rule::in(PropertyDocument::TYPES)],
            'documents.*.title' => ['nullable', 'string', 'max:255'],
            'documents.*.document_number' => ['nullable', 'string', 'max:100'],
            'documents.*.file' => ['nullable', 'required_without:documents.*.id', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'documents.*.issued_on' => ['nullable', 'date'],
            'documents.*.expires_on' => ['nullable', 'date', 'after_or_equal:documents.*.issued_on'],
            'documents.*.notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_type_id' => 'property type',
            'makani_number' => 'Makani number',
            'documents.*.document_type' => 'document type',
            'documents.*.file' => 'file',
            'documents.*.expires_on' => 'expiry date',
            'documents.*.issued_on' => 'issue date',
        ];
    }
}
