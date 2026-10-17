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
     * An occupant is a person who stays in a bed. `client_id` is who pays for
     * them: their employer, or the occupant themselves when the client is an
     * individual. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('occupants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('client_id');
            $table->string('full_name');
            $table->string('gender', 10);
            $table->string('nationality')->nullable();
            $table->string('id_type', 20)->nullable();
            $table->string('id_number', 50)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('employee_number', 50)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            // Target for occupancies' (occupant_id, company_id) foreign key.
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'full_name']);
            $table->index('client_id');
        });

        // An identity document identifies one live occupant within a company.
        DB::statement(
            'create unique index occupants_company_id_id_type_id_number_unique
            on occupants (company_id, id_type, id_number)
            where id_number is not null and deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table occupants
                add constraint occupants_gender_check check (gender in ('male', 'female')),
                add constraint occupants_id_type_check check (id_type in ('emirates_id', 'passport')),
                add constraint occupants_id_pair_check check ((id_type is null) = (id_number is null))"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('occupants');
    }
};
