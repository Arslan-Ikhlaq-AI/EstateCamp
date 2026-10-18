<?php

namespace Database\Seeders;

use App\Models\HeadLease;
use App\Models\HeadLeasePayment;
use Illuminate\Database\Seeder;

/**
 * The staff residence's head leases from Al Marsa: last year's, now
 * expired, and the three-year renewal running today. Al Quoz Worker Village
 * is owned, so it has none.
 *
 * Each lease gets its quarterly cheque schedule; every cheque already due
 * is marked paid. Safe to re-run: leases are matched on their number, and a
 * schedule with paid cheques is never rebuilt.
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

            $lease->rebuildSchedule();
            $this->payDueCheques($lease);
            $lease->syncPropertyLease();

            $previous = $lease;
        }

        // The residence's documents are filed under the lease it runs on today.
        $property->documents()->update(['head_lease_id' => $previous->id]);
    }

    /**
     * Mark every instalment due by today as paid by cheque on its due date.
     */
    private function payDueCheques(HeadLease $lease): void
    {
        $lease->payments()
            ->whereDate('due_date', '<=', today())
            ->get()
            ->each(fn (HeadLeasePayment $payment) => $payment->update([
                'status' => 'paid',
                'paid_on' => $payment->due_date,
                'payment_method' => 'cheque',
                'cheque_number' => sprintf('%06d', 400000 + $lease->start_date->year % 100 * 100 + $payment->installment_number),
                'bank_name' => 'Emirates NBD',
                'reference' => "{$lease->lease_number}/{$payment->installment_number}",
            ]));
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
