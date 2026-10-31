<?php

namespace App\Http\Requests;

use App\Models\Contract;
use App\Models\Property;
use App\Models\RoomRental;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;

/**
 * Money collected on a property's billing tab or payments page: what a
 * contract's client or a short-term rental's renter paid today towards
 * its bill up to the end of the period on screen (`through`). A
 * short-term rental can also hand over a cheque, which goes into the
 * cheque register with its number, bank and date and counts once it is
 * submitted; a contract's cheques are set up on the contract.
 */
class BillingPaymentRequest extends CompanyScopedRequest
{
    public const METHODS = ['cash', 'bank_transfer', 'card'];

    /**
     * How a short-term rental can pay: the same ways, or by cheque.
     */
    public const RENTAL_METHODS = [...self::METHODS, 'cheque'];

    public const ACCOUNTS = ['contract', 'rental'];

    protected ?string $recordParameter = 'property';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isCheque = $this->input('method') === 'cheque';

        return [
            'account' => ['required', Rule::in(self::ACCOUNTS)],
            'account_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'method' => ['required', Rule::in($this->input('account') === 'rental' ? self::RENTAL_METHODS : self::METHODS)],
            'through' => ['required', 'date'],
            'cheque_number' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:30'],
            'bank_name' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:255'],
            'cheque_date' => [Rule::requiredIf($isCheque), 'nullable', 'date'],
        ];
    }

    /**
     * The cheque as RoomRental::receiveCheque() takes it, paying rent.
     *
     * @return array{purpose: string, cheque_date: string, amount: string, cheque_number: string, bank_name: string}
     */
    public function cheque(): array
    {
        return ['purpose' => 'rent', ...$this->safe()->only(['cheque_date', 'amount', 'cheque_number', 'bank_name'])];
    }

    /**
     * The contract renting in `$property`, or the short-term rental there,
     * that the money is for. Anything else answers 404.
     */
    public function account(Property $property): Contract|RoomRental
    {
        $id = $this->integer('account_id');

        if ($this->validated('account') === 'contract') {
            return Contract::query()
                ->where('company_id', $property->company_id)
                ->whereHas('lines', fn (Builder $lines) => $lines->where('property_id', $property->id))
                ->with('client:id,name')
                ->findOrFail($id);
        }

        return RoomRental::query()->where('property_id', $property->id)->with('client:id,name')->findOrFail($id);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['account_id' => 'account', 'through' => 'bill period', 'cheque_number' => 'cheque number', 'bank_name' => 'bank', 'cheque_date' => 'cheque date'];
    }
}
