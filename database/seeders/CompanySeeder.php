<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * The demo company that owns the demo users, properties and rooms.
 *
 * Safe to re-run: the company is matched on its tax registration number and
 * updated in place.
 */
class CompanySeeder extends Seeder
{
    /**
     * Natural key of the demo company; the other demo seeders find it by this.
     */
    public const TAX_REGISTRATION_NUMBER = '100345678900003';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Company::updateOrCreate(
            ['tax_registration_number' => self::TAX_REGISTRATION_NUMBER],
            [
                'name' => 'Horizon Facilities Management',
                'legal_name' => 'Horizon Facilities Management L.L.C.',
                'short_name' => 'Horizon FM',
                'slug' => 'horizon-fm',
                'business_type' => 'staff_accommodation',
                'trade_license_number' => 'CN-4518273',
                'email' => 'info@horizonfm.test',
                'phone' => '+971 4 321 7788',
                'default_currency' => 'AED',
                'timezone' => 'Asia/Dubai',
                'status' => 'active',
                'description' => 'Workforce and staff accommodation operator across Dubai.',
                'logo_url' => '/images/demo/horizon-fm-logo.svg',
                'website' => 'https://horizonfm.test',
                'contact_person_name' => 'Omar Rahman',
                'contact_person_phone' => '+971 50 412 3366',
                'contact_person_email' => 'omar.rahman@horizonfm.test',
                'address_line_1' => 'Office 1204, Opal Tower',
                'address_line_2' => 'Business Bay',
                'city' => 'Dubai',
                'state' => 'Dubai',
                'postal_code' => '33478',
                'country_code' => 'AE',
                'expiry_date' => '2027-12-31',
                'terms_version' => Company::TERMS_VERSION,
                'terms_accepted_at' => '2026-10-16 09:00:00',
                'terms_accepted_ip' => '127.0.0.1',
            ],
        );
    }

    /**
     * The demo company created by this seeder.
     *
     * @throws RuntimeException When CompanySeeder has not been run yet.
     */
    public static function demoCompany(): Company
    {
        return Company::query()
            ->where('tax_registration_number', self::TAX_REGISTRATION_NUMBER)
            ->firstOr(fn () => throw new RuntimeException('The demo company does not exist yet. Run CompanySeeder first.'));
    }
}
