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
     * An invoice bills one period of one contract. `client_id` repeats the
     * contract's client so payments can be matched to invoices by client; the
     * (contract_id, client_id) foreign key keeps the two in agreement.
     * `amount_paid` caches the cleared payments allocated to it.
     *
     * On PostgreSQL an exclusion constraint stops a contract from being billed
     * twice for the same days, unless the earlier invoice was voided.
     */
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('client_id');
            $table->string('invoice_number', 30);
            $table->date('issue_date');
            $table->date('due_date');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('vat_amount', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->decimal('amount_paid', 14, 2)->default(0);
            $table->string('status', 20)->default('issued');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['contract_id', 'company_id'])->references(['id', 'company_id'])->on('contracts')->restrictOnDelete();
            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            $table->foreign(['contract_id', 'client_id'])->references(['id', 'client_id'])->on('contracts')->restrictOnDelete();
            $table->unique(['company_id', 'invoice_number']);
            // Target for payment_allocations' (invoice_id, client_id) foreign key.
            $table->unique(['id', 'client_id']);
            $table->index(['company_id', 'status', 'due_date']);
            $table->index('contract_id');
            $table->index('client_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table invoices
                add constraint invoices_status_check check (status in ('issued', 'partially_paid', 'paid', 'void')),
                add constraint invoices_amounts_check check (
                    subtotal >= 0 and vat_amount >= 0 and total = subtotal + vat_amount
                    and amount_paid >= 0 and amount_paid <= total
                ),
                add constraint invoices_dates_check check (period_end >= period_start and due_date >= issue_date),
                add constraint invoices_no_overlap exclude using gist (
                    contract_id with =,
                    daterange(period_start, period_end, '[]') with &&
                ) where (status <> 'void')"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
