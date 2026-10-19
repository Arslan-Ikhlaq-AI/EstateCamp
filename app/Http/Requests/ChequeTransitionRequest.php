<?php

namespace App\Http\Requests;

use App\Models\Cheque;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * What happened to a cheque: deposited, cleared, bounced, handed back or
 * cancelled, and when. Only the moves its direction and status allow.
 */
class ChequeTransitionRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'cheque';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(Cheque::ACTIONS)],
            'date' => [Rule::requiredIf($this->input('action') !== 'cancel'), 'nullable', 'date', 'before_or_equal:today'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $cheque = $this->route('cheque');

                if (! in_array($this->input('action'), $cheque->allowedActions(), true)) {
                    $validator->errors()->add('action', 'That is not possible for this cheque right now.');
                }
            },
        ];
    }
}
