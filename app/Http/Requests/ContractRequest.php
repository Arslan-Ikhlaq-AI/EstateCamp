<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesChequeSchedule;
use App\Models\Apartment;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Room;
use App\Models\Shop;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A contract with its lines and its cheque schedule. Besides the field
 * rules, after() checks that every unit is in the line's property and is not
 * already let to another live contract for the same days, and that this
 * year's cheques are in hand.
 */
class ContractRequest extends CompanyScopedRequest
{
    use ValidatesChequeSchedule;

    protected ?string $recordParameter = 'contract';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_mode' => ['required', Rule::in(['existing', 'new'])],
            'client_id' => ['nullable', 'required_if:client_mode,existing', 'integer', $this->existsInCompany('clients')],
            ...$this->newClientRules(),
            'ejari_number' => ['nullable', 'string', 'max:50'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'billing_cycle' => ['required', Rule::in(array_keys(Contract::BILLING_CYCLES))],
            'payment_terms_days' => ['required', 'integer', 'between:0,120'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'gas_included' => ['sometimes', 'boolean'],
            'signed_on' => ['nullable', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.id' => ['nullable', 'integer'],
            'lines.*.unit_type' => ['required', Rule::in(ContractLine::UNIT_TYPES)],
            'lines.*.property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'lines.*.room_id' => ['nullable', 'required_if:lines.*.unit_type,room', 'integer'],
            'lines.*.apartment_id' => ['nullable', 'required_if:lines.*.unit_type,apartment', 'integer'],
            'lines.*.shop_id' => ['nullable', 'required_if:lines.*.unit_type,shop', 'integer'],
            'lines.*.quantity' => ['required', 'integer', 'between:1,500'],
            'lines.*.monthly_rate' => ['required', 'numeric', 'min:0', 'max:10000000'],
            'lines.*.billing_basis' => ['required', Rule::in(ContractLine::BILLING_BASES)],
            'lines.*.vat_rate' => ['required', 'numeric', 'between:0,100'],
            'lines.*.start_date' => ['required', 'date', 'after_or_equal:start_date', 'before_or_equal:end_date'],
            'lines.*.end_date' => ['required', 'date', 'after_or_equal:lines.*.start_date', 'before_or_equal:end_date'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'documents' => ['array', 'max:20'],
            'documents.*.id' => ['nullable', 'integer'],
            'documents.*.document_type' => ['required', Rule::in(ContractDocument::TYPES)],
            'documents.*.title' => ['nullable', 'string', 'max:255'],
            'documents.*.document_number' => ['nullable', 'string', 'max:100'],
            'documents.*.file' => ['nullable', 'required_without:documents.*.id', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'documents.*.issued_on' => ['nullable', 'date'],
            'documents.*.expires_on' => ['nullable', 'date', 'after_or_equal:documents.*.issued_on'],
            'documents.*.notes' => ['nullable', 'string', 'max:2000'],
            ...$this->chequeRules(),
        ];
    }

    /**
     * A client added from the contract form: a company with its trade
     * licence, or a person with their ID, as on the client form.
     *
     * @return array<string, array<mixed>>
     */
    private function newClientRules(): array
    {
        $isNew = $this->input('client_mode') === 'new';
        $isIndividual = $isNew && $this->input('new_client.client_type') === 'individual';

        return [
            'new_client' => ['nullable', 'array'],
            'new_client.client_type' => [Rule::requiredIf($isNew), 'nullable', Rule::in(Client::TYPES)],
            'new_client.name' => [Rule::requiredIf($isNew), 'nullable', 'string', 'max:255'],
            'new_client.contact_person_name' => ['nullable', 'string', 'max:255'],
            'new_client.phone' => ['nullable', 'string', 'max:40'],
            'new_client.email' => ['nullable', 'email', 'max:255'],
            'new_client.trade_license_number' => ['nullable', 'string', 'max:255'],
            'new_client.id_type' => [Rule::requiredIf($isIndividual), 'nullable', Rule::in(Client::ID_TYPES)],
            'new_client.id_number' => [
                Rule::requiredIf($isIndividual), 'nullable', 'string', 'max:50',
                Rule::unique('clients', 'id_number')
                    ->where('company_id', $this->companyId())
                    ->where('id_type', $this->input('new_client.id_type'))
                    ->whereNull('deleted_at'),
            ],
        ];
    }

    /**
     * The contract either picks one of the company's clients (`existing`, the
     * default) or brings the details of a new one (`new`). Only bed lines
     * rent several units or bill on actual use, and each line keeps only the
     * unit column its type uses.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('client_mode') === 'new') {
            $client = (array) $this->input('new_client', []);
            $isCompany = ($client['client_type'] ?? null) === 'company';

            // A company has no personal ID and a person no trade licence, so the form's leftovers for the other type are dropped.
            $this->merge([
                'client_id' => null,
                'new_client' => [
                    ...$client,
                    ...($isCompany ? ['id_type' => null, 'id_number' => null] : ['trade_license_number' => null]),
                ],
            ]);
        } else {
            $this->merge(['client_mode' => 'existing', 'new_client' => null]);
        }

        $lines = collect($this->input('lines', []))->map(function (mixed $line) {
            if (! is_array($line)) {
                return $line;
            }

            $type = $line['unit_type'] ?? null;

            if ($type !== 'bed') {
                $line['quantity'] = 1;
                $line['billing_basis'] = 'contracted';
            }

            foreach (['room' => 'room_id', 'apartment' => 'apartment_id', 'shop' => 'shop_id'] as $unitType => $column) {
                if ($type !== $unitType && ! ($type === 'bed' && $column === 'room_id')) {
                    $line[$column] = null;
                }
            }

            return $line;
        });

        $this->merge(['lines' => $lines->all()]);
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                foreach ($this->input('lines') as $index => $line) {
                    if ($this->checkUnitIsInProperty($validator, $index, $line)) {
                        $this->checkUnitIsFree($validator, $index, $line);
                    }
                }

                // A draft is saved before the cheques are handed over; a running contract needs this year's.
                if ($validator->errors()->isEmpty() && $this->route('contract')?->status === 'active') {
                    $this->checkChequesDueNow($validator, $this->plannedContract(), $this->route('contract'));
                }
            },
        ];
    }

    /**
     * The contract as this form would leave it, unsaved, to plan its cheques.
     */
    private function plannedContract(): Contract
    {
        $contract = new Contract($this->only(['start_date', 'end_date', 'billing_cycle', 'security_deposit']));
        $contract->setRelation('lines', collect($this->input('lines'))->map(
            fn (array $line) => new ContractLine(Arr::only($line, ['quantity', 'monthly_rate', 'vat_rate', 'start_date', 'end_date'])),
        ));

        return $contract;
    }

    /**
     * @param  array<string, mixed>  $line
     */
    private function checkUnitIsInProperty(Validator $validator, int $index, array $line): bool
    {
        $unit = $this->unitFor($line);

        if ($unit === false || $unit !== null) {
            return true;
        }

        $column = $this->unitColumn($line['unit_type']);
        $validator->errors()->add("lines.{$index}.{$column}", 'Choose a unit in the selected property.');

        return false;
    }

    /**
     * No other live contract may hold the same apartment, shop or whole room
     * for overlapping days, and bed lines in a room may not add up to more
     * beds than it has.
     *
     * @param  array<string, mixed>  $line
     */
    private function checkUnitIsFree(Validator $validator, int $index, array $line): bool
    {
        $type = $line['unit_type'];
        $column = $this->unitColumn($type);

        // A bed line for anywhere in the property names no unit to clash over.
        if ($column === null || $line[$column] === null) {
            return true;
        }

        $others = fn () => ContractLine::query()
            ->whereDate('start_date', '<=', $line['end_date'])
            ->whereDate('end_date', '>=', $line['start_date'])
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->when($this->route('contract'), fn (Builder $query, Contract $contract) => $query->whereNot('contract_id', $contract->id))
            ->with('contract:id,contract_number');

        if (in_array($type, ['apartment', 'shop'], true)) {
            $taken = $others()->where($column, $line[$column])->first();
        } else {
            // A room is taken when another contract rents it whole, or (for a whole-room line) has any of its beds.
            $taken = $others()->where('room_id', $line['room_id'])
                ->when($type === 'bed', fn (Builder $query) => $query->where('unit_type', 'room'))
                ->first();
        }

        if ($taken) {
            $validator->errors()->add("lines.{$index}.{$column}", "Already let under {$taken->contract->contract_number} until {$taken->end_date->format('j M Y')}.");

            return false;
        }

        if ($type === 'bed') {
            $room = Room::find($line['room_id']);
            $booked = (int) $others()->where('unit_type', 'bed')->where('room_id', $room->id)->sum('quantity');

            if ($booked + (int) $line['quantity'] > $room->capacity) {
                $free = max(0, $room->capacity - $booked);
                $validator->errors()->add("lines.{$index}.quantity", "Room {$room->room_number} has {$room->capacity} beds and {$booked} are already let; at most {$free} are free.");

                return false;
            }
        }

        return true;
    }

    /**
     * The line's unit if it belongs to the line's property, null if it does
     * not, or false when the line names no unit (a bed line for anywhere in
     * the property).
     *
     * @param  array<string, mixed>  $line
     */
    private function unitFor(array $line): Room|Apartment|Shop|false|null
    {
        $column = $this->unitColumn($line['unit_type']);

        if ($column === null || $line[$column] === null) {
            return false;
        }

        $model = match ($column) {
            'room_id' => Room::class,
            'apartment_id' => Apartment::class,
            'shop_id' => Shop::class,
        };

        return $model::query()->whereKey($line[$column])->where('property_id', $line['property_id'])->first();
    }

    private function unitColumn(string $type): ?string
    {
        return match ($type) {
            'bed', 'room' => 'room_id',
            'apartment' => 'apartment_id',
            'shop' => 'shop_id',
            default => null,
        };
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_id' => 'client',
            'new_client.client_type' => 'client type',
            'new_client.name' => 'client name',
            'new_client.email' => 'client email',
            'new_client.id_type' => 'ID type',
            'new_client.id_number' => 'ID number',
            'documents.*.document_type' => 'document type',
            'documents.*.file' => 'file',
            'documents.*.expires_on' => 'expiry date',
            'billing_cycle' => 'billing cycle',
            'payment_terms_days' => 'payment terms',
            'gas_included' => 'gas',
            'lines.*.unit_type' => 'unit type',
            'lines.*.property_id' => 'property',
            'lines.*.room_id' => 'room',
            'lines.*.apartment_id' => 'apartment',
            'lines.*.shop_id' => 'shop',
            'lines.*.monthly_rate' => 'monthly rate',
            'lines.*.vat_rate' => 'VAT rate',
            'lines.*.start_date' => 'line start date',
            'lines.*.end_date' => 'line end date',
            ...$this->chequeAttributes(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'documents.*.file.required_without' => 'Upload the file.',
            'lines.required' => 'Add at least one line saying what the client rents.',
            'lines.*.start_date.after_or_equal' => 'A line cannot start before the contract.',
            'lines.*.end_date.before_or_equal' => 'A line cannot run past the end of the contract.',
        ];
    }
}
