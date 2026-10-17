<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Property>
 */
class PropertyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => fake()->lastName().' Accommodation',
            'code' => fake()->unique()->numerify('PRP-####'),
            // Property types are reference rows inserted by their migration.
            'property_type_id' => fn () => PropertyType::query()->inRandomOrder()->value('id'),
            'country_code' => 'AE',
            'city' => 'Dubai',
            'area' => fake()->randomElement(['Al Quoz', 'Jebel Ali', 'Al Qusais', 'Dubai Investments Park']),
            'status' => 'active',
        ];
    }
}
