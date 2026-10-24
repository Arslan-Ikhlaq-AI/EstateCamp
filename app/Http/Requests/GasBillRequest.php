<?php

namespace App\Http\Requests;

use App\Models\Contract;
use App\Models\GasBill;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Validator;

/**
 * A month's gas at one property, billed to a client whose contract does
 * not include gas: metered (two readings and a rate per unit) or a fixed
 * amount, with its VAT. A new bill names the contract, the property and the
 * month; after() checks the contract bills gas separately, runs in that
 * month, rents at that property and has no bill for that month there yet.
 * Changing a bill keeps who, where and when, and only changes the charge.
 */
class GasBillRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'gasBill';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isNew = $this->route('gasBill') === null;
        $isMetered = $this->boolean('metered');

        return [
            ...($isNew ? [
                'contract_id' => ['required', 'integer', $this->existsInCompany('contracts')],
                'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
                'month' => ['required', 'date_format:Y-m'],
            ] : []),
            'issue_date' => ['required', 'date', 'before_or_equal:today'],
            'metered' => ['required', 'boolean'],
            'previous_reading' => [$isMetered ? 'required' : 'nullable', 'numeric', 'min:0', 'max:9999999999', 'decimal:0,2'],
            'current_reading' => [$isMetered ? 'required' : 'nullable', 'numeric', 'max:9999999999', 'decimal:0,2', ...($isMetered ? ['gt:previous_reading'] : [])],
            'unit_rate' => [$isMetered ? 'required' : 'nullable', 'numeric', 'gt:0', 'max:100000', 'decimal:0,2'],
            'amount' => [$isMetered ? 'nullable' : 'required', 'numeric', 'gt:0', 'max:10000000', 'decimal:0,2'],
            'vat_rate' => ['required', 'numeric', 'between:0,100'],
            'supplier_reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'document' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'remove_document' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty() || $this->route('gasBill') !== null) {
                    return;
                }

                $contract = $this->contract();

                if ($contract->gas_included) {
                    $validator->errors()->add('contract_id', "Gas is included in the rent of {$contract->contract_number}, so it is not billed separately.");

                    return;
                }

                if ($contract->status === 'draft') {
                    $validator->errors()->add('contract_id', "{$contract->contract_number} is still a draft; bill gas once it is active.");

                    return;
                }

                $period = $this->period();

                if ($period !== null && $period[0]->gt(today()->endOfMonth())) {
                    $validator->errors()->add('month', 'Gas is billed once it has been used: choose this month or an earlier one.');

                    return;
                }

                if ($period === null) {
                    $validator->errors()->add('month', "{$contract->contract_number} does not run in that month.");

                    return;
                }

                $rentsThere = $contract->lines()
                    ->where('property_id', $this->integer('property_id'))
                    ->whereDate('start_date', '<=', $period[1])
                    ->whereDate('end_date', '>=', $period[0])
                    ->exists();

                if (! $rentsThere) {
                    $validator->errors()->add('property_id', "{$contract->contract_number} rents nothing at this property in that month.");

                    return;
                }

                $billed = $contract->gasBills()
                    ->where('property_id', $this->integer('property_id'))
                    ->whereDate('period_start', $period[0])
                    ->whereHas('invoice', fn (Builder $invoices) => $invoices->whereNot('status', 'void'))
                    ->with('invoice:id,invoice_number')
                    ->first();

                if ($billed) {
                    $validator->errors()->add('month', "That month's gas is already billed on {$billed->invoice->invoice_number}. Change that bill, or void it first.");
                }
            },
        ];
    }

    /**
     * The contract a new bill is for.
     */
    public function contract(): Contract
    {
        return Contract::query()->findOrFail($this->integer('contract_id'));
    }

    /**
     * The days of the chosen month that a new bill's contract runs.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function period(): ?array
    {
        return GasBill::periodFor($this->contract(), CarbonImmutable::createFromFormat('!Y-m', $this->input('month')));
    }

    /**
     * The bill's own fields. Metered gas costs the units used at the rate;
     * a fixed charge keeps no readings.
     *
     * @return array<string, mixed>
     */
    public function billAttributes(): array
    {
        $attributes = $this->safe()->only(['previous_reading', 'current_reading', 'unit_rate', 'amount', 'vat_rate', 'supplier_reference', 'notes']);

        if ($this->boolean('metered')) {
            $units = round((float) $attributes['current_reading'] - (float) $attributes['previous_reading'], 2);

            return [...$attributes, 'amount' => round($units * (float) $attributes['unit_rate'], 2)];
        }

        return [...$attributes, 'previous_reading' => null, 'current_reading' => null, 'unit_rate' => null];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'contract_id' => 'contract',
            'property_id' => 'property',
            'issue_date' => 'invoice date',
            'previous_reading' => 'previous reading',
            'current_reading' => 'current reading',
            'unit_rate' => 'rate per unit',
            'vat_rate' => 'VAT rate',
            'supplier_reference' => 'supplier bill number',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'current_reading.gt' => 'The current reading must be higher than the previous one.',
        ];
    }
}
