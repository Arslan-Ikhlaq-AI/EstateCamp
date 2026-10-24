<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database: the demo portfolio first, then the
     * leasing data, maintenance jobs, maintenance contracts and staff that
     * build on it.
     */
    public function run(): void
    {
        $this->call([
            PortfolioSeeder::class,
            LeasingSeeder::class,
            MaintenanceJobSeeder::class,
            MaintenanceContractSeeder::class,
            StaffSeeder::class,
        ]);
    }
}
