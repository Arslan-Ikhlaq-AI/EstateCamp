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
     * What someone in a role can do once they are given a sign-in, as the
     * starting point for their own access: `staff_access` on the staff pages
     * (`self`: their own attendance and pay; `supervisor`: also every staff
     * member, their attendance and salaries; `admin`: also adding staff and
     * paying salaries), and `app_access` for the rest of the app
     * (properties, tenants, payments and maintenance).
     *
     * The starter roles get sensible defaults here. The check constraint is
     * PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::table('staff_roles', function (Blueprint $table) {
            $table->string('staff_access', 20)->default('self')->after('level');
            $table->boolean('app_access')->default(false)->after('staff_access');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table staff_roles add constraint staff_roles_staff_access_check check (staff_access in ('self', 'supervisor', 'admin'))");
        }

        $defaults = [
            'admin' => ['ceo_managing_director', 'chief_financial_officer', 'head_of_hr_admin', 'accountant'],
            'supervisor' => ['director_of_operations', 'administrator', 'regional_manager', 'regional_administrator', 'property_boss', 'assistant_camp_boss', 'cleaning_manager'],
        ];

        foreach ($defaults as $access => $slugs) {
            DB::table('staff_roles')->whereIn('slug', $slugs)->update(['staff_access' => $access]);
        }

        // Office roles and the camp's boss and accountant work in the rest of the app too.
        DB::table('staff_roles')
            ->where(fn ($query) => $query->whereIn('level', ['head_office', 'regional'])->orWhereIn('slug', ['property_boss', 'site_accountant']))
            ->update(['app_access' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table staff_roles drop constraint if exists staff_roles_staff_access_check');
        }

        Schema::table('staff_roles', function (Blueprint $table) {
            $table->dropColumn(['staff_access', 'app_access']);
        });
    }
};
