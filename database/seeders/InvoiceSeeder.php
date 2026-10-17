<?php

namespace Database\Seeders;

use App\Models\Contract;
use Illuminate\Database\Seeder;

/**
 * Every invoice the running contracts would have produced by today: one
 * per billing period that has started, issued on the period's first day.
 *
 * Safe to re-run: Contract::generateNextInvoice() only bills periods that
 * have no invoice yet. Requires OccupancySeeder, because lines billed on
 * actual use count the stays.
 */
class InvoiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $contracts = CompanySeeder::demoCompany()->contracts()->where('status', 'active')->orderBy('contract_number')->get();

        foreach ($contracts as $contract) {
            $this->invoiceStartedPeriods($contract);
        }
    }

    private function invoiceStartedPeriods(Contract $contract): void
    {
        while (($period = $contract->nextBillingPeriod()) !== null && $period[0]->lte(today())) {
            $contract->generateNextInvoice($period[0]);
        }
    }
}
