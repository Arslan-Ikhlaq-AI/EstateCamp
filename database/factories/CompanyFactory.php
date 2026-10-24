<?php

namespace Database\Factories;

use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->company();

        return [
            'name' => $name,
            'legal_name' => "{$name} L.L.C.",
            'slug' => Str::slug(Str::limit($name, 30, '')).'-'.fake()->unique()->numberBetween(100, 99999),
            'business_type' => fake()->randomElement(array_keys(Company::BUSINESS_TYPES)),
            'trade_license_number' => fake()->unique()->numerify('CN-#######'),
            // UAE tax registration numbers are 15 digits.
            'tax_registration_number' => fake()->unique()->numerify('100########0003'),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+971 4 ### ####'),
            'default_currency' => 'AED',
            'timezone' => 'Asia/Dubai',
            'status' => 'active',
            'city' => 'Dubai',
            'country_code' => 'AE',
        ];
    }
}
