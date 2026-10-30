<?php

namespace Database\Factories;

use App\Models\ExtraIncome;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Money a property earned besides rent, received today by bank transfer.
 *
 * @extends Factory<ExtraIncome>
 */
class ExtraIncomeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            // Incomes must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'income_number' => fn () => 'EI-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'title' => fake()->randomElement(['Internet commission', 'Gas supply share', 'Washing machines share', 'Vending machines share']),
            'received_from' => fake()->company(),
            'amount' => fake()->randomElement([2500, 5000, 10000, 12500]),
            'status' => 'received',
            'received_on' => today(),
            'method' => 'bank_transfer',
        ];
    }

    /**
     * Added by mistake and no longer counted.
     */
    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => 'cancelled']);
    }
}
