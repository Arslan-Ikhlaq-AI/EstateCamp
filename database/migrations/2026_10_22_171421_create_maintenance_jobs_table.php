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
     * One problem to fix at a property: where it is (the whole property, or a
     * room, apartment or shop in it), what kind of problem, who reported it
     * and who fixes it, and once the work is done, what it cost and the
     * invoice. The invoice is kept on the private disk and served only to
     * the company's own users.
     *
     * Composite foreign keys tie the unit to the job's property and the
     * property to the job's company. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('maintenance_jobs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('job_number', 30);

            // Where the problem is.
            $table->unsignedBigInteger('property_id');
            $table->string('unit_type', 20)->default('property');
            $table->unsignedBigInteger('room_id')->nullable();
            $table->unsignedBigInteger('apartment_id')->nullable();
            $table->unsignedBigInteger('shop_id')->nullable();
            $table->string('location')->nullable();

            // What it is and where it stands.
            $table->foreignId('maintenance_category_id')->constrained('maintenance_categories')->restrictOnDelete();
            $table->foreignId('maintenance_status_id')->constrained('maintenance_statuses')->restrictOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('priority', 20)->default('normal');

            // Who and when.
            $table->date('reported_on');
            $table->string('reported_by')->nullable();
            $table->string('vendor_name')->nullable();
            $table->string('vendor_phone', 40)->nullable();
            $table->date('started_on')->nullable();
            $table->date('completed_on')->nullable();

            // What it cost, once done.
            $table->decimal('amount', 14, 2)->nullable();
            $table->string('payment_method', 20)->nullable();
            $table->date('paid_on')->nullable();
            $table->string('invoice_number', 100)->nullable();
            $table->string('invoice_path', 2048)->nullable();
            $table->string('invoice_name')->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['room_id', 'property_id'])->references(['id', 'property_id'])->on('rooms')->restrictOnDelete();
            $table->foreign(['apartment_id', 'property_id'])->references(['id', 'property_id'])->on('apartments')->restrictOnDelete();
            $table->foreign(['shop_id', 'property_id'])->references(['id', 'property_id'])->on('shops')->restrictOnDelete();
            $table->unique(['company_id', 'job_number']);
            $table->index(['company_id', 'maintenance_status_id']);
            $table->index(['company_id', 'completed_on']);
            $table->index('property_id');
            $table->index('room_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table maintenance_jobs
                add constraint maintenance_jobs_unit_type_check check (unit_type in ('property', 'room', 'apartment', 'shop')),
                add constraint maintenance_jobs_unit_check check (
                    (unit_type = 'property' and room_id is null and apartment_id is null and shop_id is null)
                    or (unit_type = 'room' and room_id is not null and apartment_id is null and shop_id is null)
                    or (unit_type = 'apartment' and apartment_id is not null and room_id is null and shop_id is null)
                    or (unit_type = 'shop' and shop_id is not null and room_id is null and apartment_id is null)
                ),
                add constraint maintenance_jobs_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
                add constraint maintenance_jobs_payment_method_check check (payment_method in ('cash', 'cheque', 'bank_transfer', 'card')),
                add constraint maintenance_jobs_amount_check check (amount >= 0),
                add constraint maintenance_jobs_dates_check check (completed_on >= reported_on)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_jobs');
    }
};
