<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * How many floors the building has and how many units (rooms, shops and
     * apartments together) it can hold. The positive check is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->unsignedSmallInteger('total_floors')->nullable()->after('total_rooms');
            $table->unsignedInteger('total_units')->nullable()->after('total_floors');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table properties
                add constraint properties_size_check check (total_floors > 0 and total_units > 0)'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table properties drop constraint if exists properties_size_check');
        }

        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['total_floors', 'total_units']);
        });
    }
};
