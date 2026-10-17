<?php

namespace App\Http\Requests;

use App\Models\Apartment;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Room;
use App\Models\Shop;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A contract with its lines. Besides the field rules, after() checks that
 * every unit is in the line's property and is not already let to another
 * live contract for the same days.
 */
class ContractRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'contract';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', $this->existsInCompany('clients')],
            'ejari_number' => ['nullable', 'string', 'max:50'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'billing_cycle' => ['required', Rule::in(array_keys(Contract::BILLING_CYCLES))],
            'payment_terms_days' => ['required', 'integer', 'between:0,120'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
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
        ];
    }

    /**
     * Only bed lines rent several units or bill on actual use, and each line
     * keeps only the unit column its type uses.
     */
    protected function prepareForValidation(): void
    {
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
            },
        ];
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
            'billing_cycle' => 'billing cycle',
            'payment_terms_days' => 'payment terms',
            'lines.*.unit_type' => 'unit type',
            'lines.*.property_id' => 'property',
            'lines.*.room_id' => 'room',
            'lines.*.apartment_id' => 'apartment',
            'lines.*.shop_id' => 'shop',
            'lines.*.monthly_rate' => 'monthly rate',
            'lines.*.vat_rate' => 'VAT rate',
            'lines.*.start_date' => 'line start date',
            'lines.*.end_date' => 'line end date',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lines.required' => 'Add at least one line saying what the client rents.',
            'lines.*.start_date.after_or_equal' => 'A line cannot start before the contract.',
            'lines.*.end_date.before_or_equal' => 'A line cannot run past the end of the contract.',
        ];
    }
}
