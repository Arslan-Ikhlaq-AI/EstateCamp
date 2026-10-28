<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How many medical rooms, kitchens, washrooms and supervisor rooms the
     * property has. These are counts only; no units are created for them.
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->unsignedSmallInteger('medical_rooms')->nullable()->after('total_units');
            $table->unsignedSmallInteger('kitchens')->nullable()->after('medical_rooms');
            $table->unsignedSmallInteger('washrooms')->nullable()->after('kitchens');
            $table->unsignedSmallInteger('supervisor_rooms')->nullable()->after('washrooms');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['medical_rooms', 'kitchens', 'washrooms', 'supervisor_rooms']);
        });
    }
};
