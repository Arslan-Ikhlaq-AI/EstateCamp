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
     * The jobs a staff member can hold, such as Regional Manager or Cleaner.
     * Each role sits at the level of the company it usually works at: the
     * head office, a regional office, or a camp or building. The level only
     * suggests where someone in the role works; each staff member's own
     * placement is kept on their record.
     *
     * The starter rows are inserted here so staff_members.staff_role_id, which
     * is required, can be filled in every environment. Add or rename roles
     * through the application. The check constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('staff_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('level', 20)->default('site');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table staff_roles add constraint staff_roles_level_check check (level in ('head_office', 'regional', 'site'))");
        }

        $now = now();
        $roles = [
            ['Chief Executive Officer / Managing Director', 'ceo_managing_director', 'head_office', 'Leads the company and answers for its results'],
            ['Director of Operations', 'director_of_operations', 'head_office', 'Runs every camp and building across the regions'],
            ['Chief Financial Officer', 'chief_financial_officer', 'head_office', 'Money, budgets, banking and reporting'],
            ['Head of HR & Admin', 'head_of_hr_admin', 'head_office', 'People, visas, payroll and office administration'],
            ['Lease & Contract Administrator', 'lease_contract_administrator', 'head_office', 'Head leases, client contracts and renewals'],
            ['Sales Manager', 'sales_manager', 'head_office', 'Leads the sales team and the client pipeline'],
            ['Sales Executive', 'sales_executive', 'head_office', 'Finds clients and fills beds, rooms and units'],
            ['Administrator', 'administrator', 'head_office', null],
            ['Accountant', 'accountant', 'head_office', 'Invoices, cheques, payments and the books'],
            ['Purchase Officer', 'purchase_officer', 'head_office', 'Buys supplies and services for every site'],
            ['Legal & Compliance Counsel', 'legal_compliance_counsel', 'head_office', 'Contracts, permits and regulatory compliance'],
            ['Regional Manager', 'regional_manager', 'regional', 'Runs the camps and buildings in a region'],
            ['Regional Administrator', 'regional_administrator', 'regional', null],
            ['Regional Accountant', 'regional_accountant', 'regional', 'Collections and spending for a region'],
            ['Property Boss', 'property_boss', 'site', 'Camp boss: runs one camp or building day to day'],
            ['Assistant Camp Boss', 'assistant_camp_boss', 'site', null],
            ['Site Accountant', 'site_accountant', 'site', 'Rent collection and petty cash at the camp or building'],
            ['Maintenance Person', 'maintenance_person', 'site', 'Plumbing, electrical and general repairs'],
            ['Cleaning Manager', 'cleaning_manager', 'site', 'Leads the cleaners and checks the standard'],
            ['Cleaner', 'cleaner', 'site', null],
            ['Security Guard', 'security_guard', 'site', 'Gate, patrols and visitor log'],
        ];

        DB::table('staff_roles')->insert(array_map(fn (array $role, int $index) => [
            'name' => $role[0],
            'slug' => $role[1],
            'level' => $role[2],
            'description' => $role[3],
            'sort_order' => $index + 1,
            'created_at' => $now,
            'updated_at' => $now,
        ], $roles, array_keys($roles)));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('staff_roles');
    }
};
