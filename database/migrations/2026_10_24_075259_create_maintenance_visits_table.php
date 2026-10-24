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
     * The contractor's visit schedule under a maintenance contract, such as
     * the pest control company's monthly treatments: the date (and time, when
     * given) of each visit and where it stands. A visit done keeps when it
     * was done, who came, the service report number and a copy of the
     * report, kept on the private disk for inspections and audits. A
     * rescheduled visit remembers the date it was first planned for.
     *
     * The composite foreign key ties the contract to the visit's company.
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('maintenance_visits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('maintenance_contract_id');
            $table->date('scheduled_on');
            $table->time('scheduled_time')->nullable();
            $table->date('rescheduled_from')->nullable();
            $table->string('status', 20)->default('scheduled');

            // The visit as it was done.
            $table->date('completed_on')->nullable();
            $table->string('technician_name')->nullable();
            $table->string('report_number', 100)->nullable();
            $table->string('report_path', 2048)->nullable();
            $table->string('report_name')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['maintenance_contract_id', 'company_id'])->references(['id', 'company_id'])->on('maintenance_contracts')->cascadeOnDelete();
            $table->index(['company_id', 'status', 'scheduled_on']);
            $table->index(['maintenance_contract_id', 'scheduled_on']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table maintenance_visits
                add constraint maintenance_visits_status_check check (status in ('scheduled', 'confirmed', 'done', 'missed', 'cancelled')),
                add constraint maintenance_visits_done_check check (status <> 'done' or completed_on is not null)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_visits');
    }
};
