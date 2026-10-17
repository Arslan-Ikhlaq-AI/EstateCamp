<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Landlord;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Landlord>
 */
class LandlordFactory extends Factory
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
            'landlord_type' => 'company',
            'name' => fake()->lastName().' Properties L.L.C.',
            'contact_person_name' => fake()->name(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+971 4 ### ####'),
        ];
    }
}
