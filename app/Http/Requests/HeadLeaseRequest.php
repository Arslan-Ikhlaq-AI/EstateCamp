<?php

namespace App\Http\Requests;

use App\Models\HeadLease;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class HeadLeaseRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'head_lease';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'landlord_id' => ['required', 'integer', $this->existsInCompany('landlords')],
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
            'payments_per_year' => 'payments a year',
            'notice_period_days' => 'notice period',
        ];
    }
}
