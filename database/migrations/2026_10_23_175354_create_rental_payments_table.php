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
     * Money an individual pays towards their room rental: rent, the security
     * deposit or another charge, each with its own receipt number. A rent
     * receipt records the months it paid for when it was issued. A receipt
     * made by mistake is voided rather than deleted, so the numbering has no
     * holes; a payment by cheque is recorded once the cheque clears and
     * points back to it.
     *
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('rental_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('room_rental_id');
            $table->string('receipt_number', 30);
            $table->date('paid_on');
            $table->decimal('amount', 12, 2);
            $table->string('purpose', 20)->default('rent');
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->foreignId('cheque_id')->nullable()->unique()->constrained('cheques')->nullOnDelete();
            $table->string('status', 20)->default('cleared');
            $table->date('voided_on')->nullable();
            $table->string('void_reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['room_rental_id', 'company_id'])->references(['id', 'company_id'])->on('room_rentals')->restrictOnDelete();
            $table->unique(['company_id', 'receipt_number']);
            $table->index(['company_id', 'paid_on']);
            $table->index('room_rental_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table rental_payments
                add constraint rental_payments_amount_check check (amount > 0),
                add constraint rental_payments_purpose_check check (purpose in ('rent', 'deposit', 'other')),
                add constraint rental_payments_method_check check (method in ('cash', 'bank_transfer', 'card', 'cheque')),
                add constraint rental_payments_status_check check (status in ('cleared', 'void')),
                add constraint rental_payments_void_check check (status <> 'void' or voided_on is not null),
                add constraint rental_payments_period_check check (period_end >= period_start)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rental_payments');
    }
};
