<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Horizon's customers: six companies (three housing workers or staff, three
 * running shops) and four individuals.
 *
 * Safe to re-run: clients are matched on their name within the company.
 * Requires CompanySeeder.
 */
class ClientSeeder extends Seeder
{
    public const GULF_BUILDERS = 'Gulf Builders Contracting L.L.C.';

    public const AL_NOOR = 'Al Noor Facilities Services L.L.C.';

    public const DESERT_LINE = 'Desert Line Logistics L.L.C.';

    public const MINI_MART = 'Al Quoz Mini Mart Trading L.L.C.';

    public const FRESHFOLD = 'FreshFold Laundry Services L.L.C.';

    public const BREW_CORNER = 'Brew Corner Café L.L.C.';

    public const RAHUL = 'Rahul Menon';

    public const DANIEL = 'Daniel Okafor';

    public const AISHA = 'Aisha Rahman';

    public const SAMEER = 'Sameer Khan';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ([...$this->companies(), ...$this->individuals()] as $client) {
            $company->clients()->updateOrCreate(['name' => $client['name']], [...$client, 'status' => 'active']);
        }
    }

    /**
     * @return list<array<string, string>>
     */
    private function companies(): array
    {
        $company = fn (string $name, string $contact, string $email, string $phone, string $license, string $trn, string $address, string $notes) => [
            'client_type' => 'company',
            'name' => $name,
            'contact_person_name' => $contact,
            'email' => $email,
            'phone' => $phone,
            'trade_license_number' => $license,
            'tax_registration_number' => $trn,
            'address' => $address,
            'notes' => $notes,
        ];

        return [
            $company(self::GULF_BUILDERS, 'Ravi Shankar', 'hr@gulfbuilders.test', '+971 4 330 1200', 'CN-2214587', '100223344500003', 'Warehouse 14, Al Quoz Industrial Area 4, Dubai', 'Construction contractor. Houses site crews in the Al Quoz dormitories and its project manager in a supervisor flat.'),
            $company(self::AL_NOOR, 'Sana Iqbal', 'admin@alnoorfm.test', '+971 4 285 9910', 'CN-3398120', '100334455600003', 'Office 305, Al Qusais Plaza, Al Qusais, Dubai', 'Facilities contractor. Rents two supervisor rooms in Al Quoz.'),
            $company(self::DESERT_LINE, 'Peter Dsouza', 'people@desertline.test', '+971 4 887 4300', 'JAFZA-145523', '100445566700003', 'Plot S30412, Jebel Ali Free Zone South, Dubai', 'Logistics company. Rents whole rooms and an apartment for office staff; quarterly post-dated cheques.'),
            $company(self::MINI_MART, 'Abdul Rahim', 'abdul@aqminimart.test', '+971 55 230 4411', 'CN-4410982', '100556677800003', 'Shop G-01, Al Quoz Worker Village, Dubai', 'Runs the village mini market. Commercial lease, so VAT applies.'),
            $company(self::FRESHFOLD, 'Joseph Mathew', 'ops@freshfold.test', '+971 52 118 9032', 'CN-4519730', '100667788900003', 'Shop G-02, Al Quoz Worker Village, Dubai', 'Laundry operator. Its September cheque bounced; a replacement is being chased.'),
            $company(self::BREW_CORNER, 'Lina Haddad', 'hello@brewcorner.test', '+971 56 402 7781', 'CN-4602215', '100778899000003', 'Shop G-01, Jebel Ali Staff Residence, Dubai', 'Café in the staff residence lobby. Pays monthly by card.'),
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function individuals(): array
    {
        $person = fn (string $name, string $nationality, string $idType, string $idNumber, string $email, string $phone, string $notes) => [
            'client_type' => 'individual',
            'name' => $name,
            'contact_person_name' => $name,
            'email' => $email,
            'phone' => $phone,
            'id_type' => $idType,
            'id_number' => $idNumber,
            'nationality' => $nationality,
            'address' => 'Jebel Ali Staff Residence, Dubai',
            'notes' => $notes,
        ];

        return [
            $person(self::RAHUL, 'Indian', 'passport', 'P4821937', 'rahul.menon@example.test', '+971 50 334 2190', 'Engineer renting a private room; pays monthly in cash.'),
            $person(self::DANIEL, 'Nigerian', 'passport', 'A07264519', 'daniel.okafor@example.test', '+971 54 771 0832', 'Pays by monthly post-dated cheques.'),
            $person(self::AISHA, 'Bangladeshi', 'emirates_id', '784-1990-7654321-2', 'aisha.rahman@example.test', '+971 58 640 1177', 'Rents a studio apartment; pays by bank transfer.'),
            $person(self::SAMEER, 'Pakistani', 'passport', 'AB1234567', 'sameer.khan@example.test', '+971 55 902 6614', 'Opening a barber shop at the worker village next month.'),
        ];
    }
}
