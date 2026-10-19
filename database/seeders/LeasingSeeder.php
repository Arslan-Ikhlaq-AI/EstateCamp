<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * The demo company's leasing: beds, landlords and head leases, clients and
 * their contracts, the people staying, the invoices and payments, and the
 * cheques behind them.
 * Requires PortfolioSeeder.
 */
class LeasingSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds. The order matters: each seeder needs the
     * records created by the ones before it.
     */
    public function run(): void
    {
        $this->call([
            BedSeeder::class,
            LandlordSeeder::class,
            HeadLeaseSeeder::class,
            ClientSeeder::class,
            ContractSeeder::class,
            OccupancySeeder::class,
            InvoiceSeeder::class,
            PaymentSeeder::class,
            ChequeSeeder::class,
        ]);
    }
}
