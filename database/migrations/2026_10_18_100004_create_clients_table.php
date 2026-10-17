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
     * A client is whoever pays the operator: a company housing its workers,
     * or an individual. Client companies are deliberately not rows in
     * `companies`, which holds operators and controls logins. The check
     * constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('client_type', 20)->default('company');
            $table->string('name');
            $table->string('contact_person_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('trade_license_number')->nullable();
            $table->string('tax_registration_number')->nullable();
            $table->string('id_type', 20)->nullable();
            $table->string('id_number', 50)->nullable();
            $table->string('nationality')->nullable();
            $table->text('address')->nullable();
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Targets for child tables' composite foreign keys.
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'client_type']);
            $table->index(['company_id', 'name']);
        });

        // An identity document identifies one live client within a company.
        DB::statement(
            'create unique index clients_company_id_id_type_id_number_unique
            on clients (company_id, id_type, id_number)
            where id_number is not null and deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table clients
                add constraint clients_client_type_check check (client_type in ('company', 'individual')),
                add constraint clients_status_check check (status in ('active', 'inactive')),
                add constraint clients_id_type_check check (id_type in ('emirates_id', 'passport')),
                add constraint clients_id_pair_check check ((id_type is null) = (id_number is null))"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
