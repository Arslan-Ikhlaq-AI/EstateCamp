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
        UserRole::updateOrCreate(
            ['slug' => UserRole::SUPER_ADMIN],
            [
                'name' => 'Super Admin',
                'description' => 'Full access to every module and setting in the company account.',
                'is_system' => true,
                'is_active' => true,
            ],
        );
    }
}
