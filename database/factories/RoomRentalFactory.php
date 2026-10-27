<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A company renting short-term for three months, without rooms. Use
 * forRooms() to give it the rooms it holds, as the rental form does.
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
            'property_id' => Property::factory(),
            // The rental and its client share the property's company (enforced by composite foreign keys).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'client_id' => fn (array $attributes) => Client::factory()->create(['company_id' => $attributes['company_id']])->id,
            'rental_number' => fake()->unique()->numerify('RNT-####-####'),
            'monthly_rent' => 2400,
            'security_deposit' => 2400,
            'start_date' => '2026-01-01',
            'end_date' => fn (array $attributes) => RoomRental::endDateFor(CarbonImmutable::parse($attributes['start_date']), 3)->toDateString(),
            'status' => 'active',
        ];
    }

    /**
     * Holding these rooms, all in the first room's property.
     */
    public function forRooms(Room ...$rooms): static
    {
        return $this
            ->state(['property_id' => $rooms[0]->property_id, 'company_id' => $rooms[0]->company_id])
            ->afterCreating(fn (RoomRental $rental) => $rental->rooms()->attach(array_map(fn (Room $room) => $room->id, $rooms), ['company_id' => $rental->company_id]));
    }
}
