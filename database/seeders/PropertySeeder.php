<?php

namespace Database\Seeders;

use App\Models\PropertyType;
use Illuminate\Database\Seeder;

/**
 * The demo company's two properties: one owned, one leased.
 *
 * Safe to re-run: properties are matched on their code within the company.
 * The leased property points at its landlord, which is created here with
 * its name and phone (LandlordSeeder later fills in the rest); the landlord
 * and lease columns stay empty on the owned property, where they do not
 * apply. The room and capacity totals are set by RoomSeeder from the rooms.
 * Requires CompanySeeder.
 */
class PropertySeeder extends Seeder
{
    public const AL_QUOZ = 'HFM-AQZ-01';

    public const JEBEL_ALI = 'HFM-JBA-01';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->properties() as $property) {
            $propertyType = PropertyType::query()
                ->where('slug', $property['type'])
                ->firstOrFail();

            $landlord = isset($property['landlord'])
                ? $company->landlords()->firstOrCreate(['name' => $property['landlord']['name']], $property['landlord'])
                : null;

            $company->properties()->updateOrCreate(
                ['code' => $property['code']],
                [...$property['attributes'], 'property_type_id' => $propertyType->id, 'landlord_id' => $landlord?->id],
            );
        }
    }

    /**
     * @return array<int, array{code: string, type: string, attributes: array<string, mixed>}>
     */
    private function properties(): array
    {
        return [
            [
                'code' => self::AL_QUOZ,
                'type' => 'worker_accommodation',
                'attributes' => [
                    'name' => 'Al Quoz Worker Village',
                    'cover_image_url' => '/images/demo/al-quoz-worker-village.svg',
                    'country_code' => 'AE',
                    'city' => 'Dubai',
                    'area' => 'Al Quoz Industrial Area 3',
                    'street' => '17th Street',
                    'building_name' => 'Horizon Village',
                    'plot_number' => '364-0542',
                    'makani_number' => '2948571036',
                    'po_box' => '52816',
                    'address' => 'Plot 364-0542, 17th Street, Al Quoz Industrial Area 3, Dubai',
                    'latitude' => 25.1352000,
                    'longitude' => 55.2401000,
                    'map_url' => 'https://www.google.com/maps?q=25.1352,55.2401',
                    'contact_person_name' => 'Imran Siddiqui',
                    'contact_person_phone' => '+971 50 123 4567',
                    'total_floors' => 2,
                    'total_units' => 16,
                    'ownership_type' => 'owned',
                    'status' => 'active',
                    'notes' => 'Freehold labour accommodation with a canteen, laundry and prayer room on site.',
                ],
            ],
            [
                'code' => self::JEBEL_ALI,
                'type' => 'staff_accommodation',
                'landlord' => [
                    'name' => LandlordSeeder::AL_MARSA,
                    'landlord_type' => 'company',
                    'phone' => '+971 4 456 7890',
                ],
                'attributes' => [
                    'name' => 'Jebel Ali Staff Residence',
                    'cover_image_url' => '/images/demo/jebel-ali-staff-residence.svg',
                    'country_code' => 'AE',
                    'city' => 'Dubai',
                    'area' => 'Jebel Ali Industrial Area 1',
                    'street' => 'Street 4',
                    'building_name' => 'Horizon Staff Residence',
                    'plot_number' => '597-1123',
                    'makani_number' => '1654038297',
                    'po_box' => '90437',
                    'address' => 'Plot 597-1123, Street 4, Jebel Ali Industrial Area 1, Dubai',
                    'latitude' => 25.0105000,
                    'longitude' => 55.1290000,
                    'map_url' => 'https://www.google.com/maps?q=25.0105,55.1290',
                    'total_floors' => 3,
                    'total_units' => 16,
                    'contact_person_name' => 'Fatima Noor',
                    'contact_person_phone' => '+971 55 987 6543',
                    'ownership_type' => 'leased',
                    'lease_start_date' => '2026-01-01',
                    'lease_end_date' => '2028-12-31',
                    'status' => 'active',
                    'notes' => 'Leased residence for office and logistics staff, five minutes from the free zone gate.',
                ],
            ],
        ];
    }
}
