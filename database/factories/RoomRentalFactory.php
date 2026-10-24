<?php

namespace Database\Factories;

use App\Models\Bed;
use App\Models\Client;
use App\Models\Occupant;
use App\Models\Room;
use App\Models\RoomRental;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * An individual renting the first bed of a new room. Call checkIn() on the
 * rental to put them in the bed, as the rental form does.
 *
 * @extends Factory<RoomRental>
 */
class RoomRentalFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory()->state(['status' => 'active', 'occupied_count' => 0, 'gender_policy' => 'mixed']),
            // The rental, its client and occupant share the room's company (enforced by composite foreign keys).
            'company_id' => fn (array $attributes) => Room::query()->whereKey($attributes['room_id'])->value('company_id'),
            'property_id' => fn (array $attributes) => Room::query()->whereKey($attributes['room_id'])->value('property_id'),
            'bed_id' => fn (array $attributes) => Bed::query()->where('room_id', $attributes['room_id'])->orderBy('id')->value('id'),
            'client_id' => fn (array $attributes) => Client::factory()->individual()->create(['company_id' => $attributes['company_id']])->id,
            'occupant_id' => fn (array $attributes) => Occupant::factory()->create(['client_id' => $attributes['client_id']])->id,
            'rental_number' => fake()->unique()->numerify('RNT-####-####'),
            'unit_type' => 'bed',
            'monthly_rent' => 900,
            'security_deposit' => 900,
            'start_date' => '2026-01-01',
            'status' => 'active',
        ];
    }

    /**
     * Renting the whole room.
     */
    public function wholeRoom(): static
    {
        return $this->state(fn (array $attributes) => ['unit_type' => 'room', 'monthly_rent' => 2400]);
    }
}
