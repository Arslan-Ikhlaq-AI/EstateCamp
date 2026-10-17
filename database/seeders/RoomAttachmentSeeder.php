<?php

namespace Database\Seeders;

use App\Models\Room;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Two pictures for every demo room: a cover illustration matching its room
 * type, and an interior shot of the lockers.
 *
 * Safe to re-run: a room keeps one attachment per sort position, updated in
 * place. The illustrations live in public/images/demo, and the uploader
 * alternates between the company's users.
 * Requires RoomSeeder and UserSeeder.
 */
class RoomAttachmentSeeder extends Seeder
{
    /**
     * Cover illustration for each room type slug.
     */
    private const COVERS = [
        'dormitory' => 'images/demo/room-dormitory.svg',
        'shared_room' => 'images/demo/room-shared.svg',
        'private_room' => 'images/demo/room-private.svg',
    ];

    private const INTERIOR = 'images/demo/room-lockers.svg';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $uploaders = $company->users()->orderBy('id')->get();

        $propertyIds = $company->properties()
            ->whereIn('code', [PropertySeeder::AL_QUOZ, PropertySeeder::JEBEL_ALI])
            ->pluck('id');

        $rooms = Room::query()
            ->with(['property', 'roomType'])
            ->whereIn('property_id', $propertyIds)
            ->orderBy('property_id')
            ->orderBy('room_number')
            ->get();

        foreach ($rooms as $index => $room) {
            $uploader = $uploaders[$index % $uploaders->count()];

            $pictures = [
                [
                    'slug' => 'cover',
                    'path' => self::COVERS[$room->roomType->slug] ?? self::COVERS['shared_room'],
                    'caption' => "{$room->roomType->name} {$room->room_number}",
                ],
                [
                    'slug' => 'interior',
                    'path' => self::INTERIOR,
                    'caption' => "Room {$room->room_number} interior, {$room->capacity} ".Str::plural('bed', $room->capacity),
                ],
            ];

            foreach ($pictures as $position => $picture) {
                $room->attachments()->updateOrCreate(
                    ['sort_order' => $position],
                    [
                        'attachment_type' => 'image',
                        'file_url' => "/{$picture['path']}",
                        'thumbnail_url' => "/{$picture['path']}",
                        'original_name' => "{$room->property->code}-{$room->room_number}-{$picture['slug']}.svg",
                        'mime_type' => 'image/svg+xml',
                        'file_size' => filesize(public_path($picture['path'])),
                        'caption' => $picture['caption'],
                        'is_primary' => $position === 0,
                        'uploaded_by' => $uploader->id,
                    ],
                );
            }
        }
    }
}
