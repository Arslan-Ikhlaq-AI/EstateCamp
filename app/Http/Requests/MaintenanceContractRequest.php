<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesChequeSchedule;
use App\Models\MaintenanceContract;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * An annual maintenance contract added or corrected on its form: the
 * property and contractor, the term and value, the visits and what they
 * cover, the certificate it keeps valid, the signed copy and the cheques
 * written to the contractor. A new contract starts active; cancelling one
 * is a change of status on its edit form. The cheques' details can follow
 * once they are written.
 */
class MaintenanceContractRequest extends CompanyScopedRequest
{
    use ValidatesChequeSchedule;

    protected ?string $recordParameter = 'maintenanceContract';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isEditing = $this->route('maintenanceContract') !== null;

        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'renewed_from_id' => ['nullable', 'integer', $this->existsInCompany('maintenance_contracts')->where('service', $this->service())],
            'vendor_name' => ['required', 'string', 'max:255'],
            'vendor_contact_person' => ['nullable', 'string', 'max:255'],
            'vendor_phone' => ['nullable', 'string', 'max:40'],
            'vendor_email' => ['nullable', 'email', 'max:255'],
            'vendor_licence_number' => ['nullable', 'string', 'max:100'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'contract_value' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'payment_terms' => ['required', Rule::in(MaintenanceContract::PAYMENT_TERMS)],
            ...($isEditing ? ['status' => ['required', Rule::in(MaintenanceContract::STATUSES)]] : []),
            'visit_frequency' => ['required', Rule::in(array_keys(MaintenanceContract::VISIT_FREQUENCIES))],
            'last_visit_on' => ['nullable', 'date', 'before_or_equal:today', 'after_or_equal:start_date'],
            'response_time_hours' => ['nullable', 'integer', 'between:1,720'],
            'visit_alert_days' => ['nullable', 'integer', Rule::in(MaintenanceContract::VISIT_ALERT_DAYS)],
            'coverage' => ['required', 'array', 'min:1'],
            'coverage.*' => ['distinct', Rule::in(MaintenanceContract::COVERAGE[$this->service()])],
            'certificate_number' => ['nullable', 'string', 'max:100'],
            'certificate_expires_on' => ['nullable', 'date'],
            'document' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'remove_document' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
            ...$this->chequeRules(),
        ];
    }

    /**
     * A property has one running contract of each kind at a time, so a new
     * term may not overlap another that is not cancelled.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty() || $this->input('status') === 'cancelled') {
                    return;
                }

                $overlapping = MaintenanceContract::query()
                    ->where('company_id', $this->companyId())
                    ->where('service', $this->service())
                    ->where('property_id', $this->integer('property_id'))
                    ->where('status', 'active')
                    ->when($this->route('maintenanceContract'), fn ($query, MaintenanceContract $contract) => $query->whereKeyNot($contract->id))
                    ->whereDate('start_date', '<=', $this->date('end_date'))
                    ->whereDate('end_date', '>=', $this->date('start_date'))
                    ->first();

                if ($overlapping) {
                    $validator->errors()->add('start_date', "This property is already covered by {$overlapping->contract_number} from {$overlapping->start_date->format('j M Y')} to {$overlapping->end_date->format('j M Y')}.");
                }
            },
        ];
    }

    /**
     * The kind of contract: the record's own, or the one its page adds.
     */
    public function service(): string
    {
        return $this->route('maintenanceContract')?->service ?? $this->route('service');
    }

    /**
     * The contract's own details, with what it covers in the form's order.
     * Without an alert window, a new contract takes the default and an
     * existing one keeps its own.
     *
     * @return array<string, mixed>
     */
    public function details(): array
    {
        return array_filter([
            ...$this->safe()->except(['property_id', 'renewed_from_id', 'document', 'remove_document', 'cheques']),
            'coverage' => array_values(array_intersect(MaintenanceContract::COVERAGE[$this->service()], $this->validated('coverage'))),
        ], fn (mixed $value, string $key) => $key !== 'visit_alert_days' || $value !== null, ARRAY_FILTER_USE_BOTH);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'property',
            'vendor_name' => 'contractor',
            'vendor_email' => 'contractor email',
            'vendor_licence_number' => 'contractor approval number',
            'contract_value' => 'contract value',
            'payment_terms' => 'payment terms',
            'visit_frequency' => 'visit frequency',
            'last_visit_on' => 'last visit',
            'response_time_hours' => 'response time',
            'visit_alert_days' => 'visit alert',
            'coverage' => 'systems covered',
            'coverage.*' => 'system covered',
            'certificate_expires_on' => 'certificate expiry',
            ...$this->chequeAttributes(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'coverage.required' => 'Choose at least one system the contract covers.',
        ];
    }
}
