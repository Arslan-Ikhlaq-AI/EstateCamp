<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\UserRole;
use Illuminate\Database\Seeder;

/**
 * The demo company's super admin accounts.
 *
 * Safe to re-run: users are matched on their email. Only newly created
 * accounts receive the demo password, so a changed password is never reset.
 * Requires UserRoleSeeder and CompanySeeder.
 */
class UserSeeder extends Seeder
{
    /**
     * Password given to newly created demo accounts.
     */
    public const DEMO_PASSWORD = 'password';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        $superAdminRole = UserRole::query()
            ->where('slug', UserRole::SUPER_ADMIN)
            ->firstOrFail();

        $admins = [
            ['name' => 'Omar Rahman', 'email' => 'omar.rahman@horizonfm.test'],
            ['name' => 'Sara Ahmed', 'email' => 'sara.ahmed@horizonfm.test'],
        ];

        foreach ($admins as $admin) {
            $user = User::firstOrNew(['email' => $admin['email']]);

            $user->forceFill([
                'name' => $admin['name'],
                'company_id' => $company->id,
                'user_role_id' => $superAdminRole->id,
                // The admin dashboard is still gated on this flag.
                'is_admin' => true,
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);

            if (! $user->exists) {
                $user->password = self::DEMO_PASSWORD;
            }

            $user->save();
        }
    }
}
