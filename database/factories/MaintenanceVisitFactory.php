<?php

namespace Database\Factories;

use App\Models\MaintenanceContract;
use App\Models\MaintenanceVisit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A visit on a contract's schedule a week from today, not done yet. Move
 * it with on(), or record it with done().
 *
 * @extends Factory<MaintenanceVisit>
 */
class MaintenanceVisitFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'maintenance_contract_id' => MaintenanceContract::factory(),
            // Visits must share their contract's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => MaintenanceContract::query()->whereKey($attributes['maintenance_contract_id'])->value('company_id'),
            'scheduled_on' => today()->addWeek(),
            'status' => 'scheduled',
        ];
    }

    /**
     * Scheduled `$days` from today (negative for a day already passed).
     */
    public function on(int $days): static
    {
        return $this->state(fn () => ['scheduled_on' => today()->addDays($days)]);
    }

    /**
     * Carried out on the day it was planned for.
     */
    public function done(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'done',
            'completed_on' => $attributes['scheduled_on'],
            'technician_name' => fake()->name(),
        ]);
    }
}
