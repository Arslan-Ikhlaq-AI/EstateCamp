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
     * Gas is no longer billed. Contracts lose `gas_included`, the monthly gas
     * bills go, and every invoice is a rent invoice again, so invoices lose
     * their `kind`. On PostgreSQL the exclusion constraint covers every
     * invoice again and invoice items lose the `gas` type.
     */
    public function up(): void
    {
        Schema::dropIfExists('gas_bills');

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table invoice_items
                drop constraint invoice_items_item_type_check,
                add constraint invoice_items_item_type_check check (item_type in ('rent', 'deposit', 'other'))"
            );
            DB::statement(
                "alter table invoices
                drop constraint invoices_no_overlap,
                drop constraint invoices_kind_check,
                add constraint invoices_no_overlap exclude using gist (
                    contract_id with =,
                    daterange(period_start, period_end, '[]') with &&
                ) where (status <> 'void')"
            );
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'kind']);
            $table->dropColumn('kind');
        });

        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn('gas_included');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->boolean('gas_included')->default(true)->after('security_deposit');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('kind', 20)->default('rent')->after('invoice_number');

            $table->index(['company_id', 'kind']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table invoices
                drop constraint invoices_no_overlap,
                add constraint invoices_kind_check check (kind in ('rent', 'gas')),
                add constraint invoices_no_overlap exclude using gist (
                    contract_id with =,
                    daterange(period_start, period_end, '[]') with &&
                ) where (status <> 'void' and kind = 'rent')"
            );
            DB::statement(
                "alter table invoice_items
                drop constraint invoice_items_item_type_check,
                add constraint invoice_items_item_type_check check (item_type in ('rent', 'deposit', 'gas', 'other'))"
            );
        }

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
};
