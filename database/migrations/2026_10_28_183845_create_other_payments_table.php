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
     * A one-off payment the company makes for a property that is neither
     * rent, a maintenance contract nor a maintenance job, such as a permit
     * fee or a supply bought for the building: what it was for, who was
     * paid, how much and how. It is to pay, paid (on `payment_date`) or
     * cancelled. The receipt is kept on the private disk and served only to
     * the company's own users.
     *
     * A composite foreign key ties the property to the payment's company.
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('other_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('property_id');
            $table->string('payment_number', 30);

            $table->string('title');
            $table->string('paid_to');
            $table->decimal('amount', 14, 2);
            $table->string('status', 20)->default('pending');
            $table->date('payment_date');
            $table->string('method', 20)->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('receipt_path', 2048)->nullable();
            $table->string('receipt_name')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->unique(['company_id', 'payment_number']);
            $table->index(['company_id', 'status', 'payment_date']);
            $table->index(['property_id', 'payment_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table other_payments
                add constraint other_payments_status_check check (status in ('pending', 'paid', 'cancelled')),
                add constraint other_payments_method_check check (method is null or method in ('cash', 'cheque', 'bank_transfer', 'card')),
                add constraint other_payments_amount_check check (amount > 0),
                add constraint other_payments_paid_method_check check (status <> 'paid' or method is not null)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('other_payments');
    }
};
