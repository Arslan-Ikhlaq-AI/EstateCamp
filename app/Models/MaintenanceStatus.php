<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A step a maintenance job moves through, named on the configuration page.
 * Its stage tells the application what the step means, whatever it is
 * called: not started, work in progress, finished (the invoice and amount
 * are needed) or cancelled.
 *
 * Reference data; the starter rows are inserted by the create_maintenance_statuses_table migration.
 */
#[Fillable(['name', 'slug', 'description', 'stage', 'color', 'sort_order', 'is_active'])]
class MaintenanceStatus extends Model
{
    public const STAGES = ['open', 'in_progress', 'completed', 'cancelled'];

    /**
     * Badge colours a status can be shown in.
     */
    public const COLORS = ['cyan', 'navy', 'amber', 'green', 'red', 'grey'];

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
     * Whether a job in this status is finished, so needs its invoice and amount.
     */
    public function isCompleted(): bool
    {
        return $this->stage === 'completed';
    }

    /**
     * @return HasMany<MaintenanceJob, $this>
     */
    public function jobs(): HasMany
    {
        return $this->hasMany(MaintenanceJob::class);
    }
}
