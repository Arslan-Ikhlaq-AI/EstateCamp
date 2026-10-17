<?php

namespace Database\Factories;

use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HeadLease>
 */
class HeadLeaseFactory extends Factory
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
            // The property and landlord must share the lease's company (enforced by composite foreign keys).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'landlord_id' => fn (array $attributes) => Landlord::factory()->create(['company_id' => $attributes['company_id']])->id,
            'lease_number' => fake()->unique()->numerify('HL-####-####'),
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'annual_rent' => 240000,
            'payments_per_year' => 4,
            'status' => 'active',
        ];
    }
}
