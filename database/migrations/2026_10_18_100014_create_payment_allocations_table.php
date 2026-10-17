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
     * How much of a payment goes to which invoice. One payment can settle
     * several invoices and one invoice can be paid in parts. Both foreign keys
     * include client_id, so a payment can only be allocated to invoices of the
     * client who paid it. The check constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->unsignedBigInteger('payment_id');
            $table->unsignedBigInteger('invoice_id');
            $table->decimal('amount', 14, 2);
            $table->timestamps();

            $table->foreign(['payment_id', 'client_id'])->references(['id', 'client_id'])->on('payments')->cascadeOnDelete();
            $table->foreign(['invoice_id', 'client_id'])->references(['id', 'client_id'])->on('invoices')->restrictOnDelete();
            $table->unique(['payment_id', 'invoice_id']);
            $table->index('invoice_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table payment_allocations add constraint payment_allocations_amount_check check (amount > 0)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');
    }
};
