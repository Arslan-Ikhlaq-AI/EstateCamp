<?php

namespace Database\Seeders;

use App\Models\RoomType;
use Illuminate\Database\Seeder;

/**
 * Five rooms for each demo property.
 *
 * Safe to re-run: rooms are matched on their number within the property. Each
 * property's room and capacity totals are recalculated from its rooms
 * afterwards. Whether a room is occupied follows the contracts and rentals
 * seeded later.
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
                    ['room_number' => '101', 'type' => 'dormitory', 'floor_number' => 1, 'capacity' => 8, 'area_sqm' => 38, 'monthly_rent' => 3600, 'notes' => 'Closest dormitory to the canteen and laundry.'],
                    ['room_number' => '102', 'type' => 'dormitory', 'floor_number' => 1, 'capacity' => 8, 'area_sqm' => 38, 'monthly_rent' => 3600, 'notes' => 'A waiting list is open for this dormitory.'],
                    ['room_number' => '103', 'type' => 'shared_room', 'floor_number' => 1, 'capacity' => 4, 'area_sqm' => 24, 'monthly_rent' => 2400, 'notes' => 'Reserved for site supervisors.'],
                    ['room_number' => '201', 'type' => 'shared_room', 'floor_number' => 2, 'capacity' => 4, 'area_sqm' => 24, 'monthly_rent' => 2400, 'notes' => 'Window faces the central courtyard.'],
                    ['room_number' => '202', 'type' => 'shared_room', 'floor_number' => 2, 'capacity' => 6, 'area_sqm' => 30, 'monthly_rent' => 3300, 'status' => 'under_maintenance', 'notes' => 'Air conditioning unit is being replaced.'],
                ],
            ],
            PropertySeeder::JEBEL_ALI => [
                'defaults' => [
                    'block' => 'B',
                    'amenities' => ['air_conditioning', 'attached_bathroom', 'wardrobe', 'wifi'],
                    'status' => 'active',
                ],
                'rooms' => [
                    ['room_number' => '101', 'type' => 'private_room', 'floor_number' => 1, 'gender_policy' => 'male', 'capacity' => 1, 'area_sqm' => 16, 'monthly_rent' => 1500, 'notes' => 'Next to reception and the mail room.'],
                    ['room_number' => '102', 'type' => 'private_room', 'floor_number' => 1, 'gender_policy' => 'female', 'capacity' => 1, 'area_sqm' => 16, 'monthly_rent' => 1500, 'notes' => 'Rented short-term to companies, without a contract.'],
                    ['room_number' => '103', 'type' => 'shared_room', 'floor_number' => 1, 'gender_policy' => 'female', 'capacity' => 2, 'area_sqm' => 22, 'monthly_rent' => 2200, 'notes' => 'Twin room with a shared wardrobe.'],
                    ['room_number' => '201', 'type' => 'shared_room', 'floor_number' => 2, 'gender_policy' => 'male', 'capacity' => 2, 'area_sqm' => 22, 'monthly_rent' => 2200, 'notes' => 'Quiet end of the corridor.'],
                    ['room_number' => '202', 'type' => 'private_room', 'floor_number' => 2, 'gender_policy' => 'male', 'capacity' => 1, 'area_sqm' => 18, 'monthly_rent' => 1700, 'notes' => 'Corner room with a balcony.'],
                ],
            ],
        ];
    }
}
