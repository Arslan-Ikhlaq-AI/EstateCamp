<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A head lease's rent can now be split into any number of cheques from
     * one to twelve a year, not only counts that divide twelve months
     * evenly. The check constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table head_leases
                drop constraint if exists head_leases_payments_per_year_check,
                add constraint head_leases_payments_per_year_check check (payments_per_year between 1 and 12)'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table head_leases
                drop constraint if exists head_leases_payments_per_year_check,
                add constraint head_leases_payments_per_year_check check (payments_per_year in (1, 2, 3, 4, 6, 12))'
            );
        }
    }
};
