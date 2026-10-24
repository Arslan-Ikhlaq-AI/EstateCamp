<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A job a staff member can hold, such as Regional Manager or Cleaner, at
 * the level of the company it usually works at: the head office, a
 * regional office, or a camp or building. It also holds what someone in
 * the job can do once given a sign-in (see StaffMember::ACCESS_LEVELS),
 * which each person's own access starts from.
 *
 * Reference data; the starter rows are inserted by the create_staff_roles_table migration.
 */
#[Fillable(['name', 'slug', 'description', 'level', 'staff_access', 'app_access', 'sort_order', 'is_active'])]
class StaffRole extends Model
{
    public const LEVELS = ['head_office', 'regional', 'site'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'app_access' => 'boolean',
        ];
    }

    /**
     * @return HasMany<StaffMember, $this>
     */
    public function staffMembers(): HasMany
    {
        return $this->hasMany(StaffMember::class);
    }
}
