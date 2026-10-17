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
     * company_id is stored on the apartment for fast tenant-scoped queries. The composite foreign
     * key to properties (id, company_id) guarantees it always matches the property's company.
     * The check constraints are PostgreSQL-only; the SQLite database used by the test suite
     * cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('apartments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('property_id');

            // Location inside the property
            $table->string('apartment_number', 30);
            $table->string('block', 50)->nullable();
            $table->smallInteger('floor_number')->nullable();

            // Layout
            $table->unsignedSmallInteger('bedrooms')->default(0);
            $table->unsignedSmallInteger('bathrooms')->default(1);
            $table->decimal('area_sqm', 8, 2)->nullable();
            $table->string('furnishing_status', 20)->nullable();
            $table->unsignedSmallInteger('max_occupants')->nullable();
            $table->jsonb('amenities')->nullable();

            // Pricing and utilities
            $table->decimal('monthly_rent', 12, 2)->nullable();
            $table->decimal('security_deposit', 12, 2)->nullable();
            $table->string('utility_account_number', 50)->nullable();

            // Lifecycle
            $table->string('status', 20)->default('vacant');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['property_id', 'company_id'])
                ->references(['id', 'company_id'])
                ->on('properties')
                ->restrictOnDelete();
            $table->index(['property_id', 'status']);
            $table->index(['company_id', 'status']);
        });

        // Partial unique index: a soft-deleted apartment must not block reusing its number within the property.
        DB::statement(
            'create unique index apartments_property_id_apartment_number_unique
            on apartments (property_id, apartment_number)
            where deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table apartments
                add constraint apartments_status_check check (status in ('vacant', 'occupied', 'reserved', 'under_maintenance', 'inactive')),
                add constraint apartments_furnishing_status_check check (furnishing_status in ('furnished', 'semi_furnished', 'unfurnished')),
                add constraint apartments_layout_check check (bedrooms >= 0 and bathrooms >= 0),
                add constraint apartments_max_occupants_check check (max_occupants > 0),
                add constraint apartments_area_sqm_check check (area_sqm > 0),
                add constraint apartments_pricing_check check (monthly_rent >= 0 and security_deposit >= 0),
                add constraint apartments_amenities_check check (jsonb_typeof(amenities) = 'array')"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('apartments');
    }
};
