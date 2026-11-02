<?php

namespace App\Models;

use App\Models\Concerns\LimitedToCamps;
use Database\Factories\StaffAttendanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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
    use HasFactory, LimitedToCamps;

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
     * The minutes from check-in to check-out, or null until both are
     * recorded. A check-out before the check-in ends a night shift the next
     * morning.
     */
    public function minutesWorked(): ?int
    {
        if (! $this->check_in || ! $this->check_out) {
            return null;
        }

        $minutesOf = fn (string $time): int => (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
        $minutes = $minutesOf($this->check_out) - $minutesOf($this->check_in);

        return $minutes < 0 ? $minutes + 24 * 60 : $minutes;
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

    /**
     * Attendance of the camps' staff.
     *
     * @param  Builder<static>  $query
     * @param  list<int>  $propertyIds
     */
    public function limitToCamps(Builder $query, array $propertyIds): void
    {
        $query->whereHas('staffMember');
    }

    /**
     * Of someone working at the camps.
     *
     * @param  list<int>  $propertyIds
     */
    public function isAtCamps(array $propertyIds): bool
    {
        return $this->staffMember()->exists();
    }
}
