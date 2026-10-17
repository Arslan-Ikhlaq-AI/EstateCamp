<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

class ContractTerminationRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'contract';

    /**
     * Get the validation rules that apply to the request. Termination takes
     * effect today or on a past date, since occupants check out on it.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'terminated_on' => ['required', 'date', 'before_or_equal:today'],
            'termination_reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'terminated_on' => 'termination date',
            'termination_reason' => 'reason',
        ];
    }
}
