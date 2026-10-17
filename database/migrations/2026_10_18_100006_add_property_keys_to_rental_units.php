<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Contract lines point at a room, apartment or shop together with its
     * property, so a line can never name a unit from a different property.
     * Those composite foreign keys need a unique (id, property_id) target.
     */
    public function up(): void
    {
        foreach (['rooms', 'apartments', 'shops'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->unique(['id', 'property_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (['rooms', 'apartments', 'shops'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropUnique(['id', 'property_id']);
            });
        }
    }
};
