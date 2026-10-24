<?php

namespace Database\Factories;

use App\Models\StaffAttendance;
use App\Models\StaffMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A day a staff member was present. Give the person with for(), the day
 * with `work_date`, and anything else with `status`.
 *
 * @extends Factory<StaffAttendance>
 */
class StaffAttendanceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'staff_member_id' => StaffMember::factory(),
            // Attendance must share its staff member's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => StaffMember::query()->whereKey($attributes['staff_member_id'])->value('company_id'),
            'work_date' => today(),
            'status' => 'present',
            'check_in' => '08:00',
            'check_out' => '17:00',
        ];
    }
}
