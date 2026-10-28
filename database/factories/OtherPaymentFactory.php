<?php

namespace Database\Factories;

use App\Models\OtherPayment;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A one-off payment for a property, still to pay. Settle it with paid().
 *
 * @extends Factory<OtherPayment>
 */
class OtherPaymentFactory extends Factory
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
            // Payments must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'payment_number' => fn () => 'OP-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'title' => fake()->randomElement(['Civil Defence permit renewal', 'Water tanker', 'Cleaning supplies', 'Pest control spray', 'Building insurance']),
            'paid_to' => fake()->company(),
            'amount' => fake()->randomElement([150, 400, 1200, 2500]),
            'status' => 'pending',
            'payment_date' => today(),
        ];
    }

    /**
     * Paid on its payment date, in cash.
     */
    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'paid', 'method' => 'cash']);
    }
}
