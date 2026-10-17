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
     * company_id is stored on the room for fast tenant-scoped queries. The composite foreign
     * key to properties (id, company_id) guarantees it always matches the property's company.
     * The check constraints are PostgreSQL-only; the SQLite database used by the test suite
     * cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('property_id');

            // Location inside the property
            $table->string('room_number', 30);
            $table->string('block', 50)->nullable();
            $table->smallInteger('floor_number')->nullable();

            // Type and allocation rules
            $table->foreignId('room_type_id')->index()->constrained('room_types')->restrictOnDelete();
            $table->string('gender_policy', 20)->nullable();

            // Capacity and occupancy
            $table->unsignedSmallInteger('capacity');
            $table->unsignedSmallInteger('occupied_count')->default(0);

            // Details and pricing
            $table->decimal('area_sqm', 8, 2)->nullable();
            $table->decimal('rent_per_bed', 12, 2)->nullable();
            $table->jsonb('amenities')->nullable();

            // Lifecycle
            $table->string('status', 20)->default('active');
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

        // Partial unique index: a soft-deleted room must not block reusing its number within the property.
        DB::statement(
            'create unique index rooms_property_id_room_number_unique
            on rooms (property_id, room_number)
            where deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table rooms
                add constraint rooms_status_check check (status in ('active', 'inactive', 'under_maintenance')),
                add constraint rooms_gender_policy_check check (gender_policy in ('male', 'female', 'mixed')),
                add constraint rooms_occupancy_check check (capacity > 0 and occupied_count between 0 and capacity),
                add constraint rooms_area_sqm_check check (area_sqm > 0),
                add constraint rooms_rent_per_bed_check check (rent_per_bed >= 0),
                add constraint rooms_amenities_check check (jsonb_typeof(amenities) = 'array')"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
