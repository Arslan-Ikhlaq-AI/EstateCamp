<?php

namespace Database\Seeders;

use App\Models\Cheque;
use App\Models\HeadLease;
use Illuminate\Database\Seeder;

/**
 * The staff residence's head leases from Al Marsa: last year's, now
 * expired, and the three-year renewal running today. Al Quoz Worker Village
 * is owned, so it has none.
 *
 * Each lease gets its cheque schedule (the security deposit plus quarterly
 * rent). The cheques for the lease year running today, and every earlier
 * one, are written with a photo; those whose date has come have cleared.
 * Safe to re-run: leases are matched on their number, and a schedule with
 * cleared cheques is never rebuilt.
 * Requires PropertySeeder and LandlordSeeder.
 */
class HeadLeaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $property = $company->properties()->where('code', PropertySeeder::JEBEL_ALI)->firstOrFail();
        $landlord = $company->landlords()->where('name', LandlordSeeder::AL_MARSA)->firstOrFail();
        $previous = null;

        foreach ($this->leases() as $terms) {
            $lease = $company->headLeases()->updateOrCreate(
                ['lease_number' => $terms['lease_number']],
                [
                    ...$terms,
                    'property_id' => $property->id,
                    'landlord_id' => $landlord->id,
                    'renewed_from_id' => $previous?->id,
                ],
            );

            $lease->syncCheques();
            $this->writeCheques($lease);
            $lease->syncPropertyLease();

            $previous = $lease;
        }

        // The residence's documents are filed under the lease it runs on today.
        $property->documents()->update(['head_lease_id' => $previous->id]);
    }

    /**
     * Write the cheques due by the end of the lease year running today, with
     * a photo, and clear those whose date has come.
     */
    private function writeCheques(HeadLease $lease): void
    {
        [, $yearEnd] = $lease->currentChequeYear();

        $lease->cheques()
            ->whereNull('replaces_id')
            ->whereDate('cheque_date', '<=', $yearEnd)
            ->orderBy('cheque_date')
            ->get()
            ->filter(fn (Cheque $cheque) => $cheque->isEditable())
            ->each(function (Cheque $cheque) use ($lease) {
                $cheque->applyEntry([
                    'cheque_number' => sprintf('%06d', 400000 + $lease->start_date->year % 100 * 100 + ($cheque->purpose === 'rent' ? $cheque->sequence : 0)),
                    'bank_name' => 'Emirates NBD',
                    'account_holder' => LandlordSeeder::AL_MARSA,
                ]);
                ChequeSeeder::attachDemoPhoto($cheque);

                if ($cheque->cheque_date->lte(today())) {
                    $cheque->clear($cheque->cheque_date);
                }
            });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function leases(): array
    {
        return [
            [
                'lease_number' => 'HL-2025-0001',
                'ejari_number' => '0012025-JBA-1123',
                'start_date' => '2025-01-01',
                'end_date' => '2025-12-31',
                'annual_rent' => 720000,
                'payments_per_year' => 4,
                'security_deposit' => 36000,
                'notice_period_days' => 90,
                'status' => 'expired',
                'notes' => 'First year at the staff residence, renewed for three years at a higher rent.',
            ],
            [
                // The dates match what PropertySeeder stores on the leased property.
                'lease_number' => 'HL-2026-0001',
                'ejari_number' => '0012026-JBA-2241',
                'start_date' => '2026-01-01',
                'end_date' => '2028-12-31',
                'annual_rent' => 780000,
                'payments_per_year' => 4,
                'security_deposit' => 39000,
                'notice_period_days' => 90,
                'status' => 'active',
                'notes' => 'Three-year renewal. Rent is fixed for the term; renewal talks open 90 days before the end.',
            ],
        ];
    }
}
