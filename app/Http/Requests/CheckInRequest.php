<?php

namespace App\Http\Requests;

use App\Models\Bed;
use App\Models\ContractLine;
use App\Models\Occupant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * Checking an occupant into a bed under a contract line. The PostgreSQL
 * exclusion constraints also refuse overlapping stays; these checks give a
 * clear message first.
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
            'bed_id' => ['required', 'integer', 'exists:beds,id'],
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
                $bed = Bed::with('room')->find($this->integer('bed_id'));

                foreach ($this->problems($line, $occupant, $bed) as $field => $message) {
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
    private function problems(ContractLine $line, Occupant $occupant, Bed $bed): array
    {
        $checkIn = $this->date('check_in_date');

        if ($line->contract->status !== 'active') {
            return ['contract_line_id' => 'Only an active contract can take check-ins.'];
        }

        if (! $line->housesOccupants()) {
            return ['contract_line_id' => 'Only bed and room lines house occupants.'];
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

        if ($line->occupancies()->whereNull('check_out_date')->count() >= $line->bedCapacity()) {
            return ['contract_line_id' => "All {$line->bedCapacity()} beds on this line are taken."];
        }

        if (! $line->availableBeds()->contains('id', $bed->id)) {
            return ['bed_id' => 'This bed is taken, out of service, or not part of this contract line.'];
        }

        $policy = $bed->room->gender_policy;

        if (in_array($policy, ['male', 'female'], true) && $policy !== $occupant->gender) {
            return ['bed_id' => "Room {$bed->room->room_number} is for ".($policy === 'male' ? 'men' : 'women').' only.'];
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
            'bed_id' => 'bed',
            'check_in_date' => 'check-in date',
        ];
    }
}
