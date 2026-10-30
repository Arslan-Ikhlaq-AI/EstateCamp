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
     * Money a property earns besides rent, such as the share an internet,
     * gas or washing machine provider pays for serving the building: who
     * paid it, what for, how much, on which day and how, with the invoice.
     * It is recorded once received, so it is received or, if added by
     * mistake, cancelled. The invoice is kept on the private disk and
     * served only to the company's own users.
     *
     * A composite foreign key ties the property to the income's company.
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('extra_incomes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('property_id');
            $table->string('income_number', 30);

            $table->string('title');
            $table->string('received_from');
            $table->decimal('amount', 14, 2);
            $table->string('status', 20)->default('received');
            $table->date('received_on');
            $table->string('method', 20);
            $table->string('invoice_number', 100)->nullable();
            $table->string('invoice_path', 2048)->nullable();
            $table->string('invoice_name')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->unique(['company_id', 'income_number']);
            $table->index(['company_id', 'status', 'received_on']);
            $table->index(['property_id', 'received_on']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table extra_incomes
                add constraint extra_incomes_status_check check (status in ('received', 'cancelled')),
                add constraint extra_incomes_method_check check (method in ('cash', 'cheque', 'bank_transfer', 'card')),
                add constraint extra_incomes_amount_check check (amount > 0)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('extra_incomes');
    }
};
