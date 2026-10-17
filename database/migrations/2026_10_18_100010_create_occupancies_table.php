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
     * One stay: an occupant in a bed from check-in up to (not including) the
     * check-out date, under a contract line. An open stay has no check-out.
     *
     * On PostgreSQL two exclusion constraints make overlapping stays
     * impossible, whatever the application does: a bed holds one person at a
     * time, and a person holds one bed at a time. They use the btree_gist
     * extension enabled by the head leases migration.
     */
    public function up(): void
    {
        Schema::create('occupancies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('occupant_id');
            $table->unsignedBigInteger('contract_line_id');
            $table->foreignId('bed_id')->constrained('beds')->restrictOnDelete();
            $table->date('check_in_date');
            $table->date('check_out_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['occupant_id', 'company_id'])->references(['id', 'company_id'])->on('occupants')->restrictOnDelete();
            $table->foreign(['contract_line_id', 'company_id'])->references(['id', 'company_id'])->on('contract_lines')->restrictOnDelete();
            $table->index('occupant_id');
            $table->index('contract_line_id');
            $table->index(['company_id', 'check_out_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('create extension if not exists btree_gist');

            DB::statement(
                "alter table occupancies
                add constraint occupancies_dates_check check (check_out_date > check_in_date),
                add constraint occupancies_bed_no_overlap exclude using gist (
                    bed_id with =,
                    daterange(check_in_date, check_out_date, '[)') with &&
                ),
                add constraint occupancies_occupant_no_overlap exclude using gist (
                    occupant_id with =,
                    daterange(check_in_date, check_out_date, '[)') with &&
                )"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('occupancies');
    }
};
