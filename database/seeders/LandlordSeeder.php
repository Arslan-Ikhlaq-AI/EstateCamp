<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Two landlords: the company that leases the staff residence to Horizon,
 * and an individual owner Horizon is talking to about a new site.
 *
 * Safe to re-run: landlords are matched on their name within the company.
 * Requires CompanySeeder.
 */
class LandlordSeeder extends Seeder
{
    public const AL_MARSA = 'Al Marsa Properties L.L.C.';

    public const HAMDAN = 'Hamdan Al Falasi';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->landlords() as $landlord) {
            $company->landlords()->updateOrCreate(['name' => $landlord['name']], $landlord);
        }
    }

    /**
     * @return list<array<string, string>>
     */
    private function landlords(): array
    {
        return [
            [
                'landlord_type' => 'company',
                'name' => self::AL_MARSA,
                'contact_person_name' => 'Khalid Al Marsa',
                'email' => 'leasing@almarsa.test',
                // Matches the landlord phone PropertySeeder stores on the leased property.
                'phone' => '+971 4 456 7890',
                'trade_license_number' => 'CN-1187742',
                'tax_registration_number' => '100456789000003',
                'bank_name' => 'Emirates NBD',
                'account_name' => 'Al Marsa Properties L.L.C.',
                'iban' => 'AE070331234567890123456',
                'address' => 'Office 702, Marsa Plaza, Dubai Festival City, Dubai',
                'notes' => 'Leases Jebel Ali Staff Residence to Horizon. Quarterly post-dated cheques, collected each January.',
            ],
            [
                'landlord_type' => 'individual',
                'name' => self::HAMDAN,
                'contact_person_name' => 'Hamdan Al Falasi',
                'email' => 'hamdan.falasi@example.test',
                'phone' => '+971 50 765 4321',
                'id_number' => '784-1975-1234567-1',
                'bank_name' => 'Abu Dhabi Commercial Bank',
                'account_name' => 'Hamdan Al Falasi',
                'iban' => 'AE460030000123456789012',
                'address' => 'Villa 18, Street 12b, Al Barsha 2, Dubai',
                'notes' => 'Owns the plot next to Al Quoz Worker Village; a lease is under discussion.',
            ],
        ];
    }
}
