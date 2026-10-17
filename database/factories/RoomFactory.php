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
        $capacity = fake()->numberBetween(1, 8);

        return [
            'property_id' => Property::factory(),
            // Rooms must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'room_number' => fake()->unique()->numerify('###'),
            'floor_number' => fake()->numberBetween(0, 5),
            // Room types are reference rows inserted by their migration.
            'room_type_id' => fn () => RoomType::query()->inRandomOrder()->value('id'),
            'capacity' => $capacity,
            'occupied_count' => fake()->numberBetween(0, $capacity),
            'status' => 'active',
        ];
    }

    /**
     * Give every created room one bed per unit of capacity, as the room form does.
     */
    public function configure(): static
    {
        return $this->afterCreating(fn (Room $room) => $room->syncBeds());
    }
}
