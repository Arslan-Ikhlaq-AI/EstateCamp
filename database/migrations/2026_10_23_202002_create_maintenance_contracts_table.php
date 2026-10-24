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
     * Annual maintenance contracts (AMCs): a service company looking after
     * one kind of system at a property for a term, such as its fire safety,
     * lifts, garbage collection or water tank cleaning.
     * Each holds the contractor, the term and value, how often they visit,
     * what they cover, the authority certificate it keeps valid (such as the
     * Civil Defence certificate) and a copy of the signed contract, kept on
     * the private disk and served only to the company's own users.
     *
     * A composite foreign key ties the property to the contract's company.
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('maintenance_contracts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('contract_number', 30);
            $table->string('service', 30);
            $table->unsignedBigInteger('property_id');
            $table->foreignId('renewed_from_id')->nullable()->constrained('maintenance_contracts')->nullOnDelete();

            // The contractor.
            $table->string('vendor_name');
            $table->string('vendor_contact_person')->nullable();
            $table->string('vendor_phone', 40)->nullable();
            $table->string('vendor_email')->nullable();
            $table->string('vendor_licence_number', 100)->nullable();
            $table->string('reference_number', 100)->nullable();

            // The term and what it costs.
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('contract_value', 14, 2);
            $table->string('payment_terms', 20);
            $table->string('status', 20)->default('active');

            // The service.
            $table->string('visit_frequency', 20);
            $table->date('last_visit_on')->nullable();
            $table->unsignedSmallInteger('response_time_hours')->nullable();
            $table->json('coverage');

            // The certificate the contract keeps valid, and the signed copy.
            $table->string('certificate_number', 100)->nullable();
            $table->date('certificate_expires_on')->nullable();
            $table->string('document_path', 2048)->nullable();
            $table->string('document_name')->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->unique(['company_id', 'contract_number']);
            $table->index(['company_id', 'service', 'end_date']);
            $table->index('property_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table maintenance_contracts
                add constraint maintenance_contracts_status_check check (status in ('active', 'cancelled')),
                add constraint maintenance_contracts_payment_terms_check check (payment_terms in ('upfront', 'half_yearly', 'quarterly', 'monthly', 'per_visit')),
                add constraint maintenance_contracts_service_check check (service in ('fire_safety', 'lifts', 'garbage', 'grease_traps', 'drainage', 'pest_control', 'air_conditioning', 'water_tanks')),
                add constraint maintenance_contracts_visit_frequency_check check (visit_frequency in ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
                add constraint maintenance_contracts_value_check check (contract_value >= 0),
                add constraint maintenance_contracts_dates_check check (end_date > start_date)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_contracts');
    }
};
