<?php

namespace Database\Factories;

use App\Models\StaffLeave;
use App\Models\StaffMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A week of annual leave asked for and still waiting. Give the person with
 * for(), the days with `starts_on` and `ends_on`, and a decision with
 * approved() or rejected().
 *
 * @extends Factory<StaffLeave>
 */
class StaffLeaveFactory extends Factory
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
            // Leave must share its staff member's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => StaffMember::query()->whereKey($attributes['staff_member_id'])->value('company_id'),
            'type' => 'annual',
            'starts_on' => today()->addWeek()->toDateString(),
            'ends_on' => today()->addWeeks(2)->subDay()->toDateString(),
            'days' => fn (array $attributes) => StaffLeave::daysBetween(today()->parse($attributes['starts_on']), today()->parse($attributes['ends_on'])),
            'reason' => fake()->sentence(),
            'status' => 'pending',
        ];
    }

    /**
     * Approved as paid, or unpaid with `$isPaid` false, without marking attendance.
     */
    public function approved(bool $isPaid = true): static
    {
        return $this->state(fn () => ['status' => 'approved', 'is_paid' => $isPaid, 'decided_at' => now()]);
    }

    /**
     * Turned down.
     */
    public function rejected(): static
    {
        return $this->state(fn () => ['status' => 'rejected', 'decision_note' => 'Too many of the team are away then.', 'decided_at' => now()]);
    }
}
