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
     * One person the company employs: who they are, their role and where
     * they work (the head office, a regional office, or a camp or building),
     * their identity documents with the dates they expire, and their monthly
     * salary (basic pay plus allowances) with how it is paid.
     *
     * Composite foreign keys tie the regional office and property to the
     * staff member's company. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('staff_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('employee_number', 30);

            // Who they are.
            $table->string('full_name');
            $table->string('gender', 10);
            $table->string('nationality')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();

            // Their job and where they do it.
            $table->foreignId('staff_role_id')->constrained('staff_roles')->restrictOnDelete();
            $table->string('work_level', 20);
            $table->unsignedBigInteger('regional_office_id')->nullable();
            $table->unsignedBigInteger('property_id')->nullable();
            $table->string('employment_type', 20)->default('full_time');
            $table->date('joined_on');
            $table->string('status', 20)->default('active');
            $table->date('left_on')->nullable();

            // Identity documents.
            $table->string('emirates_id_number', 30)->nullable();
            $table->date('emirates_id_expiry')->nullable();
            $table->string('passport_number', 30)->nullable();
            $table->date('passport_expiry')->nullable();
            $table->string('visa_number', 30)->nullable();
            $table->date('visa_expiry')->nullable();

            // Monthly salary and how it is paid.
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->decimal('housing_allowance', 12, 2)->default(0);
            $table->decimal('transport_allowance', 12, 2)->default(0);
            $table->decimal('other_allowance', 12, 2)->default(0);
            $table->string('salary_payment_method', 20)->nullable();
            $table->string('bank_name')->nullable();
            $table->string('iban', 34)->nullable();

            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 40)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['regional_office_id', 'company_id'])->references(['id', 'company_id'])->on('regional_offices')->restrictOnDelete();
            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->unique(['company_id', 'employee_number']);
            // Target for attendance and salary rows' (staff_member_id, company_id) foreign keys.
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'full_name']);
            $table->index('staff_role_id');
            $table->index('regional_office_id');
            $table->index('property_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table staff_members
                add constraint staff_members_gender_check check (gender in ('male', 'female')),
                add constraint staff_members_work_level_check check (
                    (work_level = 'head_office' and regional_office_id is null and property_id is null)
                    or (work_level = 'regional' and regional_office_id is not null and property_id is null)
                    or (work_level = 'site' and property_id is not null and regional_office_id is null)
                ),
                add constraint staff_members_employment_type_check check (employment_type in ('full_time', 'part_time', 'temporary')),
                add constraint staff_members_status_check check (status in ('active', 'on_leave', 'resigned', 'terminated')),
                add constraint staff_members_left_on_check check ((status in ('resigned', 'terminated')) = (left_on is not null)),
                add constraint staff_members_dates_check check (left_on >= joined_on),
                add constraint staff_members_salary_check check (basic_salary >= 0 and housing_allowance >= 0 and transport_allowance >= 0 and other_allowance >= 0),
                add constraint staff_members_payment_method_check check (salary_payment_method in ('bank_transfer', 'cash', 'cheque'))"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_members');
    }
};
