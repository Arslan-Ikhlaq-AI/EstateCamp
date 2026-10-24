<?php

namespace App\Http\Requests;

use App\Models\Bed;
use App\Models\Client;
use App\Models\Occupant;
use App\Models\RoomRental;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Renting a bed or a whole room to an individual without a contract, or
 * changing a rental's terms. A new rental names the tenant (an individual
 * client already on file, or a new one) and the bed they take; once
 * running, only the rent, deposit, end date and notes change.
 */
class RoomRentalRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'roomRental';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $terms = [
            'monthly_rent' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];

        if ($this->route('roomRental')) {
            return $terms;
        }

        $isNewTenant = $this->input('client_mode') === 'new';

        return [
            'client_mode' => ['required', Rule::in(['existing', 'new'])],
            'client_id' => [Rule::requiredIf(! $isNewTenant), 'nullable', 'integer', $this->existsInCompany('clients')],
            'new_client.name' => [Rule::requiredIf($isNewTenant), 'nullable', 'string', 'max:255'],
            'new_client.phone' => [Rule::requiredIf($isNewTenant), 'nullable', 'string', 'max:40'],
            'new_client.email' => ['nullable', 'email', 'max:255'],
            'new_client.nationality' => ['nullable', 'string', 'max:100'],
            'new_client.id_type' => [Rule::requiredIf($isNewTenant), 'nullable', Rule::in(Client::ID_TYPES)],
            'new_client.id_number' => [
                Rule::requiredIf($isNewTenant), 'nullable', 'string', 'max:50',
                Rule::unique('clients', 'id_number')
                    ->where('company_id', $this->companyId())
                    ->where('id_type', $this->input('new_client.id_type'))
                    ->whereNull('deleted_at'),
            ],
            'gender' => ['required', Rule::in(Occupant::GENDERS)],
            'unit_type' => ['required', Rule::in(RoomRental::UNIT_TYPES)],
            'bed_id' => ['required', 'integer'],
            ...$terms,
        ];
    }

    /**
     * The tenant must be an individual not staying anywhere else, and the
     * bed must be free in a room open to individuals (all of it free for a
     * whole-room rental) that accepts the tenant's gender.
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
        if ($this->input('client_mode') === 'existing') {
            $client = Client::query()->find($this->integer('client_id'));

            if ($client->client_type !== 'individual') {
                return ['client_id' => "{$client->name} is a company. Companies rent under a contract."];
            }

            if (Occupant::query()->where('client_id', $client->id)->whereHas('currentStay')->exists()) {
                return ['client_id' => "{$client->name} is already staying in one of your beds. Check them out first."];
            }
        }

        $bed = Bed::query()->with('room')->find($this->integer('bed_id'));
        $room = $bed?->room;

        if ($room === null || $room->company_id !== $this->companyId()) {
            return ['bed_id' => 'Choose a bed in one of your rooms.'];
        }

        if ($room->status !== 'active' || ! $bed->is_active) {
            return ['bed_id' => "Room {$room->room_number} is not open for new tenants right now."];
        }

        if (in_array($room->id, RoomRental::unavailableRoomIds($this->companyId()), true)) {
            return ['bed_id' => "Room {$room->room_number} is rented under a contract or by another tenant."];
        }

        $taken = $room->beds()->whereHas('occupancies', fn ($stays) => $stays->whereNull('check_out_date'));

        if ($this->input('unit_type') === 'room' && $taken->exists()) {
            return ['bed_id' => "Someone is already staying in room {$room->room_number}, so it cannot be rented whole."];
        }

        if ((clone $taken)->whereKey($bed->id)->exists()) {
            return ['bed_id' => "Bed {$bed->label} in room {$room->room_number} is taken."];
        }

        $policy = $room->gender_policy;

        if (in_array($policy, ['male', 'female'], true) && $policy !== $this->tenantGender()) {
            return ['bed_id' => "Room {$room->room_number} is for ".($policy === 'male' ? 'men' : 'women').' only.'];
        }

        return [];
    }

    /**
     * The tenant's gender: as on file for someone who has stayed before,
     * otherwise as entered.
     */
    public function tenantGender(): string
    {
        $onFile = $this->input('client_mode') === 'existing'
            ? Occupant::query()->where('client_id', $this->integer('client_id'))->orderBy('id')->value('gender')
            : null;

        return $onFile ?? $this->input('gender');
    }

    /**
     * The rental's terms as the model fills them.
     *
     * @return array<string, mixed>
     */
    public function terms(): array
    {
        return [
            ...$this->safe()->only(['monthly_rent', 'start_date', 'end_date', 'notes']),
            'security_deposit' => $this->validated('security_deposit') ?? 0,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_id' => 'tenant',
            'new_client.name' => 'name',
            'new_client.phone' => 'phone',
            'new_client.email' => 'email',
            'new_client.id_type' => 'ID type',
            'new_client.id_number' => 'ID number',
            'bed_id' => 'bed',
            'monthly_rent' => 'monthly rent',
            'security_deposit' => 'security deposit',
            'end_date' => 'end date',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'new_client.id_number.unique' => 'Another client already has this ID number. Choose them as an existing tenant instead.',
        ];
    }
}
