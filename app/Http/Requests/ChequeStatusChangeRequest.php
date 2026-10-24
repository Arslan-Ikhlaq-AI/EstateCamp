<?php

namespace App\Http\Requests;

use App\Models\ChequeStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A cheque moving to another of the company's statuses, on a given day,
 * with a note (and the bank's reason when it bounced). Only the moves its
 * direction and stage allow.
 */
class ChequeStatusChangeRequest extends CompanyScopedRequest
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
            'cheque_status_id' => ['required', 'integer', Rule::exists('cheque_statuses', 'id')->where('is_active', true)],
            'date' => ['required', 'date', 'before_or_equal:today'],
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
                $status = ChequeStatus::query()->find($this->integer('cheque_status_id'));

                if ($status && ! $this->route('cheque')->canMoveTo($status)) {
                    $validator->errors()->add('cheque_status_id', "This cheque cannot move to {$status->name} right now.");
                }
            },
        ];
    }

    public function newStatus(): ChequeStatus
    {
        return ChequeStatus::query()->findOrFail($this->validated('cheque_status_id'));
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['cheque_status_id' => 'status'];
    }
}
