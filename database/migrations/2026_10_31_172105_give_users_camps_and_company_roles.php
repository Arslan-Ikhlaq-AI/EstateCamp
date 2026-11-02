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
     * Companies now give their users one of four roles: super admin, office
     * admin, area manager and camp boss. Area managers and camp bosses see
     * only the properties given to them, kept in `property_user`. The
     * manager and accountant roles are gone: their users become office
     * admins, who may do everything, so no one loses access.
     */
    public function up(): void
    {
        Schema::create('property_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('property_id')->constrained('properties')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'property_id']);
        });

        $now = now();
        $officeAdmin = [
            'slug' => 'office_admin',
            'name' => 'Office Admin',
            'description' => 'Runs the company from the office, with access to every camp and page.',
            'updated_at' => $now,
        ];

        $officeAdminId = DB::table('user_roles')->where('slug', 'office_admin')->value('id');
        $managerId = DB::table('user_roles')->where('slug', 'manager')->value('id');

        if ($officeAdminId === null && $managerId !== null) {
            DB::table('user_roles')->where('id', $managerId)->update($officeAdmin);
            $officeAdminId = $managerId;
        }

        $oldRoleIds = DB::table('user_roles')->whereIn('slug', ['manager', 'accountant'])->pluck('id');

        if ($oldRoleIds->isNotEmpty()) {
            $officeAdminId ??= DB::table('user_roles')->insertGetId([...$officeAdmin, 'is_system' => true, 'is_active' => true, 'created_at' => $now]);

            DB::table('users')->whereIn('user_role_id', $oldRoleIds)->update(['user_role_id' => $officeAdminId]);
            DB::table('user_roles')->whereIn('id', $oldRoleIds)->delete();
        }
    }

    /**
     * Reverse the migrations. Office admins go back to being managers;
     * camp roles stay, as nothing earlier understood them.
     */
    public function down(): void
    {
        DB::table('user_roles')->where('slug', 'office_admin')->update([
            'slug' => 'manager',
            'name' => 'Manager',
            'description' => 'Runs day-to-day operations: properties, rooms, tenants, contracts and maintenance.',
            'updated_at' => now(),
        ]);

        Schema::dropIfExists('property_user');
    }
};
