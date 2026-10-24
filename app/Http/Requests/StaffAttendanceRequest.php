<?php

namespace App\Http\Requests;

use App\Models\Company;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * One day's attendance sheet: for each staff member marked, whether they
 * were present, worked half a day, were absent, on leave or off, and the
 * times they came and went. Times are not compared, since a night shift
 * ends the next morning.
 */
class StaffAttendanceRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'work_date' => ['required', 'date', 'before_or_equal:'.Company::findOrFail($this->companyId())->localNow()->toDateString()],
            'entries' => ['required', 'array', 'min:1', 'max:1000'],
            'entries.*.staff_member_id' => ['required', 'integer', 'distinct', $this->existsInCompany('staff_members')],
            'entries.*.status' => ['required', Rule::in(StaffAttendance::STATUSES)],
            'entries.*.check_in' => ['nullable', 'date_format:H:i'],
            'entries.*.check_out' => ['nullable', 'date_format:H:i'],
            'entries.*.note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $entries = $this->input('entries');

                if ($validator->errors()->has('work_date') || ! is_array($entries)) {
                    return;
                }

                $employed = StaffMember::query()
                    ->where('company_id', $this->companyId())
                    ->employedOn(Carbon::parse($this->input('work_date')))
                    ->whereIn('id', collect($entries)->pluck('staff_member_id')->filter(fn (mixed $id) => is_numeric($id))->all())
                    ->pluck('id');

                foreach ($entries as $index => $entry) {
                    $id = is_array($entry) ? ($entry['staff_member_id'] ?? null) : null;

                    if (is_numeric($id) && ! $validator->errors()->has("entries.{$index}.staff_member_id") && ! $employed->contains((int) $id)) {
                        $validator->errors()->add("entries.{$index}.staff_member_id", 'This person was not employed on that day.');
                    }
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
            'work_date' => 'date',
            'entries.*.staff_member_id' => 'staff member',
            'entries.*.status' => 'attendance',
            'entries.*.check_in' => 'time in',
            'entries.*.check_out' => 'time out',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'work_date.before_or_equal' => 'Attendance cannot be marked for a day that has not come yet.',
            'entries.required' => 'Mark at least one person.',
        ];
    }
}
