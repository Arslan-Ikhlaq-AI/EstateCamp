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
     * The instalments the operator owes the landlord under a head lease,
     * usually one post-dated cheque each. The check constraints are
     * PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('head_lease_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('head_lease_id');
            $table->unsignedSmallInteger('installment_number');
            $table->date('due_date');
            $table->decimal('amount', 14, 2);
            $table->string('payment_method', 20)->default('cheque');
            $table->string('cheque_number', 30)->nullable();
            $table->string('bank_name')->nullable();
            $table->string('status', 20)->default('scheduled');
            $table->date('paid_on')->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['head_lease_id', 'company_id'])->references(['id', 'company_id'])->on('head_leases')->cascadeOnDelete();
            $table->unique(['head_lease_id', 'installment_number']);
            $table->index(['company_id', 'status', 'due_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table head_lease_payments
                add constraint head_lease_payments_status_check check (status in ('scheduled', 'paid', 'bounced', 'cancelled')),
                add constraint head_lease_payments_method_check check (payment_method in ('cheque', 'bank_transfer', 'cash')),
                add constraint head_lease_payments_amount_check check (amount > 0),
                add constraint head_lease_payments_paid_on_check check (status <> 'paid' or paid_on is not null)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('head_lease_payments');
    }
};
