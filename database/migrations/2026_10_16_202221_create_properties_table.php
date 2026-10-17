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
     * The check constraints are PostgreSQL-only; the SQLite database used by the
     * test suite cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->restrictOnDelete();

            // Identity
            $table->string('name');
            $table->string('code');
            $table->foreignId('property_type_id')->index()->constrained('property_types')->restrictOnDelete();
            $table->string('cover_image_url', 2048)->nullable();

            // Address
            $table->string('country_code', 2)->default('AE');
            $table->string('city')->nullable();
            $table->string('area')->nullable();
            $table->string('street')->nullable();
            $table->string('building_name')->nullable();
            $table->string('plot_number', 50)->nullable();
            $table->string('makani_number', 10)->nullable();
            $table->string('po_box', 20)->nullable();
            $table->text('address')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('map_url', 2048)->nullable();

            // Capacity and facilities
            $table->unsignedInteger('total_capacity')->nullable();
            $table->unsignedInteger('total_rooms')->nullable();

            // On-site contact
            $table->string('contact_person_name')->nullable();
            $table->string('contact_person_phone', 40)->nullable();

            // Ownership and lease
            $table->string('ownership_type', 20)->nullable();
            $table->string('landlord_name')->nullable();
            $table->string('landlord_phone', 40)->nullable();
            $table->date('lease_start_date')->nullable();
            $table->date('lease_end_date')->nullable();

            // Lifecycle
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['company_id', 'status']);

            // Target for child tables' (property_id, company_id) foreign keys, so a child row cannot
            // point at a property that belongs to a different company.
            $table->unique(['id', 'company_id']);
        });

        // Partial unique index: a soft-deleted property must not block reusing its code within the company.
        DB::statement(
            'create unique index properties_company_id_code_unique
            on properties (company_id, code)
            where deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table properties
                add constraint properties_status_check check (status in ('active', 'inactive', 'under_maintenance')),
                add constraint properties_ownership_type_check check (ownership_type in ('owned', 'leased')),
                add constraint properties_country_code_check check (country_code ~ '^[A-Z]{2}$'),
                add constraint properties_makani_number_check check (makani_number ~ '^[0-9]{10}$'),
                add constraint properties_counts_check check (total_capacity >= 0 and total_rooms >= 0),
                add constraint properties_coordinates_check check (
                    (latitude is null) = (longitude is null)
                    and latitude between -90 and 90
                    and longitude between -180 and 180
                ),
                add constraint properties_lease_dates_check check (lease_end_date >= lease_start_date)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
