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
     * The steps a maintenance job moves through, named by the company (such
     * as Submitted → On maintenance → Maintenance done → Payment done). Each
     * status belongs to a stage the application understands: a job reaching
     * a `completed` status must have its invoice and the amount charged.
     *
     * The starter rows are inserted here so maintenance_jobs.maintenance_status_id,
     * which is required, can be filled in every environment. Add or rename
     * statuses through the application. The check constraints are
     * PostgreSQL-only; the SQLite test database cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('maintenance_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('stage', 20)->default('open');
            $table->string('color', 20)->default('cyan');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table maintenance_statuses
                add constraint maintenance_statuses_stage_check check (stage in ('open', 'in_progress', 'completed', 'cancelled')),
                add constraint maintenance_statuses_color_check check (color in ('cyan', 'navy', 'amber', 'green', 'red', 'grey'))"
            );
        }

        $now = now();

        DB::table('maintenance_statuses')->insert([
            ['name' => 'Submitted', 'slug' => 'submitted', 'stage' => 'open', 'color' => 'cyan', 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'On maintenance', 'slug' => 'on_maintenance', 'stage' => 'in_progress', 'color' => 'amber', 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Maintenance done', 'slug' => 'maintenance_done', 'stage' => 'completed', 'color' => 'green', 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Payment done', 'slug' => 'payment_done', 'stage' => 'completed', 'color' => 'navy', 'sort_order' => 4, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Cancelled', 'slug' => 'cancelled', 'stage' => 'cancelled', 'color' => 'grey', 'sort_order' => 5, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_statuses');
    }
};
