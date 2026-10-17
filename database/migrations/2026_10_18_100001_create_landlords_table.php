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
     * A landlord leases properties to the operator company. The check
     * constraints are PostgreSQL-only; the SQLite test database cannot add
     * them to an existing table.
     */
    public function up(): void
    {
        Schema::create('landlords', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('landlord_type', 20)->default('company');
            $table->string('name');
            $table->string('contact_person_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('trade_license_number')->nullable();
            $table->string('id_number', 50)->nullable();
            $table->string('tax_registration_number')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('account_name')->nullable();
            $table->string('iban', 34)->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Target for child tables' (landlord_id, company_id) foreign keys.
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'name']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table landlords
                add constraint landlords_landlord_type_check check (landlord_type in ('company', 'individual')),
                add constraint landlords_iban_check check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('landlords');
    }
};
