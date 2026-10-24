<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in a maintenance job's history: the job was reported, or moved
 * from one status to another, on `changed_on`.
 */
#[Fillable(['maintenance_status_id', 'previous_status_id', 'changed_on', 'note', 'user_id'])]
class MaintenanceJobUpdate extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'changed_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<MaintenanceJob, $this>
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(MaintenanceJob::class, 'maintenance_job_id');
    }

    /**
     * @return BelongsTo<MaintenanceStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(MaintenanceStatus::class, 'maintenance_status_id');
    }

    /**
     * @return BelongsTo<MaintenanceStatus, $this>
     */
    public function previousStatus(): BelongsTo
    {
        return $this->belongsTo(MaintenanceStatus::class, 'previous_status_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
