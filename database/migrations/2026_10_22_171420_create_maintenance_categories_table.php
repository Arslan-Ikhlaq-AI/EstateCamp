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
     * The kinds of problem a maintenance job can be about: a leaking tap, a
     * burnt motor, a broken bed. The starter rows are inserted here so
     * maintenance_jobs.maintenance_category_id, which is required, can be
     * filled in every environment. Add or rename categories through the application.
     */
    public function up(): void
    {
        Schema::create('maintenance_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();
        $categories = [
            ['Plumbing', 'plumbing', 'Taps, pipes, leaks, toilets and drains'],
            ['Electrical', 'electrical', 'Wiring, sockets, lights and the distribution board'],
            ['Water pump & motor', 'water_pump_motor', 'Water motors, pumps and pressure systems'],
            ['Air conditioning', 'air_conditioning', 'AC units, gas refills and thermostats'],
            ['Furniture & beds', 'furniture_beds', 'Beds, mattresses, lockers and wardrobes'],
            ['Doors, windows & locks', 'doors_windows_locks', 'Hinges, handles, glass and keys'],
            ['Painting & civil works', 'painting_civil', 'Walls, ceilings, tiles and waterproofing'],
            ['Appliances', 'appliances', 'Water heaters, fridges, washing machines and cookers'],
            ['Other', 'other', null],
        ];

        DB::table('maintenance_categories')->insert(array_map(fn (array $category, int $index) => [
            'name' => $category[0],
            'slug' => $category[1],
            'description' => $category[2],
            'sort_order' => $index + 1,
            'created_at' => $now,
            'updated_at' => $now,
        ], $categories, array_keys($categories)));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_categories');
    }
};
