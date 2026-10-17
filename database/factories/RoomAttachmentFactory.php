<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomAttachment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomAttachment>
 */
class RoomAttachmentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->slug(2).'.jpg';

        return [
            'room_id' => Room::factory(),
            'attachment_type' => 'image',
            'file_url' => "https://example.test/rooms/{$name}",
            'thumbnail_url' => "https://example.test/rooms/thumbs/{$name}",
            'original_name' => $name,
            'mime_type' => 'image/jpeg',
            'file_size' => fake()->numberBetween(120_000, 900_000),
            'caption' => fake()->sentence(4),
            'sort_order' => 0,
            'is_primary' => false,
        ];
    }

    /**
     * Indicate that the attachment is the room's cover image.
     */
    public function primary(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_primary' => true,
        ]);
    }
}
