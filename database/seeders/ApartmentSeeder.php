<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Seven apartments across the demo properties: two supervisor flats at the
 * worker village and five staff apartments at the staff residence.
 *
 * Safe to re-run: apartments are matched on their number within the property.
 * Requires PropertySeeder.
 */
class ApartmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->apartmentsByProperty() as $code => $set) {
            $property = $company->properties()->where('code', $code)->firstOrFail();

            foreach ($set['apartments'] as $apartment) {
                $attributes = [...$set['defaults'], ...$apartment];

                $property->apartments()->updateOrCreate(
                    ['apartment_number' => $attributes['apartment_number']],
                    [
                        ...array_diff_key($attributes, ['apartment_number' => true]),
                        'company_id' => $property->company_id,
                    ],
                );
            }
        }
    }

    /**
     * @return array<string, array{defaults: array<string, mixed>, apartments: array<int, array<string, mixed>>}>
     */
    private function apartmentsByProperty(): array
    {
        return [
            PropertySeeder::AL_QUOZ => [
                'defaults' => [
                    'block' => 'C',
                ],
                'apartments' => [
                    ['apartment_number' => 'C-101', 'floor_number' => 1, 'bedrooms' => 2, 'bathrooms' => 2, 'area_sqm' => 86, 'furnishing_status' => 'semi_furnished', 'max_occupants' => 4, 'amenities' => ['air_conditioning', 'wifi', 'kitchen', 'balcony'], 'monthly_rent' => 7500, 'security_deposit' => 3750, 'utility_account_number' => '2048917365', 'status' => 'occupied', 'notes' => 'Residence of the village site manager.'],
                    ['apartment_number' => 'C-102', 'floor_number' => 1, 'bedrooms' => 1, 'bathrooms' => 1, 'area_sqm' => 56, 'furnishing_status' => 'furnished', 'max_occupants' => 2, 'amenities' => ['air_conditioning', 'wifi', 'kitchen'], 'monthly_rent' => 5200, 'security_deposit' => 2600, 'utility_account_number' => '2048917372', 'status' => 'vacant', 'notes' => 'Kept for visiting supervisors; the keys are at the gatehouse.'],
                ],
            ],
            PropertySeeder::JEBEL_ALI => [
                'defaults' => [
                    'block' => 'B',
                ],
                'apartments' => [
                    ['apartment_number' => 'B-301', 'floor_number' => 3, 'bedrooms' => 0, 'bathrooms' => 1, 'area_sqm' => 38, 'furnishing_status' => 'furnished', 'max_occupants' => 2, 'amenities' => ['air_conditioning', 'wifi', 'kitchen'], 'monthly_rent' => 3800, 'security_deposit' => 1900, 'utility_account_number' => '3175028416', 'status' => 'occupied', 'notes' => 'Studio on the quiet side of the building.'],
                    ['apartment_number' => 'B-302', 'floor_number' => 3, 'bedrooms' => 0, 'bathrooms' => 1, 'area_sqm' => 38, 'furnishing_status' => 'furnished', 'max_occupants' => 2, 'amenities' => ['air_conditioning', 'wifi', 'kitchen'], 'monthly_rent' => 3800, 'security_deposit' => 1900, 'utility_account_number' => '3175028423', 'status' => 'vacant', 'notes' => 'Vacant studio, deep-cleaned and ready for check-in.'],
                    ['apartment_number' => 'B-303', 'floor_number' => 3, 'bedrooms' => 1, 'bathrooms' => 1, 'area_sqm' => 52, 'furnishing_status' => 'furnished', 'max_occupants' => 2, 'amenities' => ['air_conditioning', 'wifi', 'kitchen', 'balcony'], 'monthly_rent' => 5400, 'security_deposit' => 2700, 'utility_account_number' => '3175028430', 'status' => 'reserved', 'notes' => 'Held for a new logistics manager joining next month.'],
                    ['apartment_number' => 'B-401', 'floor_number' => 4, 'bedrooms' => 2, 'bathrooms' => 2, 'area_sqm' => 88, 'furnishing_status' => 'semi_furnished', 'max_occupants' => 4, 'amenities' => ['air_conditioning', 'wifi', 'kitchen', 'balcony', 'built_in_wardrobes'], 'monthly_rent' => 7900, 'security_deposit' => 3950, 'utility_account_number' => '3175028447', 'status' => 'occupied', 'notes' => 'Shared by two members of the logistics team.'],
                    ['apartment_number' => 'B-402', 'floor_number' => 4, 'bedrooms' => 2, 'bathrooms' => 2, 'area_sqm' => 92, 'furnishing_status' => 'unfurnished', 'max_occupants' => 4, 'amenities' => ['air_conditioning', 'kitchen', 'balcony', 'laundry_area'], 'monthly_rent' => 7600, 'security_deposit' => 3800, 'utility_account_number' => '3175028454', 'status' => 'under_maintenance', 'notes' => 'Kitchen refit in progress.'],
                ],
            ],
        ];
    }
}
