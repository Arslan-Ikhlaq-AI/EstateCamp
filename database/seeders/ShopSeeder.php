<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Six ground-floor shops across the demo properties: four at the worker
 * village and two at the staff residence.
 *
 * Safe to re-run: shops are matched on their number within the property.
 * Requires PropertySeeder.
 */
class ShopSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->shopsByProperty() as $code => $set) {
            $property = $company->properties()->where('code', $code)->firstOrFail();

            foreach ($set['shops'] as $shop) {
                $attributes = [...$set['defaults'], ...$shop];

                $property->shops()->updateOrCreate(
                    ['shop_number' => $attributes['shop_number']],
                    [
                        ...array_diff_key($attributes, ['shop_number' => true]),
                        'company_id' => $property->company_id,
                    ],
                );
            }
        }
    }

    /**
     * @return array<string, array{defaults: array<string, mixed>, shops: array<int, array<string, mixed>>}>
     */
    private function shopsByProperty(): array
    {
        return [
            PropertySeeder::AL_QUOZ => [
                'defaults' => [
                    'block' => 'A',
                    'floor_number' => 0,
                ],
                'shops' => [
                    ['shop_number' => 'G-01', 'shop_type' => 'grocery', 'area_sqm' => 42, 'amenities' => ['air_conditioning', 'storage_room', 'display_window', 'signage'], 'monthly_rent' => 6500, 'security_deposit' => 3250, 'utility_account_number' => '2048918001', 'status' => 'occupied', 'notes' => 'Mini market serving the village; opens at 6 a.m.'],
                    ['shop_number' => 'G-02', 'shop_type' => 'laundry', 'area_sqm' => 36, 'amenities' => ['air_conditioning', 'storage_room', 'water_connection', 'signage'], 'monthly_rent' => 4800, 'security_deposit' => 2400, 'utility_account_number' => '2048918018', 'status' => 'occupied', 'notes' => 'Self-service and drop-off laundry for residents.'],
                    ['shop_number' => 'G-03', 'shop_type' => 'barber', 'area_sqm' => 24, 'amenities' => ['air_conditioning', 'display_window', 'water_connection'], 'monthly_rent' => 3200, 'security_deposit' => 1600, 'utility_account_number' => '2048918025', 'status' => 'reserved', 'notes' => 'Reserved for a barber shop opening next quarter.'],
                    ['shop_number' => 'G-04', 'shop_type' => 'restaurant', 'area_sqm' => 58, 'amenities' => ['air_conditioning', 'storage_room', 'loading_access', 'water_connection', 'security_shutter'], 'monthly_rent' => 9500, 'security_deposit' => 4750, 'utility_account_number' => '2048918032', 'status' => 'vacant', 'notes' => 'Fitted kitchen and extraction; available for a canteen operator.'],
                ],
            ],
            PropertySeeder::JEBEL_ALI => [
                'defaults' => [
                    'block' => 'B',
                    'floor_number' => 0,
                ],
                'shops' => [
                    ['shop_number' => 'G-01', 'shop_type' => 'cafe', 'area_sqm' => 30, 'amenities' => ['air_conditioning', 'display_window', 'signage', 'water_connection'], 'monthly_rent' => 5600, 'security_deposit' => 2800, 'utility_account_number' => '3175029001', 'status' => 'occupied', 'notes' => 'Coffee counter facing the residence lobby.'],
                    ['shop_number' => 'G-02', 'shop_type' => 'pharmacy', 'area_sqm' => 34, 'amenities' => ['air_conditioning', 'display_window', 'signage', 'cctv', 'security_shutter'], 'monthly_rent' => 6100, 'security_deposit' => 3050, 'utility_account_number' => '3175029018', 'status' => 'under_maintenance', 'notes' => 'Shopfront being fitted out for a pharmacy.'],
                ],
            ],
        ];
    }
}
