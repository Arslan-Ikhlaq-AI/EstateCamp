<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The history of a maintenance job: one row each time it is reported or
     * moves to another status, with the day it happened, a note and who
     * recorded it.
     */
    public function up(): void
    {
        Schema::create('maintenance_job_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('maintenance_job_id')->constrained('maintenance_jobs')->cascadeOnDelete();
            $table->foreignId('maintenance_status_id')->constrained('maintenance_statuses')->restrictOnDelete();
            $table->foreignId('previous_status_id')->nullable()->constrained('maintenance_statuses')->restrictOnDelete();
            $table->date('changed_on');
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['maintenance_job_id', 'changed_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_job_updates');
    }
};
