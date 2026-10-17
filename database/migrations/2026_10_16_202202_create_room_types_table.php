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
     * The starter rows are inserted here so rooms.room_type_id, which is required,
     * can be filled in every environment. Add or rename types through the application.
     */
    public function up(): void
    {
        Schema::create('room_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();

        DB::table('room_types')->insert([
            ['name' => 'Shared Room', 'slug' => 'shared_room', 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Private Room', 'slug' => 'private_room', 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Dormitory', 'slug' => 'dormitory', 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_types');
    }
};
