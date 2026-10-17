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
     * Money received from a client. A post-dated cheque is `pending` until it
     * clears; only cleared payments count towards an invoice being paid. The
     * check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('client_id');
            $table->string('payment_number', 30);
            $table->date('received_on');
            $table->decimal('amount', 14, 2);
            $table->string('method', 20);
            $table->string('status', 20)->default('cleared');
            $table->string('reference', 100)->nullable();
            $table->string('cheque_number', 30)->nullable();
            $table->date('cheque_date')->nullable();
            $table->string('bank_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            $table->unique(['company_id', 'payment_number']);
            // Target for payment_allocations' (payment_id, client_id) foreign key.
            $table->unique(['id', 'client_id']);
            $table->index(['company_id', 'received_on']);
            $table->index('client_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table payments
                add constraint payments_method_check check (method in ('cash', 'bank_transfer', 'cheque', 'card')),
                add constraint payments_status_check check (status in ('pending', 'cleared', 'bounced')),
                add constraint payments_amount_check check (amount > 0),
                add constraint payments_cheque_check check (
                    method = 'cheque' or (cheque_number is null and cheque_date is null and status <> 'pending')
                )"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
