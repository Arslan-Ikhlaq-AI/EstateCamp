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
     * A contract either includes gas in its rent (`gas_included`, the
     * default, so existing contracts are unchanged) or the client pays for
     * the gas they use through monthly gas bills. Each gas bill is charged on
     * its own invoice, so invoices now have a `kind`: `rent` for the billing
     * periods of the contract, `gas` for a month's gas.
     *
     * Only rent invoices follow one another without overlapping, so on
     * PostgreSQL the exclusion constraint is narrowed to them, and invoice
     * items gain the `gas` type.
     */
    public function up(): void
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
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
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
};
