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
     * The lines of an invoice. Rent items point back at the contract line
     * they bill; the deposit item has none. Each item carries its own VAT
     * rate, because shops and housing can be taxed differently. The check
     * constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('contract_line_id')->nullable()->constrained('contract_lines')->nullOnDelete();
            $table->string('item_type', 20)->default('rent');
            $table->string('description');
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->decimal('amount', 14, 2);
            $table->decimal('vat_amount', 14, 2)->default(0);
            $table->timestamps();

            $table->index('invoice_id');
            $table->index('contract_line_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table invoice_items
                add constraint invoice_items_item_type_check check (item_type in ('rent', 'deposit', 'other')),
                add constraint invoice_items_amounts_check check (
                    quantity > 0 and unit_price >= 0 and amount >= 0 and vat_amount >= 0 and vat_rate between 0 and 100
                )"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
