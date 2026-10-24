<?php

namespace App\Models;

use Database\Factories\UserRoleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'description', 'is_system', 'is_active'])]
class UserRole extends Model
{
    /** @use HasFactory<UserRoleFactory> */
    use HasFactory;

    /**
     * Slug of the built-in role with full access to its company account.
     */
    public const SUPER_ADMIN = 'super_admin';

    /**
     * Slug of the built-in role that runs the company's day-to-day operations.
     */
    public const MANAGER = 'manager';

    /**
     * Slug of the built-in role that looks after the company's money.
     */
    public const ACCOUNTANT = 'accountant';

    /**
     * The roles every company account can give its users, by slug, in the
     * order they are offered.
     *
     * @var array<string, array{name: string, description: string}>
     */
    public const BUILT_IN = [
        self::SUPER_ADMIN => [
            'name' => 'Super Admin',
            'description' => 'Full access to every module and setting in the company account.',
        ],
        self::MANAGER => [
            'name' => 'Manager',
            'description' => 'Runs day-to-day operations: properties, rooms, tenants, contracts and maintenance.',
        ],
        self::ACCOUNTANT => [
            'name' => 'Accountant',
            'description' => 'Looks after invoices, cheques, payments, payroll and reports.',
        ],
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /**
     * The built-in role with `$slug`, created on first use so a fresh
     * install does not depend on the seeders.
     */
    public static function builtIn(string $slug): self
    {
        return self::firstOrCreate(['slug' => $slug], [...self::BUILT_IN[$slug], 'is_system' => true, 'is_active' => true]);
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
