<?php

namespace Database\Seeders;

use App\Models\Room;
use Illuminate\Database\Seeder;

/**
 * One bed per unit of capacity in every demo room, labelled 1, 2, 3…
 *
 * Safe to re-run: Room::syncBeds() only adds or retires the difference.
 * Requires RoomSeeder.
 */
class BedSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        CompanySeeder::demoCompany()->rooms()->get()->each(fn (Room $room) => $room->syncBeds());
    }
}
