<?php

namespace Database\Factories;

use App\Models\Apartment;
use App\Models\Property;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Apartment>
 */
class ApartmentFactory extends Factory
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
            // Apartments must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'apartment_number' => fake()->unique()->numerify('###'),
            'floor_number' => fake()->numberBetween(0, 20),
            'bedrooms' => fake()->numberBetween(0, 3),
            'bathrooms' => fake()->numberBetween(1, 3),
            'status' => 'vacant',
        ];
    }
}
