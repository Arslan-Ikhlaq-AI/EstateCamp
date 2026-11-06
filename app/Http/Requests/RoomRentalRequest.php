<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesExtraPayments;
use App\Models\Client;
use App\Models\Company;
use App\Models\Room;
use App\Models\RoomRental;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Renting whole rooms short-term to a company or a person without a
 * contract, or changing a rental's terms. A new rental names the renter (one
 * already on file, or a new one: a company by its name and phone with any
 * other details, a person by their name, phone and ID), the property and its
 * rooms, and whether the first month is paid now, in cash, by transfer or
 * by cheque. The commission and deposit are paid on their own. A rental has
 * no term: it runs until it is ended. Once running, only the start date,
 * rent, commission and deposit change.
 */
class RoomRentalRequest extends CompanyScopedRequest
{
    use ValidatesExtraPayments;

    protected ?string $recordParameter = 'roomRental';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $terms = [
            'start_date' => ['required', 'date'],
            'monthly_rent' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            ...$this->extraPaymentRules(),
        ];

        if ($this->route('roomRental')) {
            return $terms;
        }

        $isNewClient = $this->input('client_mode') === 'new';
        $isNewPerson = $isNewClient && $this->input('client_type') === 'individual';
        $isPaidByCheque = $this->input('first_payment') === 'now' && $this->input('payment_method') === 'cheque';

        return [
            'client_mode' => ['required', Rule::in(['existing', 'new'])],
            'client_type' => [Rule::requiredIf($isNewClient), 'nullable', Rule::in(Client::TYPES)],
            'client_id' => [Rule::requiredIf(! $isNewClient), 'nullable', 'integer', $this->existsInCompany('clients')],
            'new_client.name' => [Rule::requiredIf($isNewClient), 'nullable', 'string', 'max:255'],
            'new_client.phone' => [Rule::requiredIf($isNewClient), 'nullable', 'string', 'max:40'],
            'new_client.contact_person_name' => ['nullable', 'string', 'max:255'],
            'new_client.email' => ['nullable', 'email', 'max:255'],
            'new_client.trade_license_number' => ['nullable', 'string', 'max:255'],
            'new_client.tax_registration_number' => ['nullable', 'digits:15'],
            'new_client.id_type' => [Rule::requiredIf($isNewPerson), 'nullable', Rule::in(Client::ID_TYPES)],
            'new_client.id_number' => [
                Rule::requiredIf($isNewPerson), 'nullable', 'string', 'max:50',
                Rule::unique('clients', 'id_number')
                    ->where('company_id', $this->companyId())
                    ->where('id_type', $this->input('new_client.id_type'))
                    ->whereNull('deleted_at'),
            ],
            'new_client.nationality' => ['nullable', 'string', 'max:100'],
            'new_client.address' => ['nullable', 'string', 'max:2000'],
            'property_id' => ['required', 'integer', $this->existsInCompany('properties')],
            'room_ids' => ['required', 'array', 'min:1', 'max:200'],
            'room_ids.*' => ['integer', 'distinct'],
            ...$terms,
            'first_payment' => ['required', Rule::in(['now', 'later'])],
            'payment_method' => ['required_if:first_payment,now', 'nullable', Rule::in(RoomRental::FIRST_PAYMENT_METHODS)],
            'payment_reference' => ['nullable', 'string', 'max:100'],
            'cheque_number' => [Rule::requiredIf($isPaidByCheque), 'nullable', 'string', 'max:30'],
            'bank_name' => [Rule::requiredIf($isPaidByCheque), 'nullable', 'string', 'max:255'],
            'cheque_date' => [Rule::requiredIf($isPaidByCheque), 'nullable', 'date'],
        ];
    }

    /**
     * A new renter keeps only the details its type has: a company no
     * personal ID, a person no trade licence, TRN or contact person.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('client_mode') !== 'new' || ! is_array($this->input('new_client'))) {
            return;
        }

        $dropped = $this->input('client_type') === 'individual'
            ? ['contact_person_name', 'trade_license_number', 'tax_registration_number']
            : ['id_type', 'id_number', 'nationality'];

        $this->merge(['new_client' => [...$this->input('new_client'), ...array_fill_keys($dropped, null)]]);
    }

    /**
     * Every room of a new rental must be in the property, in service, free
     * of any contract or other rental and empty.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty() || $this->route('roomRental')) {
                    return;
                }

                foreach ($this->problems() as $field => $message) {
                    $validator->errors()->add($field, $message);
                }
            },
        ];
    }

    /**
     * Why this rental cannot start, by field.
     *
     * @return array<string, string>
     */
    private function problems(): array
    {
        $rooms = Room::query()->whereKey($this->input('room_ids'))->get(['id', 'property_id', 'room_number']);
        $free = RoomRental::roomsToRent(Company::findOrFail($this->companyId()))->modelKeys();

        if ($rooms->count() !== count($this->input('room_ids')) || $rooms->contains(fn (Room $room) => $room->property_id !== $this->integer('property_id'))) {
            return ['room_ids' => 'Choose rooms in this property.'];
        }

        $taken = $rooms->reject(fn (Room $room) => in_array($room->id, $free, true));

        if ($taken->isNotEmpty()) {
            return ['room_ids' => 'Room '.$taken->pluck('room_number')->join(', ', ' and ').' is no longer free. Choose another.'];
        }

        return [];
    }

    /**
     * The rental's terms as the model fills them.
     *
     * @return array<string, mixed>
     */
    public function terms(): array
    {
        return [
            'monthly_rent' => $this->validated('monthly_rent'),
            'security_deposit' => $this->validated('security_deposit') ?? 0,
            'start_date' => Carbon::parse($this->validated('start_date'))->toDateString(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_type' => 'renter type',
            'client_id' => 'renter',
            'new_client.name' => 'name',
            'new_client.phone' => 'phone',
            'new_client.contact_person_name' => 'contact person',
            'new_client.email' => 'email',
            'new_client.trade_license_number' => 'trade licence number',
            'new_client.tax_registration_number' => 'tax registration number',
            'new_client.id_type' => 'ID type',
            'new_client.id_number' => 'ID number',
            'new_client.nationality' => 'nationality',
            'new_client.address' => 'address',
            'property_id' => 'property',
            'room_ids' => 'rooms',
            'monthly_rent' => 'monthly rent',
            'security_deposit' => 'security deposit',
            'payment_method' => 'payment method',
            'payment_reference' => 'reference',
            'cheque_number' => 'cheque number',
            'bank_name' => 'bank',
            'cheque_date' => 'cheque date',
            ...$this->extraPaymentAttributes(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'new_client.id_number.unique' => 'A client with this ID number is already on file. Choose them as an existing person.',
        ];
    }
}
