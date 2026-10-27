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
     * A room rental is now a short-term rental: a company taking one or more
     * whole rooms of a property for a few months without a contract, rather
     * than an individual in a bed. Its rooms move to room_rental_rooms, and
     * the bed, occupant and unit type go. Stays recorded under older rentals
     * keep their link through occupancies.room_rental_id.
     */
    public function up(): void
    {
        Schema::create('room_rental_rooms', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('room_rental_id');
            $table->foreignId('room_id')->constrained('rooms')->restrictOnDelete();

            $table->foreign(['room_rental_id', 'company_id'])->references(['id', 'company_id'])->on('room_rentals')->cascadeOnDelete();
            $table->unique(['room_rental_id', 'room_id']);
        });

        DB::table('room_rental_rooms')->insertUsing(
            ['company_id', 'room_rental_id', 'room_id'],
            DB::table('room_rentals')->select(['company_id', 'id', 'room_id']),
        );

        Schema::table('room_rentals', function (Blueprint $table) {
            $table->dropForeign(['room_id', 'property_id']);
            $table->dropForeign(['occupant_id', 'company_id']);
            $table->dropForeign(['bed_id']);
            $table->dropIndex(['room_id']);
            $table->dropColumn(['room_id', 'bed_id', 'occupant_id', 'unit_type']);
        });
    }

    /**
     * Reverse the migrations. Each rental gets back its first room, and the
     * bed and occupant of its first stay; rentals without a stay keep none.
     */
    public function down(): void
    {
        Schema::table('room_rentals', function (Blueprint $table) {
            $table->unsignedBigInteger('occupant_id')->nullable()->after('client_id');
            $table->unsignedBigInteger('room_id')->nullable()->after('property_id');
            $table->foreignId('bed_id')->nullable()->after('room_id')->constrained('beds')->restrictOnDelete();
            $table->string('unit_type', 10)->default('room')->after('bed_id');

            $table->foreign(['occupant_id', 'company_id'])->references(['id', 'company_id'])->on('occupants')->restrictOnDelete();
            $table->foreign(['room_id', 'property_id'])->references(['id', 'property_id'])->on('rooms')->restrictOnDelete();
            $table->index('room_id');
        });

        DB::table('room_rentals')->update([
            'room_id' => DB::raw('(select room_id from room_rental_rooms where room_rental_rooms.room_rental_id = room_rentals.id order by id limit 1)'),
            'bed_id' => DB::raw('(select bed_id from occupancies where occupancies.room_rental_id = room_rentals.id order by id limit 1)'),
            'occupant_id' => DB::raw('(select occupant_id from occupancies where occupancies.room_rental_id = room_rentals.id order by id limit 1)'),
        ]);

        Schema::dropIfExists('room_rental_rooms');
    }
};
