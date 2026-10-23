<?php

namespace Database\Seeders;

use App\Models\RoomType;
use Illuminate\Database\Seeder;

/**
 * Five rooms for each demo property.
 *
 * Safe to re-run: rooms are matched on their number within the property. Each
 * property's room and bed totals are recalculated from its rooms afterwards.
 * Requires PropertySeeder.
 */
class RoomSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $roomTypeIds = RoomType::query()->pluck('id', 'slug');

        foreach ($this->roomsByProperty() as $code => $set) {
            $property = $company->properties()->where('code', $code)->firstOrFail();

            foreach ($set['rooms'] as $room) {
                $attributes = [...$set['defaults'], ...$room];

                $property->rooms()->updateOrCreate(
                    ['room_number' => $attributes['room_number']],
                    [
                        ...array_diff_key($attributes, ['room_number' => true, 'type' => true]),
                        'company_id' => $property->company_id,
                        'room_type_id' => $roomTypeIds->get($attributes['type']),
                    ],
                );
            }

            $property->update([
                'total_rooms' => $property->rooms()->count(),
                'total_capacity' => (int) $property->rooms()->sum('capacity'),
            ]);
        }
    }

    /**
     * @return array<string, array{defaults: array<string, mixed>, rooms: array<int, array<string, mixed>>}>
     */
    private function roomsByProperty(): array
    {
        return [
            PropertySeeder::AL_QUOZ => [
                'defaults' => [
                    'block' => 'A',
                    'gender_policy' => 'male',
                    'amenities' => ['air_conditioning', 'bunk_beds', 'lockers', 'wifi'],
                    'status' => 'active',
                ],
                'rooms' => [
                    ['room_number' => '101', 'type' => 'dormitory', 'floor_number' => 1, 'capacity' => 8, 'occupied_count' => 7, 'area_sqm' => 38, 'rent_per_bed' => 450, 'notes' => 'Closest dormitory to the canteen and laundry.'],
                    ['room_number' => '102', 'type' => 'dormitory', 'floor_number' => 1, 'capacity' => 8, 'occupied_count' => 8, 'area_sqm' => 38, 'rent_per_bed' => 450, 'notes' => 'Fully occupied; a waiting list is open.'],
                    ['room_number' => '103', 'type' => 'shared_room', 'floor_number' => 1, 'capacity' => 4, 'occupied_count' => 3, 'area_sqm' => 24, 'rent_per_bed' => 600, 'notes' => 'Reserved for site supervisors.'],
                    ['room_number' => '201', 'type' => 'shared_room', 'floor_number' => 2, 'capacity' => 4, 'occupied_count' => 4, 'area_sqm' => 24, 'rent_per_bed' => 600, 'notes' => 'Window faces the central courtyard.'],
                    ['room_number' => '202', 'type' => 'shared_room', 'floor_number' => 2, 'capacity' => 6, 'occupied_count' => 0, 'area_sqm' => 30, 'rent_per_bed' => 550, 'status' => 'under_maintenance', 'notes' => 'Air conditioning unit is being replaced.'],
                ],
            ],
            PropertySeeder::JEBEL_ALI => [
                'defaults' => [
                    'block' => 'B',
                    'amenities' => ['air_conditioning', 'attached_bathroom', 'wardrobe', 'wifi'],
                    'status' => 'active',
                ],
                'rooms' => [
                    ['room_number' => '101', 'type' => 'private_room', 'floor_number' => 1, 'gender_policy' => 'male', 'capacity' => 1, 'occupied_count' => 1, 'area_sqm' => 16, 'rent_per_bed' => 1500, 'notes' => 'Next to reception and the mail room.'],
                    ['room_number' => '102', 'type' => 'private_room', 'floor_number' => 1, 'gender_policy' => 'female', 'capacity' => 1, 'occupied_count' => 0, 'area_sqm' => 16, 'rent_per_bed' => 1500, 'notes' => 'Rented directly to individual tenants, without a contract.'],
                    ['room_number' => '103', 'type' => 'shared_room', 'floor_number' => 1, 'gender_policy' => 'female', 'capacity' => 2, 'occupied_count' => 2, 'area_sqm' => 22, 'rent_per_bed' => 1100, 'notes' => 'Twin room with a shared wardrobe.'],
                    ['room_number' => '201', 'type' => 'shared_room', 'floor_number' => 2, 'gender_policy' => 'male', 'capacity' => 2, 'occupied_count' => 1, 'area_sqm' => 22, 'rent_per_bed' => 1100, 'notes' => 'One bed is still available.'],
                    ['room_number' => '202', 'type' => 'private_room', 'floor_number' => 2, 'gender_policy' => 'male', 'capacity' => 1, 'occupied_count' => 1, 'area_sqm' => 18, 'rent_per_bed' => 1700, 'notes' => 'Corner room with a balcony.'],
                ],
            ],
        ];
    }
}
