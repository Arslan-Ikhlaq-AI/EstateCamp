<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database: the demo portfolio first, then the
     * leasing data that builds on it.
     */
    public function run(): void
    {
        $this->call([
            PortfolioSeeder::class,
            LeasingSeeder::class,
        ]);
    }
}
