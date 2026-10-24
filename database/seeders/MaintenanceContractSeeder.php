<?php

namespace Database\Seeders;

use App\Models\MaintenanceContract;
use App\Models\MaintenanceVisit;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Maintenance contracts for the demo properties. Fire safety: Al Quoz
 * covered for the year with a valid Civil Defence certificate, and Jebel Ali
 * on a renewed contract that is itself due for renewal soon, with a visit
 * overdue. Then one contract of each other kind, some running, one due for
 * renewal, leaving a property uncovered here and there. The pest control
 * company's monthly visits are on its schedule: those passed are done
 * (one a day late), the next is two days away so the dashboard flags it,
 * and the rest are still to come. No cheques are seeded for these
 * contracts, so the seeded cheque figures stay as they were; each contract
 * page offers to set its cheques up.
 *
 * Safe to re-run: a contract is matched on the contractor's reference
 * within the company. Requires PortfolioSeeder.
 */
class MaintenanceContractSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $user = $company->users()->orderBy('id')->first();
        $contracts = [];

        foreach ($this->contracts() as $key => $row) {
            $contract = $company->maintenanceContracts()->firstOrNew(['reference_number' => $row['reference_number']]);

            if (! $contract->exists) {
                $property = $company->properties()->where('code', $row['property'])->firstOrFail();

                $contract->fill(array_diff_key($row, array_flip(['service', 'property', 'renews'])));
                $contract->forceFill([
                    'service' => $row['service'] ?? 'fire_safety',
                    'property_id' => $property->id,
                    'renewed_from_id' => isset($row['renews']) ? $contracts[$row['renews']]->id : null,
                    'contract_number' => MaintenanceContract::nextNumber($company->id, $row['start_date']),
                    'status' => 'active',
                    'created_by' => $user?->id,
                ])->save();
            }

            $contracts[$key] = $contract;
        }

        if ($contracts['alQuozPestControl']->visits()->doesntExist()) {
            $this->seedVisits($contracts['alQuozPestControl'], $user);
        }
    }

    /**
     * A monthly treatment on the 10th of each month of the term. Those
     * passed were done (the fourth a day late, after the company asked to
     * move it); the next visit falls two days from today, confirmed.
     */
    private function seedVisits(MaintenanceContract $contract, ?User $user): void
    {
        $technicians = ['Joseph Mathew', 'Anil Kumar', 'Rizwan Ali'];
        $nextPlaced = false;

        for ($month = 0; $month < $contract->termMonths(); $month++) {
            $planned = $contract->start_date->copy()->addMonthsNoOverflow($month)->day(10);
            $isPast = $planned->lt(today());
            $isNext = ! $isPast && ! $nextPlaced;
            $nextPlaced = $nextPlaced || $isNext;
            $date = match (true) {
                $isNext => today()->addDays(2),
                $isPast && $month === 3 => $planned->copy()->addDay(),
                default => $planned,
            };

            $visit = new MaintenanceVisit(['scheduled_on' => $date]);
            $visit->forceFill([
                'company_id' => $contract->company_id,
                'maintenance_contract_id' => $contract->id,
                'rescheduled_from' => $isPast && $month === 3 ? $planned : null,
                'status' => $isPast ? 'done' : ($isNext ? 'confirmed' : 'scheduled'),
                'completed_on' => $isPast ? $date : null,
                'technician_name' => $isPast ? $technicians[$month % count($technicians)] : null,
                'report_number' => $isPast ? sprintf('SPC-SR-%04d', 2210 + $month) : null,
                'notes' => $isPast && $month === 3 ? 'Moved a day at our request; kitchen deep clean that morning.' : null,
                'created_by' => $user?->id,
                'updated_by' => $isPast ? $user?->id : null,
            ])->save();
        }

        $contract->syncLastVisit();
    }

    /**
     * The demo contracts, oldest first so a renewal can point at the term
     * before it (`renews`). A row without a `service` is fire safety.
     *
     * @return array<string, array<string, mixed>>
     */
    private function contracts(): array
    {
        $jebelAliStart = today()->addDays(25)->subYear()->addDay();

        $redLine = [
            'property' => PropertySeeder::JEBEL_ALI,
            'vendor_name' => 'Red Line Fire Protection L.L.C.',
            'vendor_contact_person' => 'Suresh Pillai',
            'vendor_phone' => '+971 4 887 3410',
            'vendor_email' => 'service@redlinefire.test',
            'vendor_licence_number' => 'DCD-FS-20871',
            'payment_terms' => 'half_yearly',
            'visit_frequency' => 'monthly',
            'response_time_hours' => 6,
            'coverage' => ['fire_alarm', 'extinguishers', 'hose_reels', 'emergency_lighting', 'exit_signs', 'gas_detection', 'kitchen_suppression'],
        ];

        return [
            'jebelAliLastYear' => [
                ...$redLine,
                'reference_number' => 'RLF/AMC/2024-118',
                'start_date' => $jebelAliStart->copy()->subYear(),
                'end_date' => $jebelAliStart->copy()->subDay(),
                'contract_value' => 9600,
                'last_visit_on' => $jebelAliStart->copy()->subDays(12),
                'certificate_number' => 'CD-JBA-2024-55120',
                'certificate_expires_on' => $jebelAliStart->copy()->addDays(20),
            ],
            'jebelAli' => [
                ...$redLine,
                'renews' => 'jebelAliLastYear',
                'reference_number' => 'RLF/AMC/2025-142',
                'start_date' => $jebelAliStart,
                'end_date' => today()->addDays(25),
                'contract_value' => 10200,
                'last_visit_on' => today()->subDays(40),
                'certificate_number' => 'CD-JBA-2025-61874',
                'certificate_expires_on' => today()->addDays(45),
                'notes' => 'Kitchen hood suppression added this year after the Civil Defence inspection.',
            ],
            'alQuoz' => [
                'property' => PropertySeeder::AL_QUOZ,
                'vendor_name' => 'Fire Shield Safety Systems L.L.C.',
                'vendor_contact_person' => 'Imran Qureshi',
                'vendor_phone' => '+971 50 334 9120',
                'vendor_email' => 'amc@fireshield.test',
                'vendor_licence_number' => 'DCD-FS-19436',
                'reference_number' => 'FSS-AMC-0457',
                'start_date' => today()->subMonths(5)->startOfMonth(),
                'end_date' => today()->subMonths(5)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 14500,
                'payment_terms' => 'quarterly',
                'visit_frequency' => 'quarterly',
                'last_visit_on' => today()->subDays(48),
                'response_time_hours' => 4,
                'coverage' => ['fire_alarm', 'extinguishers', 'hose_reels', 'sprinklers', 'fire_pumps', 'emergency_lighting', 'exit_signs', 'fire_doors'],
                'certificate_number' => 'CD-AQZ-2026-70321',
                'certificate_expires_on' => today()->subMonths(5)->startOfMonth()->addYear(),
            ],
            'jebelAliLifts' => [
                'service' => 'lifts',
                'property' => PropertySeeder::JEBEL_ALI,
                'vendor_name' => 'Skyline Elevators L.L.C.',
                'vendor_contact_person' => 'Mohammed Rafi',
                'vendor_phone' => '+971 4 556 2180',
                'vendor_email' => 'service@skylinelifts.test',
                'vendor_licence_number' => 'TL-884210',
                'reference_number' => 'SKY-AMC-3391',
                'start_date' => today()->subMonths(3)->startOfMonth(),
                'end_date' => today()->subMonths(3)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 18000,
                'payment_terms' => 'quarterly',
                'visit_frequency' => 'monthly',
                'last_visit_on' => today()->subDays(18),
                'response_time_hours' => 2,
                'coverage' => ['passenger_lifts', 'preventive_maintenance', 'breakdown_callouts', 'rescue_service', 'lift_alarm', 'annual_inspection'],
                'certificate_number' => 'LIC-JBA-2026-0412',
                'certificate_expires_on' => today()->addDays(70),
            ],
            'alQuozGarbage' => [
                'service' => 'garbage',
                'property' => PropertySeeder::AL_QUOZ,
                'vendor_name' => 'Green Bin Waste Services',
                'vendor_contact_person' => 'Faisal Ahmed',
                'vendor_phone' => '+971 55 218 4470',
                'vendor_licence_number' => 'DM-WT-55821',
                'reference_number' => 'GB-2026-118',
                'start_date' => today()->subMonths(2)->startOfMonth(),
                'end_date' => today()->subMonths(2)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 21600,
                'payment_terms' => 'monthly',
                'visit_frequency' => 'daily',
                'coverage' => ['general_waste', 'kitchen_waste', 'bins_supply', 'bin_washing', 'disposal_fees'],
                'certificate_number' => 'DM-WP-2026-30874',
                'certificate_expires_on' => today()->addMonths(8),
            ],
            'alQuozGreaseTraps' => [
                'service' => 'grease_traps',
                'property' => PropertySeeder::AL_QUOZ,
                'vendor_name' => 'Clear Flow Grease Solutions',
                'vendor_phone' => '+971 50 667 0912',
                'vendor_licence_number' => 'DM-GT-11930',
                'reference_number' => 'CF-AMC-0274',
                'start_date' => today()->subMonths(4)->startOfMonth(),
                'end_date' => today()->subMonths(4)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 7200,
                'payment_terms' => 'monthly',
                'visit_frequency' => 'monthly',
                'last_visit_on' => today()->subDays(12),
                'coverage' => ['trap_cleaning', 'grease_removal', 'line_jetting', 'disposal_records'],
                'notes' => 'Camp kitchen has two traps: under the main sink and outside the wash area.',
            ],
            'alQuozDrainage' => [
                'service' => 'drainage',
                'property' => PropertySeeder::AL_QUOZ,
                'vendor_name' => 'Al Saqr Sewage Tankers',
                'vendor_contact_person' => 'Rashid Khan',
                'vendor_phone' => '+971 50 991 3307',
                'vendor_licence_number' => 'DM-ST-20417',
                'reference_number' => 'ASQ-2025-0631',
                'start_date' => today()->addDays(35)->subYear()->addDay(),
                'end_date' => today()->addDays(35),
                'contract_value' => 15600,
                'payment_terms' => 'per_visit',
                'visit_frequency' => 'weekly',
                'last_visit_on' => today()->subDays(4),
                'response_time_hours' => 12,
                'coverage' => ['septic_tanks', 'sewage_tanker', 'manholes', 'blockage_callouts'],
            ],
            'alQuozPestControl' => [
                'service' => 'pest_control',
                'property' => PropertySeeder::AL_QUOZ,
                'vendor_name' => 'Shield Pest Control Services',
                'vendor_contact_person' => 'Joseph Mathew',
                'vendor_phone' => '+971 4 339 7765',
                'vendor_email' => 'bookings@shieldpest.test',
                'vendor_licence_number' => 'DM-PC-08812',
                'reference_number' => 'SPC-AMC-1540',
                'start_date' => today()->subMonths(6)->startOfMonth(),
                'end_date' => today()->subMonths(6)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 9000,
                'payment_terms' => 'quarterly',
                'visit_frequency' => 'monthly',
                'last_visit_on' => today()->subDays(22),
                'coverage' => ['crawling_insects', 'bed_bugs', 'rodents', 'flies_mosquitoes', 'kitchen_areas'],
                'certificate_number' => 'SPC-CERT-2026-221',
                'certificate_expires_on' => today()->addDays(8),
            ],
            'jebelAliAirConditioning' => [
                'service' => 'air_conditioning',
                'property' => PropertySeeder::JEBEL_ALI,
                // The same company the maintenance jobs call out for AC faults.
                'vendor_name' => 'Cool Breeze AC Maintenance',
                'vendor_phone' => '+971 4 338 9021',
                'vendor_licence_number' => 'TL-702145',
                'reference_number' => 'CB-AMC-0098',
                'start_date' => today()->subMonths(1)->startOfMonth(),
                'end_date' => today()->subMonths(1)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 24000,
                'payment_terms' => 'quarterly',
                'visit_frequency' => 'quarterly',
                'response_time_hours' => 24,
                'coverage' => ['split_units', 'filter_cleaning', 'coil_cleaning', 'gas_refill', 'spare_parts'],
            ],
            'jebelAliWaterTanks' => [
                'service' => 'water_tanks',
                'property' => PropertySeeder::JEBEL_ALI,
                'vendor_name' => 'Aqua Pure Tank Cleaning',
                'vendor_phone' => '+971 56 402 8813',
                'vendor_licence_number' => 'DM-WTC-4471',
                'reference_number' => 'APT-2026-0057',
                'start_date' => today()->subMonths(5)->startOfMonth(),
                'end_date' => today()->subMonths(5)->startOfMonth()->addYear()->subDay(),
                'contract_value' => 3200,
                'payment_terms' => 'per_visit',
                'visit_frequency' => 'half_yearly',
                'last_visit_on' => today()->subMonths(5)->startOfMonth()->addDays(6),
                'coverage' => ['roof_tanks', 'ground_tanks', 'tank_cleaning', 'disinfection', 'water_testing'],
                'certificate_number' => 'DM-TC-2026-11938',
                'certificate_expires_on' => today()->subMonths(5)->startOfMonth()->addDays(6)->addMonths(6),
            ],
        ];
    }
}
