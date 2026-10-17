<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Contract;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contract>
 */
class ContractFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_id' => Client::factory(),
            // Contracts must share their client's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Client::query()->whereKey($attributes['client_id'])->value('company_id'),
            'contract_number' => fake()->unique()->numerify('CTR-####-####'),
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'billing_cycle' => 'monthly',
            'payment_terms_days' => 7,
            'status' => 'draft',
        ];
    }

    /**
     * Indicate that the contract has been signed and is running.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'active',
            'signed_on' => '2025-12-20',
        ]);
    }
}
