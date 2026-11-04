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
     * A day of attendance can be unpaid leave, taken off the salary like an
     * absence, and remembers the approved leave that marked it so cancelling
     * the leave clears it again. The check constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->foreignId('staff_leave_id')->nullable()->after('staff_member_id')->constrained('staff_leaves')->nullOnDelete();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table staff_attendances drop constraint if exists staff_attendances_status_check');
            DB::statement("alter table staff_attendances add constraint staff_attendances_status_check check (status in ('present', 'half_day', 'absent', 'leave', 'unpaid_leave', 'day_off'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("update staff_attendances set status = 'absent' where status = 'unpaid_leave'");
            DB::statement('alter table staff_attendances drop constraint if exists staff_attendances_status_check');
            DB::statement("alter table staff_attendances add constraint staff_attendances_status_check check (status in ('present', 'half_day', 'absent', 'leave', 'day_off'))");
        }

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_leave_id');
        });
    }
};
