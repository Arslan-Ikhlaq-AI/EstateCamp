<?php

namespace App\Http\Requests;

use App\Models\ContractLine;
use App\Models\Occupant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * Checking an occupant into the room a contract line rents. The PostgreSQL
 * exclusion constraint also refuses overlapping stays for one person; these
 * checks give a clear message first.
 */
class CheckInRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contract_line_id' => ['required', 'integer', $this->existsInCompany('contract_lines', softDeletes: false)],
            'occupant_id' => ['required', 'integer', $this->existsInCompany('occupants')],
            'check_in_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
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

                $line = ContractLine::with(['contract', 'room'])->find($this->integer('contract_line_id'));
                $occupant = Occupant::find($this->integer('occupant_id'));

                foreach ($this->problems($line, $occupant) as $field => $message) {
                    $validator->errors()->add($field, $message);
                }
            },
        ];
    }

    /**
     * Why this check-in cannot happen, by field.
     *
     * @return array<string, string>
     */
    private function problems(ContractLine $line, Occupant $occupant): array
    {
        $checkIn = $this->date('check_in_date');

        if ($line->contract->status !== 'active') {
            return ['contract_line_id' => 'Only an active contract can take check-ins.'];
        }

        if (! $line->housesOccupants()) {
            return ['contract_line_id' => 'Only rooms house occupants.'];
        }

        if (! $line->covers($checkIn)) {
            return ['check_in_date' => "This line runs from {$line->start_date->format('j M Y')} to {$line->end_date->format('j M Y')}."];
        }

        if ($occupant->client_id !== $line->contract->client_id) {
            return ['occupant_id' => "{$occupant->full_name} is registered with a different client from this contract's."];
        }

        if ($occupant->currentStay()->exists()) {
            return ['occupant_id' => "{$occupant->full_name} is already checked in. Check them out first."];
        }

        $room = $line->room;

        if ($room->status !== 'active') {
            return ['contract_line_id' => "Room {$room->room_number} is out of service."];
        }

        $staying = $room->occupancies()->whereNull('check_out_date')->count();

        if ($staying >= $room->capacity) {
            return ['contract_line_id' => "Room {$room->room_number} sleeps {$room->capacity} and {$staying} people are already staying in it."];
        }

        $policy = $room->gender_policy;

        if (in_array($policy, ['male', 'female'], true) && $policy !== $occupant->gender) {
            return ['occupant_id' => "Room {$room->room_number} is for ".($policy === 'male' ? 'men' : 'women').' only.'];
        }

        return [];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'contract_line_id' => 'contract line',
            'occupant_id' => 'occupant',
            'check_in_date' => 'check-in date',
        ];
    }
}
