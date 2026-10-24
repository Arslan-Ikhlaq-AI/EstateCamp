<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A kind of problem a maintenance job is about, such as plumbing or furniture.
 *
 * Reference data; the starter rows are inserted by the create_maintenance_categories_table migration.
 */
#[Fillable(['name', 'slug', 'description', 'sort_order', 'is_active'])]
class MaintenanceCategory extends Model
{
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
        ];
    }

    /**
     * @return HasMany<MaintenanceJob, $this>
     */
    public function jobs(): HasMany
    {
        return $this->hasMany(MaintenanceJob::class);
    }
}
