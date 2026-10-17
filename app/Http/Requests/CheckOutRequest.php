<?php

namespace App\Http\Requests;

use App\Models\Occupancy;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class CheckOutRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'occupancy';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'check_out_date' => ['required', 'date', 'before_or_equal:today'],
        ];
    }

    /**
     * The stay must still be open, and the occupant leaves at the earliest the
     * day after arriving.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var Occupancy $stay */
                $stay = $this->route('occupancy');

                if ($stay->check_out_date !== null) {
                    $validator->errors()->add('check_out_date', 'This stay has already ended.');
                } elseif ($validator->errors()->isEmpty() && ! $this->date('check_out_date')->gt($stay->check_in_date)) {
                    $validator->errors()->add('check_out_date', "Check-out must be after the check-in on {$stay->check_in_date->format('j M Y')}.");
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'check_out_date' => 'check-out date',
        ];
    }
}
