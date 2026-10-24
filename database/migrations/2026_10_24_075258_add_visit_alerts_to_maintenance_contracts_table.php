<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * How many days before a scheduled visit the dashboard starts warning
     * about it, and a third way to pay: every four months (three cheques a
     * year). The composite key lets visits tie their contract to their company.
     */
    public function up(): void
    {
        Schema::table('maintenance_contracts', function (Blueprint $table) {
            $table->unsignedTinyInteger('visit_alert_days')->default(5)->after('response_time_hours');
            $table->unique(['id', 'company_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table maintenance_contracts
                drop constraint maintenance_contracts_payment_terms_check,
                add constraint maintenance_contracts_payment_terms_check check (payment_terms in ('upfront', 'half_yearly', 'four_monthly', 'quarterly', 'monthly', 'per_visit')),
                add constraint maintenance_contracts_visit_alert_days_check check (visit_alert_days between 1 and 30)"
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
                "alter table maintenance_contracts
                drop constraint maintenance_contracts_visit_alert_days_check,
                drop constraint maintenance_contracts_payment_terms_check,
                add constraint maintenance_contracts_payment_terms_check check (payment_terms in ('upfront', 'half_yearly', 'quarterly', 'monthly', 'per_visit'))"
            );
        }

        Schema::table('maintenance_contracts', function (Blueprint $table) {
            $table->dropUnique(['id', 'company_id']);
            $table->dropColumn('visit_alert_days');
        });
    }
};
