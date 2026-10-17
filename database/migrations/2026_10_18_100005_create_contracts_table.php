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
     * A contract is a client renting from the operator. What is rented lives
     * in contract_lines. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('client_id');
            $table->foreignId('renewed_from_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->string('contract_number', 30);
            $table->string('ejari_number', 50)->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('billing_cycle', 20)->default('monthly');
            $table->unsignedSmallInteger('payment_terms_days')->default(7);
            $table->decimal('security_deposit', 14, 2)->nullable();
            $table->string('status', 20)->default('draft');
            $table->date('signed_on')->nullable();
            $table->date('terminated_on')->nullable();
            $table->string('termination_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            // Targets for child tables' composite foreign keys.
            $table->unique(['id', 'company_id']);
            $table->unique(['id', 'client_id']);
            $table->index(['company_id', 'status']);
            $table->index('client_id');
        });

        DB::statement(
            'create unique index contracts_company_id_contract_number_unique
            on contracts (company_id, contract_number)
            where deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table contracts
                add constraint contracts_status_check check (status in ('draft', 'active', 'ended', 'terminated')),
                add constraint contracts_billing_cycle_check check (billing_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual')),
                add constraint contracts_dates_check check (end_date > start_date),
                add constraint contracts_deposit_check check (security_deposit >= 0),
                add constraint contracts_terminated_check check (status <> 'terminated' or terminated_on is not null)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
