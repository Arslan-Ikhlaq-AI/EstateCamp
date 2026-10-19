<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesChequeSchedule;
use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\PropertyDocument;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class HeadLeaseRequest extends CompanyScopedRequest
{
    use ValidatesChequeSchedule;

    protected ?string $recordParameter = 'head_lease';

    /**
     * The lease either picks one of the company's landlords (`existing`, the
     * default) or brings the details of a new one (`new`).
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('landlord_mode') === 'new') {
            $this->merge(['landlord_id' => null]);
        } else {
            $this->merge(['landlord_mode' => 'existing', 'new_landlord' => null]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'landlord_mode' => ['required', Rule::in(['existing', 'new'])],
            'landlord_id' => ['nullable', 'required_if:landlord_mode,existing', 'integer', $this->existsInCompany('landlords')],
            'new_landlord' => ['nullable', 'array'],
            'new_landlord.landlord_type' => ['required_if:landlord_mode,new', Rule::in(Landlord::TYPES)],
            'new_landlord.name' => ['required_if:landlord_mode,new', 'nullable', 'string', 'max:255'],
            'new_landlord.contact_person_name' => ['nullable', 'string', 'max:255'],
            'new_landlord.phone' => ['nullable', 'string', 'max:40'],
            'new_landlord.email' => ['nullable', 'email', 'max:255'],
            'renewed_from_id' => ['nullable', 'integer', $this->existsInCompany('head_leases')],
            'ejari_number' => ['nullable', 'string', 'max:50'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'annual_rent' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'payments_per_year' => ['required', 'integer', Rule::in(HeadLease::PAYMENTS_PER_YEAR)],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'notice_period_days' => ['nullable', 'integer', 'between:0,730'],
            'status' => ['required', Rule::in(HeadLease::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
            'documents' => ['array', 'max:20'],
            'documents.*.document_type' => ['required', Rule::in(PropertyDocument::TYPES)],
            'documents.*.title' => ['nullable', 'string', 'max:255'],
            'documents.*.document_number' => ['nullable', 'string', 'max:100'],
            'documents.*.file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'documents.*.issued_on' => ['nullable', 'date'],
            'documents.*.expires_on' => ['nullable', 'date', 'after_or_equal:documents.*.issued_on'],
            'documents.*.notes' => ['nullable', 'string', 'max:2000'],
            ...$this->chequeRules(),
        ];
    }

    /**
     * A property can only be under one live lease at a time; the database
     * enforces the same rule on PostgreSQL.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty() || $this->input('status') === 'terminated') {
                    return;
                }

                $overlapping = HeadLease::query()
                    ->where('property_id', $this->integer('property_id'))
                    ->whereNot('status', 'terminated')
                    ->when($this->route('head_lease'), fn ($query, HeadLease $lease) => $query->whereKeyNot($lease->id))
                    ->whereDate('start_date', '<=', $this->date('end_date'))
                    ->whereDate('end_date', '>=', $this->date('start_date'))
                    ->first();

                if ($overlapping) {
                    $validator->errors()->add('start_date', "This property is already under lease {$overlapping->lease_number} from {$overlapping->start_date->format('j M Y')} to {$overlapping->end_date->format('j M Y')}.");
                }
            },
            function (Validator $validator) {
                // A draft lease is saved before the cheques are written; an active one needs this year's.
                if ($validator->errors()->isEmpty() && $this->input('status') === 'active') {
                    $this->checkChequesDueNow(
                        $validator,
                        new HeadLease($this->only(['start_date', 'end_date', 'annual_rent', 'payments_per_year', 'security_deposit'])),
                        $this->route('head_lease'),
                    );
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
            'property_id' => 'property',
            'landlord_id' => 'landlord',
            'new_landlord.landlord_type' => 'landlord type',
            'new_landlord.name' => 'landlord name',
            'new_landlord.email' => 'landlord email',
            'documents.*.document_type' => 'document type',
            'documents.*.file' => 'file',
            'documents.*.expires_on' => 'expiry date',
            'payments_per_year' => 'payments a year',
            'notice_period_days' => 'notice period',
            ...$this->chequeAttributes(),
        ];
    }
}
