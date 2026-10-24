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
     * A stay is now under either a contract line or a room rental, so an
     * individual renting without a contract takes a bed the same way, and
     * the bed and room counts include them. On PostgreSQL a check makes sure
     * each stay has exactly one of the two.
     */
    public function up(): void
    {
        Schema::table('occupancies', function (Blueprint $table) {
            $table->unsignedBigInteger('contract_line_id')->nullable()->change();
            $table->unsignedBigInteger('room_rental_id')->nullable()->after('contract_line_id');

            $table->foreign(['room_rental_id', 'company_id'])->references(['id', 'company_id'])->on('room_rentals')->restrictOnDelete();
            $table->index('room_rental_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table occupancies add constraint occupancies_agreement_check check ((contract_line_id is null) <> (room_rental_id is null))');
        }
    }

    /**
     * Reverse the migrations. Stays under room rentals are removed, since a
     * stay must have a contract line again.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table occupancies drop constraint if exists occupancies_agreement_check');
        }

        DB::table('occupancies')->whereNotNull('room_rental_id')->delete();

        Schema::table('occupancies', function (Blueprint $table) {
            $table->dropForeign(['room_rental_id', 'company_id']);
            $table->dropIndex(['room_rental_id']);
            $table->dropColumn('room_rental_id');
            $table->unsignedBigInteger('contract_line_id')->nullable(false)->change();
        });
    }
};
