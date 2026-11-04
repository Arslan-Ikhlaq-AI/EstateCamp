<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Approving a leave request, as paid or unpaid, or rejecting it, with a
 * note for the staff member. Only a request still waiting can be decided,
 * and no one decides their own.
 */
class LeaveDecisionRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'staffLeave';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'is_paid' => [Rule::requiredIf($this->routeIs('leave.approve')), 'boolean'],
            'decision_note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $leave = $this->route('staffLeave');
                $member = $leave->staffMember;

                match (true) {
                    ! $leave->isPending() => $validator->errors()->add('leave', "This leave is {$leave->status} already, so it cannot be decided again."),
                    $member === null => $validator->errors()->add('leave', 'This staff member was removed, so their leave cannot be decided.'),
                    $member->user_id !== null && $member->user_id === $this->user()->id => $validator->errors()->add('leave', 'Someone else must decide your own leave.'),
                    default => null,
                };
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'is_paid' => 'pay',
            'decision_note' => 'note',
        ];
    }
}
