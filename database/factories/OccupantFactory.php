<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Occupant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Occupant>
 */
class OccupantFactory extends Factory
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
            // Occupants must share their client's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Client::query()->whereKey($attributes['client_id'])->value('company_id'),
            'full_name' => fake()->name('male'),
            'gender' => 'male',
            'nationality' => fake()->randomElement(['Indian', 'Pakistani', 'Bangladeshi', 'Nepali', 'Filipino']),
            'id_type' => 'passport',
            'id_number' => fake()->unique()->bothify('??#######'),
        ];
    }

    /**
     * Indicate that the occupant is a woman.
     */
    public function female(): static
    {
        return $this->state(fn (array $attributes) => [
            'full_name' => fake()->name('female'),
            'gender' => 'female',
        ]);
    }
}
