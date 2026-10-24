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
     * A month's gas at one property, charged to a client whose contract does
     * not include gas. The bill keeps what was used (the meter readings and
     * the rate per unit, when gas is metered) and what it comes to before
     * VAT; the client is charged on the bill's own invoice, which carries
     * the totals, what has been paid and whether it was voided.
     *
     * The composite foreign keys tie the contract and the property to the
     * bill's company. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('gas_bills', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('property_id');
            $table->foreignId('invoice_id')->unique()->constrained('invoices')->restrictOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('previous_reading', 12, 2)->nullable();
            $table->decimal('current_reading', 12, 2)->nullable();
            $table->decimal('unit_rate', 10, 2)->nullable();
            $table->decimal('amount', 12, 2);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->string('supplier_reference', 100)->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_name')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['contract_id', 'company_id'])->references(['id', 'company_id'])->on('contracts')->restrictOnDelete();
            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->index(['company_id', 'period_start']);
            $table->index('contract_id');
            $table->index('property_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table gas_bills
                add constraint gas_bills_amount_check check (amount >= 0 and vat_rate between 0 and 100 and (unit_rate is null or unit_rate >= 0)),
                add constraint gas_bills_readings_check check (previous_reading is null or current_reading is null or current_reading >= previous_reading),
                add constraint gas_bills_period_check check (period_end >= period_start)'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gas_bills');
    }
};
