<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Contract;
use App\Models\Property;
use Illuminate\Database\Seeder;

/**
 * Eleven client contracts covering every kind of line: blocks of beds
 * billed as contracted or as actually used, whole rooms, apartments and
 * shops (with VAT). Nine are running; two drafts hold units that are
 * reserved for next month.
 *
 * The occupied and reserved apartments and shops from ApartmentSeeder and
 * ShopSeeder are exactly the ones these contracts rent, and syncing the
 * contracts keeps those statuses. Safe to re-run: contracts are matched on
 * their number and lines on the unit they rent.
 * Requires ClientSeeder, RoomSeeder, ApartmentSeeder and ShopSeeder.
 */
class ContractSeeder extends Seeder
{
    /**
     * Properties already looked up, by code.
     *
     * @var array<string, Property>
     */
    private array $properties = [];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->contracts() as $terms) {
            $client = $company->clients()->where('name', $terms['client'])->firstOrFail();
            $lines = $terms['lines'];
            unset($terms['client'], $terms['lines']);

            $contract = $company->contracts()->updateOrCreate(
                ['contract_number' => $terms['contract_number']],
                [...$terms, 'client_id' => $client->id],
            );

            foreach ($lines as $line) {
                $this->saveLine($company, $contract, $line);
            }

            $contract->syncUnitStatuses();
        }
    }

    /**
     * Save one line, looking its unit up by property code and unit number.
     *
     * @param  array<string, mixed>  $line
     */
    private function saveLine(Company $company, Contract $contract, array $line): void
    {
        $property = $this->properties[$line['property']] ??= $company->properties()->where('code', $line['property'])->firstOrFail();
        $unit = $this->unitColumns($property, $line);

        $contract->lines()->updateOrCreate(
            ['unit_type' => $line['type'], ...$unit],
            [
                'company_id' => $company->id,
                'property_id' => $property->id,
                'quantity' => $line['quantity'] ?? 1,
                'monthly_rate' => $line['rate'],
                'billing_basis' => $line['basis'] ?? 'contracted',
                'vat_rate' => $line['vat'] ?? 0,
                'start_date' => $contract->start_date,
                'end_date' => $contract->end_date,
                'description' => $line['description'] ?? null,
            ],
        );
    }

    /**
     * The room, apartment or shop foreign key the line rents.
     *
     * @param  array<string, mixed>  $line
     * @return array<string, int>
     */
    private function unitColumns(Property $property, array $line): array
    {
        return match (true) {
            isset($line['room']) => ['room_id' => $property->rooms()->where('room_number', $line['room'])->firstOrFail()->id],
            isset($line['apartment']) => ['apartment_id' => $property->apartments()->where('apartment_number', $line['apartment'])->firstOrFail()->id],
            isset($line['shop']) => ['shop_id' => $property->shops()->where('shop_number', $line['shop'])->firstOrFail()->id],
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function contracts(): array
    {
        $aq = PropertySeeder::AL_QUOZ;
        $ja = PropertySeeder::JEBEL_ALI;

        return [
            [
                'contract_number' => 'CTR-2026-0001', 'client' => ClientSeeder::GULF_BUILDERS, 'status' => 'active',
                'start_date' => '2026-01-01', 'end_date' => '2027-12-31', 'signed_on' => '2025-12-20', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 7, 'security_deposit' => 10000, 'ejari_number' => 'EJ-2026-118720',
                'notes' => 'Site crews for the Al Quoz warehouse project. Sixteen beds are paid for whether used or not.',
                'lines' => [
                    ['type' => 'bed', 'property' => $aq, 'room' => '101', 'quantity' => 8, 'rate' => 450, 'description' => 'Dormitory beds for the site crew'],
                    ['type' => 'bed', 'property' => $aq, 'room' => '102', 'quantity' => 8, 'rate' => 450, 'description' => 'Dormitory beds for the site crew'],
                    ['type' => 'apartment', 'property' => $aq, 'apartment' => 'C-101', 'rate' => 7500, 'description' => 'Project manager accommodation'],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0002', 'client' => ClientSeeder::AL_NOOR, 'status' => 'active',
                'start_date' => '2026-03-01', 'end_date' => '2027-12-31', 'signed_on' => '2026-02-20', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 10, 'security_deposit' => 4800, 'ejari_number' => 'EJ-2026-131055',
                'notes' => 'Supervisor beds billed on actual use: only beds with someone in them during the month are charged.',
                'lines' => [
                    ['type' => 'bed', 'property' => $aq, 'room' => '103', 'quantity' => 4, 'rate' => 600, 'basis' => 'actual', 'description' => 'Supervisor beds'],
                    ['type' => 'bed', 'property' => $aq, 'room' => '201', 'quantity' => 4, 'rate' => 600, 'basis' => 'actual', 'description' => 'Supervisor beds'],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0003', 'client' => ClientSeeder::DESERT_LINE, 'status' => 'active',
                'start_date' => '2026-02-01', 'end_date' => '2028-01-31', 'signed_on' => '2026-01-25', 'billing_cycle' => 'quarterly',
                'payment_terms_days' => 14, 'security_deposit' => 12300, 'ejari_number' => 'EJ-2026-125409',
                'notes' => 'Office staff housing. Whole rooms are charged per room, however many beds are used.',
                'lines' => [
                    ['type' => 'room', 'property' => $ja, 'room' => '103', 'rate' => 2200, 'description' => 'Twin room for female staff'],
                    ['type' => 'room', 'property' => $ja, 'room' => '201', 'rate' => 2200, 'description' => 'Twin room for male staff'],
                    ['type' => 'apartment', 'property' => $ja, 'apartment' => 'B-401', 'rate' => 7900, 'description' => 'Shared apartment for two team leads'],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0004', 'client' => ClientSeeder::RAHUL, 'status' => 'active',
                'start_date' => '2026-06-01', 'end_date' => '2027-11-30', 'signed_on' => '2026-05-28', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 5, 'security_deposit' => 1500, 'ejari_number' => null,
                'notes' => 'Private room near reception.',
                'lines' => [
                    ['type' => 'room', 'property' => $ja, 'room' => '101', 'rate' => 1500],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0005', 'client' => ClientSeeder::DANIEL, 'status' => 'active',
                'start_date' => '2026-04-15', 'end_date' => '2027-10-14', 'signed_on' => '2026-04-10', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 5, 'security_deposit' => 1700, 'ejari_number' => null,
                'notes' => 'Corner room with a balcony. Billing runs from the 15th of each month.',
                'lines' => [
                    ['type' => 'room', 'property' => $ja, 'room' => '202', 'rate' => 1700],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0006', 'client' => ClientSeeder::AISHA, 'status' => 'active',
                'start_date' => '2026-05-01', 'end_date' => '2027-10-31', 'signed_on' => '2026-04-22', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 7, 'security_deposit' => 3800, 'ejari_number' => 'EJ-2026-139982',
                'notes' => 'Furnished studio.',
                'lines' => [
                    ['type' => 'apartment', 'property' => $ja, 'apartment' => 'B-301', 'rate' => 3800],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0007', 'client' => ClientSeeder::MINI_MART, 'status' => 'active',
                'start_date' => '2026-01-01', 'end_date' => '2028-12-31', 'signed_on' => '2025-12-15', 'billing_cycle' => 'quarterly',
                'payment_terms_days' => 14, 'security_deposit' => 6500, 'ejari_number' => 'EJ-2026-117301',
                'notes' => 'Commercial lease; 5% VAT on rent.',
                'lines' => [
                    ['type' => 'shop', 'property' => $aq, 'shop' => 'G-01', 'rate' => 6500, 'vat' => 5],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0008', 'client' => ClientSeeder::FRESHFOLD, 'status' => 'active',
                'start_date' => '2026-03-01', 'end_date' => '2028-02-29', 'signed_on' => '2026-02-18', 'billing_cycle' => 'quarterly',
                'payment_terms_days' => 14, 'security_deposit' => 4800, 'ejari_number' => 'EJ-2026-130466',
                'notes' => 'Commercial lease; 5% VAT on rent. September cheque bounced.',
                'lines' => [
                    ['type' => 'shop', 'property' => $aq, 'shop' => 'G-02', 'rate' => 4800, 'vat' => 5],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0009', 'client' => ClientSeeder::BREW_CORNER, 'status' => 'active',
                'start_date' => '2026-07-01', 'end_date' => '2028-06-30', 'signed_on' => '2026-06-20', 'billing_cycle' => 'monthly',
                'payment_terms_days' => 7, 'security_deposit' => 5600, 'ejari_number' => 'EJ-2026-150218',
                'notes' => 'Commercial lease; 5% VAT on rent.',
                'lines' => [
                    ['type' => 'shop', 'property' => $ja, 'shop' => 'G-01', 'rate' => 5600, 'vat' => 5],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0010', 'client' => ClientSeeder::DESERT_LINE, 'status' => 'draft',
                'start_date' => '2026-11-01', 'end_date' => '2027-10-31', 'signed_on' => null, 'billing_cycle' => 'monthly',
                'payment_terms_days' => 14, 'security_deposit' => 5400, 'ejari_number' => null,
                'notes' => 'Draft for the new logistics manager joining in November; awaiting signature.',
                'lines' => [
                    ['type' => 'apartment', 'property' => $ja, 'apartment' => 'B-303', 'rate' => 5400],
                ],
            ],
            [
                'contract_number' => 'CTR-2026-0011', 'client' => ClientSeeder::SAMEER, 'status' => 'draft',
                'start_date' => '2026-11-15', 'end_date' => '2027-11-14', 'signed_on' => null, 'billing_cycle' => 'monthly',
                'payment_terms_days' => 7, 'security_deposit' => 3200, 'ejari_number' => null,
                'notes' => 'Barber shop opening mid-November; trade licence in progress.',
                'lines' => [
                    ['type' => 'shop', 'property' => $aq, 'shop' => 'G-03', 'rate' => 3200, 'vat' => 5],
                ],
            ],
        ];
    }
}
