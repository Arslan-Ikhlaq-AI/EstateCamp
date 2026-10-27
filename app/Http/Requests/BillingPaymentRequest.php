<?php

namespace App\Http\Requests;

use App\Models\Contract;
use App\Models\Property;
use App\Models\RoomRental;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;

/**
 * Money collected on a property's billing tab: what a contract's client or
 * a short-term rental's company paid today towards its bill up to the end
 * of the period on screen (`through`). Cheques go through the cheque
 * register instead, where they wait to clear.
 */
class BillingPaymentRequest extends CompanyScopedRequest
{
    public const METHODS = ['cash', 'bank_transfer', 'card'];

    public const ACCOUNTS = ['contract', 'rental'];

    protected ?string $recordParameter = 'property';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'account' => ['required', Rule::in(self::ACCOUNTS)],
            'account_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'method' => ['required', Rule::in(self::METHODS)],
            'through' => ['required', 'date'],
        ];
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
        return ['account_id' => 'account', 'through' => 'bill period'];
    }
}
