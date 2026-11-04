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
     * Leave a staff member asked for (`is_request`), or that the company gave
     * them: its kind, the first and last day, and the reason. A request waits
     * until someone approves it as paid or unpaid, or rejects it; leave the
     * company gives is approved as it is added. Either can be cancelled.
     * Approved leave marks its days in attendance, which the payroll reads.
     * The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('staff_leaves', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('staff_member_id');
            $table->string('type', 20);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->unsignedSmallInteger('days');
            $table->text('reason')->nullable();
            $table->boolean('is_request')->default(true);
            $table->string('status', 20)->default('pending');
            $table->boolean('is_paid')->nullable();
            $table->string('decision_note', 500)->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->foreign(['staff_member_id', 'company_id'])->references(['id', 'company_id'])->on('staff_members')->cascadeOnDelete();
            $table->index(['company_id', 'status']);
            $table->index(['staff_member_id', 'starts_on']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table staff_leaves add constraint staff_leaves_type_check check (type in ('annual', 'sick', 'emergency', 'other'))");
            DB::statement("alter table staff_leaves add constraint staff_leaves_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled'))");
            DB::statement('alter table staff_leaves add constraint staff_leaves_dates_check check (ends_on >= starts_on)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_leaves');
    }
};
