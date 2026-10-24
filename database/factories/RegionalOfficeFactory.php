<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\RegionalOffice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegionalOffice>
 */
class RegionalOfficeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $city = fake()->randomElement(['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah']);

        return [
            'company_id' => Company::factory(),
            'name' => $city.' Region '.fake()->unique()->numberBetween(1, 999),
            'code' => strtoupper(substr($city, 0, 3)),
            'city' => $city,
            'is_active' => true,
        ];
    }
}
