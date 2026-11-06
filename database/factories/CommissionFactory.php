<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Commission;
use App\Models\Contract;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * A commission of an exact amount, received today in cash.
 *
 * @extends Factory<Commission>
 */
class CommissionFactory extends Factory
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
            // Commissions must share their client's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Client::query()->whereKey($attributes['client_id'])->value('company_id'),
            'property_id' => fn (array $attributes) => Property::factory()->create(['company_id' => $attributes['company_id']])->id,
            'agreement_type' => 'contract',
            'agreement_id' => fn (array $attributes) => Contract::factory()->create(['client_id' => $attributes['client_id']])->id,
            'commission_number' => fn () => 'CM-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'amount' => fake()->randomElement([1000, 2500, 5000]),
            'status' => 'received',
            'received_on' => today(),
            'method' => 'cash',
        ];
    }

    /**
     * Taken with `$agreement` at `$propertyId`.
     */
    public function forAgreement(Model $agreement, int $propertyId): static
    {
        return $this->state(fn () => [
            'company_id' => $agreement->company_id,
            'client_id' => $agreement->client_id,
            'property_id' => $propertyId,
            'agreement_type' => $agreement->getMorphClass(),
            'agreement_id' => $agreement->getKey(),
        ]);
    }

    /**
     * Left for later: the money has not arrived.
     */
    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending', 'received_on' => null, 'method' => null]);
    }

    /**
     * Will not be paid and no longer counted.
     */
    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => 'cancelled']);
    }
}
