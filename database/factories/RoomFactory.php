<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\Room;
use App\Models\RoomType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
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
            // Rooms must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'room_number' => fake()->unique()->numerify('###'),
            'floor_number' => fake()->numberBetween(0, 5),
            // Room types are reference rows inserted by their migration.
            'room_type_id' => fn () => RoomType::query()->inRandomOrder()->value('id'),
            'capacity' => fake()->numberBetween(1, 8),
            'status' => 'active',
        ];
    }
}
