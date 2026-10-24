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
     * Paying a maintenance bill now issues a payment voucher (PV-2026-0001)
     * and keeps the payment's reference and who recorded it. Jobs already
     * paid are given vouchers in the order they were paid.
     */
    public function up(): void
    {
        Schema::table('maintenance_jobs', function (Blueprint $table) {
            $table->string('voucher_number', 30)->nullable()->after('paid_on');
            $table->string('payment_reference', 100)->nullable()->after('voucher_number');
            $table->foreignId('paid_by')->nullable()->after('payment_reference')->constrained('users')->nullOnDelete();

            $table->unique(['company_id', 'voucher_number']);
        });

        $sequence = [];

        DB::table('maintenance_jobs')
            ->whereNotNull('paid_on')
            ->orderBy('paid_on')
            ->orderBy('id')
            ->get(['id', 'company_id', 'paid_on'])
            ->each(function (object $job) use (&$sequence) {
                $year = substr((string) $job->paid_on, 0, 4);
                $key = "{$job->company_id}-{$year}";
                $sequence[$key] = ($sequence[$key] ?? 0) + 1;

                DB::table('maintenance_jobs')->where('id', $job->id)->update(['voucher_number' => sprintf('PV-%s-%04d', $year, $sequence[$key])]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('maintenance_jobs', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'voucher_number']);
            $table->dropConstrainedForeignId('paid_by');
            $table->dropColumn(['voucher_number', 'payment_reference']);
        });
    }
};
