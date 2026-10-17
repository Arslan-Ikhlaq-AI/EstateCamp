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
     * The starter rows are inserted here so properties.property_type_id, which is required,
     * can be filled in every environment. Add or rename types through the application.
     */
    public function up(): void
    {
        Schema::create('property_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();

        DB::table('property_types')->insert([
            ['name' => 'Worker Accommodation', 'slug' => 'worker_accommodation', 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Staff Accommodation', 'slug' => 'staff_accommodation', 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Residential Building', 'slug' => 'residential_building', 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_types');
    }
};
