<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
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
            'client_type' => 'company',
            'name' => fake()->company().' L.L.C.',
            'contact_person_name' => fake()->name(),
            'email' => fake()->unique()->companyEmail(),
            'phone' => fake()->numerify('+971 4 ### ####'),
            'status' => 'active',
        ];
    }

    /**
     * Indicate that the client is a person renting for themselves.
     */
    public function individual(): static
    {
        return $this->state(fn (array $attributes) => [
            'client_type' => 'individual',
            'name' => fake()->name(),
            'id_type' => 'passport',
            'id_number' => fake()->unique()->bothify('??#######'),
            'nationality' => 'Indian',
        ]);
    }
}
