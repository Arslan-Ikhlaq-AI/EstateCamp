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
     * One staff member's attendance on one day: present, half a day, absent,
     * on leave or their day off, with the times they came and went. Absent
     * days and half days are taken off their salary in the payroll. The check
     * constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('staff_attendances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('staff_member_id');
            $table->date('work_date');
            $table->string('status', 20);
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['staff_member_id', 'company_id'])->references(['id', 'company_id'])->on('staff_members')->cascadeOnDelete();
            $table->unique(['staff_member_id', 'work_date']);
            $table->index(['company_id', 'work_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table staff_attendances add constraint staff_attendances_status_check check (status in ('present', 'half_day', 'absent', 'leave', 'day_off'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_attendances');
    }
};
