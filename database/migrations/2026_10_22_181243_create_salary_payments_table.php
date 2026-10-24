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
     * One staff member's salary for one month (`period` is its first day),
     * as worked out when the payroll is prepared: their monthly salary at the
     * time, the share of it earned for the days they were employed, what
     * absences took off, and any bonus or deduction added by hand. Once paid
     * it records when and how, and is no longer recalculated.
     *
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('salary_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('staff_member_id');
            $table->date('period');

            // The salary as it stood when the payroll was prepared.
            $table->decimal('basic_salary', 12, 2);
            $table->decimal('allowances', 12, 2)->default(0);
            $table->decimal('gross_salary', 12, 2);

            // The month as worked.
            $table->unsignedTinyInteger('days_in_month');
            $table->unsignedTinyInteger('payable_days');
            $table->json('attendance_counts')->nullable();
            $table->decimal('earned_salary', 12, 2);
            $table->decimal('absence_deduction', 12, 2)->default(0);
            $table->decimal('additions', 12, 2)->default(0);
            $table->decimal('deductions', 12, 2)->default(0);
            $table->decimal('net_pay', 12, 2);

            // Payment.
            $table->string('status', 20)->default('pending');
            $table->date('paid_on')->nullable();
            $table->string('payment_method', 20)->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('note', 500)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['staff_member_id', 'company_id'])->references(['id', 'company_id'])->on('staff_members')->restrictOnDelete();
            $table->unique(['staff_member_id', 'period']);
            $table->index(['company_id', 'period']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table salary_payments
                add constraint salary_payments_status_check check (status in ('pending', 'paid')),
                add constraint salary_payments_paid_check check ((status = 'paid') = (paid_on is not null)),
                add constraint salary_payments_payment_method_check check (payment_method in ('bank_transfer', 'cash', 'cheque')),
                add constraint salary_payments_days_check check (payable_days between 1 and days_in_month),
                add constraint salary_payments_amounts_check check (earned_salary >= 0 and absence_deduction >= 0 and additions >= 0 and deductions >= 0 and net_pay >= 0)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('salary_payments');
    }
};
