<?php

namespace App\Models;

use Database\Factories\StaffAttendanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One staff member's attendance on one day, with the times they came and
 * went. A day not marked counts as worked.
 */
#[Fillable(['work_date', 'status', 'check_in', 'check_out', 'note'])]
class StaffAttendance extends Model
{
    /** @use HasFactory<StaffAttendanceFactory> */
    use HasFactory;

    public const STATUSES = ['present', 'half_day', 'absent', 'leave', 'day_off'];

    /**
     * The share of a day's pay each status takes off the salary; leave and
     * days off are paid.
     */
    public const UNPAID_SHARE = ['absent' => 1.0, 'half_day' => 0.5];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'work_date' => 'date',
        ];
    }

    /**
     * A time as HH:MM, whether the database returns it with seconds or not.
     */
    public static function shortTime(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }

    /**
     * @return BelongsTo<StaffMember, $this>
     */
    public function staffMember(): BelongsTo
    {
        return $this->belongsTo(StaffMember::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
