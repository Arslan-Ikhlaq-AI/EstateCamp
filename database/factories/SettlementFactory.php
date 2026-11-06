<?php

namespace Database\Factories;

use App\Models\ExtraIncome;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Money paid out of extra income today, in cash. Its record's
 * `settled_amount` follows.
 *
 * @extends Factory<Settlement>
 */
class SettlementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'settleable_type' => 'extra_income',
            'settleable_id' => ExtraIncome::factory(),
            'company_id' => fn (array $attributes) => ExtraIncome::query()->whereKey($attributes['settleable_id'])->value('company_id'),
            'settled_on' => today(),
            'amount' => 500,
            'paid_to' => fake()->name(),
            'method' => 'cash',
        ];
    }

    /**
     * Keep the record's settled amount in step.
     */
    public function configure(): static
    {
        return $this->afterCreating(fn (Settlement $settlement) => $settlement->settleable->recountSettled());
    }
}
