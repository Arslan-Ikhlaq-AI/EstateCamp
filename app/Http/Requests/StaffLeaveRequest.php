<?php

namespace App\Http\Requests;

use App\Models\StaffLeave;
use App\Models\StaffMember;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Leave a staff member asks for on their own page, or that someone who
 * manages leave gives one of the staff, saying whether it is paid: its
 * kind, its first and last day, and the reason. It must fall while they
 * are employed, last no more than a year, and not overlap their leave that
 * is waiting or approved. No one gives leave to themselves.
 */
class StaffLeaveRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...($this->givesLeave() ? [
                'staff_member_id' => ['required', 'integer', $this->existsInCompany('staff_members')],
                'is_paid' => ['required', 'boolean'],
            ] : []),
            'type' => ['required', Rule::in(StaffLeave::TYPES)],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $member = $this->member();

                if ($member === null || $validator->errors()->hasAny(['staff_member_id', 'starts_on', 'ends_on'])) {
                    return;
                }

                $from = $this->date('starts_on');
                $to = $this->date('ends_on');
                $who = $this->givesLeave() ? 'They' : 'You';

                if ($this->givesLeave() && $member->user_id !== null && $member->user_id === $this->user()->id) {
                    $validator->errors()->add('staff_member_id', 'Someone else must give you leave. Ask for it on your My leave page.');

                    return;
                }

                if (StaffLeave::daysBetween($from, $to) > StaffLeave::MAX_DAYS) {
                    $validator->errors()->add('ends_on', 'Leave can last at most '.StaffLeave::MAX_DAYS.' days.');

                    return;
                }

                if ($from->lt($member->joined_on)) {
                    $validator->errors()->add('starts_on', "{$who} joined on {$member->joined_on->format('j M Y')}, so leave cannot start before then.");
                }

                if ($member->left_on && $to->gt($member->left_on)) {
                    $validator->errors()->add('ends_on', "{$who} left on {$member->left_on->format('j M Y')}, so leave cannot end after then.");
                }

                $clash = $member->leaves()->active()->overlapping($from, $to)->orderBy('starts_on')->first();

                if ($clash) {
                    $validator->errors()->add('starts_on', sprintf(
                        'This overlaps %s leave from %s to %s.',
                        $clash->isPending() ? 'requested' : 'approved',
                        $clash->starts_on->format('j M Y'),
                        $clash->ends_on->format('j M Y'),
                    ));
                }
            },
        ];
    }

    /**
     * Whether leave is given to one of the staff (saying whether it is paid)
     * rather than asked for by the signed-in staff member.
     */
    public function givesLeave(): bool
    {
        return $this->routeIs('leave.store');
    }

    /**
     * The staff member the leave is for.
     */
    public function member(): ?StaffMember
    {
        if (! $this->givesLeave()) {
            return $this->user()->staffMember;
        }

        $id = $this->input('staff_member_id');

        return is_numeric($id) ? StaffMember::query()->where('company_id', $this->companyId())->find((int) $id) : null;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'staff_member_id' => 'staff member',
            'is_paid' => 'pay',
            'type' => 'kind of leave',
            'starts_on' => 'first day',
            'ends_on' => 'last day',
        ];
    }
}
