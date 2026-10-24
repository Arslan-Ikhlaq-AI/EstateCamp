<?php

namespace App\Http\Requests;

use App\Models\RoomRental;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A tenant moving out: the day they leave, any deposit handed back and how.
 */
class RoomRentalEndRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'roomRental';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rental = $this->route('roomRental');

        return [
            'moved_out_on' => ['required', 'date', 'after:'.$rental->start_date->toDateString(), 'before_or_equal:'.today()->addDays(60)->toDateString()],
            'deposit_refunded' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
            'deposit_refund_method' => ['nullable', 'required_with:deposit_refunded', Rule::in(RoomRental::REFUND_METHODS)],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->route('roomRental')->isActive()) {
                    $validator->errors()->add('moved_out_on', 'This rental has already ended.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['moved_out_on' => 'move-out date', 'deposit_refunded' => 'deposit handed back', 'deposit_refund_method' => 'refund method'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['moved_out_on.after' => 'The tenant can move out from the day after the rental started.'];
    }
}
