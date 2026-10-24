<?php

namespace Database\Factories;

use App\Models\MaintenanceContract;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A fire safety contract for a year that started a few months ago, with
 * quarterly visits paid quarterly. Move its term with expiring() or expired().
 *
 * @extends Factory<MaintenanceContract>
 */
class MaintenanceContractFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = today()->subMonths(fake()->numberBetween(1, 5))->startOfMonth();

        return [
            'property_id' => Property::factory(),
            // Contracts must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'contract_number' => fn () => 'AMC-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'service' => 'fire_safety',
            'vendor_name' => fake()->randomElement(['Fire Shield Safety Systems L.L.C.', 'Red Line Fire Protection', 'Al Amaan Fire & Safety']),
            'vendor_contact_person' => fake()->name(),
            'vendor_phone' => fake()->numerify('+971 4 ### ####'),
            'vendor_email' => fake()->safeEmail(),
            'vendor_licence_number' => fake()->numerify('DCD-#####'),
            'start_date' => $start,
            'end_date' => $start->copy()->addYear()->subDay(),
            'contract_value' => fake()->randomElement([6000, 8500, 12000]),
            'payment_terms' => 'quarterly',
            'status' => 'active',
            'visit_frequency' => 'quarterly',
            'coverage' => ['fire_alarm', 'extinguishers', 'hose_reels', 'emergency_lighting'],
        ];
    }

    /**
     * Ending within the renewal window.
     */
    public function expiring(int $daysLeft = 20): static
    {
        return $this->state(fn () => [
            'start_date' => today()->addDays($daysLeft)->subYear()->addDay(),
            'end_date' => today()->addDays($daysLeft),
        ]);
    }

    /**
     * Ended some time ago.
     */
    public function expired(): static
    {
        return $this->state(fn () => [
            'start_date' => today()->subMonths(14),
            'end_date' => today()->subMonths(2),
        ]);
    }
}
