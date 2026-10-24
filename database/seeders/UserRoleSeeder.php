<?php

namespace Database\Seeders;

use App\Models\UserRole;
use Illuminate\Database\Seeder;

class UserRoleSeeder extends Seeder
{
    /**
     * Seed the built-in user roles. Safe to re-run: roles are matched on their slug.
     */
    public function run(): void
    {
        foreach (UserRole::BUILT_IN as $slug => $role) {
            UserRole::updateOrCreate(['slug' => $slug], [...$role, 'is_system' => true, 'is_active' => true]);
        }
    }
}
