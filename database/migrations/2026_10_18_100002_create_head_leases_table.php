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
     * A head lease is the operator renting a property from a landlord. The
     * composite foreign keys make the property and landlord belong to the same
     * company as the lease. On PostgreSQL an exclusion constraint also stops two
     * live leases on one property from overlapping in time; it needs the
     * btree_gist extension, which a database owner can enable.
     */
    public function up(): void
    {
        Schema::create('head_leases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('landlord_id');
            $table->foreignId('renewed_from_id')->nullable()->constrained('head_leases')->nullOnDelete();
            $table->string('lease_number', 30);
            $table->string('ejari_number', 50)->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('annual_rent', 14, 2);
            $table->unsignedSmallInteger('payments_per_year')->default(4);
            $table->decimal('security_deposit', 14, 2)->nullable();
            $table->unsignedSmallInteger('notice_period_days')->nullable();
            $table->string('status', 20)->default('draft');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['landlord_id', 'company_id'])->references(['id', 'company_id'])->on('landlords')->restrictOnDelete();
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'status']);
            $table->index('property_id');
            $table->index('landlord_id');
        });

        DB::statement(
            'create unique index head_leases_company_id_lease_number_unique
            on head_leases (company_id, lease_number)
            where deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('create extension if not exists btree_gist');

            DB::statement(
                "alter table head_leases
                add constraint head_leases_status_check check (status in ('draft', 'active', 'expired', 'terminated')),
                add constraint head_leases_dates_check check (end_date > start_date),
                add constraint head_leases_amounts_check check (annual_rent >= 0 and security_deposit >= 0),
                add constraint head_leases_payments_per_year_check check (payments_per_year in (1, 2, 3, 4, 6, 12)),
                add constraint head_leases_notice_check check (notice_period_days >= 0),
                add constraint head_leases_no_overlap exclude using gist (
                    property_id with =,
                    daterange(start_date, end_date, '[]') with &&
                ) where (status <> 'terminated' and deleted_at is null)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('head_leases');
    }
};
