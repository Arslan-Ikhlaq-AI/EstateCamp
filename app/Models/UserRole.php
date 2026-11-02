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
     * Slug of the built-in role that runs the company from its office.
     */
    public const OFFICE_ADMIN = 'office_admin';

    /**
     * Slug of the built-in role that looks after a few of the company's camps.
     */
    public const AREA_MANAGER = 'area_manager';

    /**
     * Slug of the built-in role that runs one camp.
     */
    public const CAMP_BOSS = 'camp_boss';

    /**
     * Roles that see only the properties given to the user (see
     * User::campPropertyIds()), with the most each may have.
     *
     * @var array<string, int|null>
     */
    public const CAMP_ROLES = [
        self::AREA_MANAGER => null,
        self::CAMP_BOSS => 1,
    ];

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
        self::OFFICE_ADMIN => [
            'name' => 'Office Admin',
            'description' => 'Runs the company from the office, with access to every camp and page.',
        ],
        self::AREA_MANAGER => [
            'name' => 'Area Manager',
            'description' => 'Looks after the camps given to them: their rooms, tenants, money and maintenance.',
        ],
        self::CAMP_BOSS => [
            'name' => 'Camp Boss',
            'description' => 'Runs one camp: its rooms, check-ins, rent collection, cash and maintenance.',
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
