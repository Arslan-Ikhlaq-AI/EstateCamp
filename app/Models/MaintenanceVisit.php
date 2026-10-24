<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\MaintenanceVisitFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One visit on a contractor's schedule under a maintenance contract, such
 * as a monthly pest control treatment. The contractor gives the dates; the
 * company confirms them, then marks each visit done (with who came and the
 * service report), missed or cancelled.
 *
 * A visit still to happen that falls within its contract's alert window
 * (visit_alert_days), or whose date has passed, needs attention and is
 * flagged on the dashboard until it is dealt with.
 */
#[Fillable([
    'scheduled_on',
    'scheduled_time',
    'technician_name',
    'report_number',
    'notes',
])]
class MaintenanceVisit extends Model
{
    /** @use HasFactory<MaintenanceVisitFactory> */
    use HasFactory;

    public const STATUSES = ['scheduled', 'confirmed', 'done', 'missed', 'cancelled'];

    /**
     * Statuses of a visit still to happen.
     */
    public const OPEN_STATUSES = ['scheduled', 'confirmed'];

    /**
     * The disk holding service reports.
     */
    public const REPORT_DISK = 'local';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scheduled_on' => 'date',
            'rescheduled_from' => 'date',
            'completed_on' => 'date',
        ];
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    /**
     * Days from today to the visit (negative once it has passed).
     */
    public function daysAway(): int
    {
        return (int) today()->diffInDays($this->scheduled_on, false);
    }

    /**
     * Whether the visit needs someone to act: `overdue` once its date has
     * passed without it being dealt with, `due` from its contract's alert
     * window up to the day itself, otherwise null.
     */
    public function alertState(): ?string
    {
        if (! $this->isOpen()) {
            return null;
        }

        $days = $this->daysAway();

        return match (true) {
            $days < 0 => 'overdue',
            $days <= $this->contract->visit_alert_days => 'due',
            default => null,
        };
    }

    /**
     * What the visit can move to from where it stands, the likeliest first.
     * A visit done stays done unless it was marked so by mistake, when it
     * can go back on the schedule; a missed or cancelled one can be put back too.
     *
     * @return list<string>
     */
    public function allowedStatuses(): array
    {
        return match ($this->status) {
            'scheduled' => ['done', 'confirmed', 'missed', 'cancelled'],
            'confirmed' => ['done', 'missed', 'scheduled', 'cancelled'],
            default => ['scheduled'],
        };
    }

    /**
     * Move the visit to `$status`. Marking it done records the day it was
     * done (and keeps the contract's last visit up to date); putting it back
     * on the schedule clears what was recorded about it.
     *
     * @param  array{completed_on?: ?CarbonInterface, technician_name?: ?string, report_number?: ?string, notes?: ?string}  $details
     *
     * @throws ValidationException When the visit cannot move to that status now.
     */
    public function moveTo(string $status, array $details = [], ?UploadedFile $report = null, ?User $by = null): void
    {
        if (! in_array($status, $this->allowedStatuses(), true)) {
            throw ValidationException::withMessages(['status' => "This visit cannot be marked as {$status} while it is {$this->status}."]);
        }

        DB::transaction(function () use ($status, $details, $report, $by) {
            $isDone = $status === 'done';

            $this->forceFill([
                'status' => $status,
                'completed_on' => $isDone ? ($details['completed_on'] ?? today()) : null,
                'technician_name' => $isDone ? ($details['technician_name'] ?? null) : null,
                'report_number' => $isDone ? ($details['report_number'] ?? null) : null,
                'notes' => array_key_exists('notes', $details) ? $details['notes'] : $this->notes,
                'updated_by' => $by?->id,
            ])->save();

            if (! $isDone) {
                $this->removeReport();
            } elseif ($report) {
                $this->storeReport($report);
            }

            $this->contract->syncLastVisit();
        });
    }

    /**
     * Move the visit to another day (and time). The first date it was
     * planned for is kept; a missed visit goes back on the schedule.
     */
    public function reschedule(CarbonInterface $on, ?string $time, ?User $by = null): void
    {
        $moved = ! $this->scheduled_on->isSameDay($on);

        $this->forceFill([
            'scheduled_on' => $on,
            'scheduled_time' => $time,
            'rescheduled_from' => $moved ? ($this->rescheduled_from ?? $this->scheduled_on) : $this->rescheduled_from,
            'status' => $this->status === 'missed' ? 'scheduled' : $this->status,
            'updated_by' => $by?->id,
        ])->save();
    }

    /**
     * Save the service report the contractor left, replacing any earlier copy.
     */
    public function storeReport(UploadedFile $file): void
    {
        $this->removeReport();

        $path = $file->storeAs(
            "amcs/{$this->company_id}/{$this->maintenance_contract_id}/visits",
            "report-{$this->id}-".Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::REPORT_DISK,
        );

        $this->forceFill(['report_path' => $path, 'report_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeReport(): void
    {
        if ($this->report_path) {
            Storage::disk(self::REPORT_DISK)->delete($this->report_path);
            $this->forceFill(['report_path' => null, 'report_name' => null])->save();
        }
    }

    /**
     * Delete a visit entered by mistake, with its report.
     */
    public function discard(): void
    {
        DB::transaction(function () {
            $this->removeReport();
            $this->delete();
            $this->contract->syncLastVisit();
        });
    }

    /**
     * @param  Builder<MaintenanceVisit>  $query
     */
    #[Scope]
    protected function open(Builder $query): void
    {
        $query->whereIn('maintenance_visits.status', self::OPEN_STATUSES);
    }

    /**
     * Open visits under contracts still in force that need someone to act
     * (see alertState()): their day has passed, or it falls within their
     * contract's alert window. The window is each contract's own, matched
     * against the few lengths a contract can choose.
     *
     * @param  Builder<MaintenanceVisit>  $query
     */
    #[Scope]
    protected function needingAttention(Builder $query): void
    {
        $today = today();

        $query->open()->whereHas('contract', fn (Builder $contracts) => $contracts
            ->where('status', 'active')
            ->where(function (Builder $contracts) use ($today) {
                foreach (MaintenanceContract::VISIT_ALERT_DAYS as $days) {
                    $contracts->orWhere(fn (Builder $contracts) => $contracts
                        ->where('visit_alert_days', $days)
                        ->whereDate('maintenance_visits.scheduled_on', '<=', $today->copy()->addDays($days)));
                }

                $contracts->orWhere(fn (Builder $contracts) => $contracts
                    ->whereNotIn('visit_alert_days', MaintenanceContract::VISIT_ALERT_DAYS)
                    ->whereDate('maintenance_visits.scheduled_on', '<=', $today->copy()->addDays(MaintenanceContract::DEFAULT_VISIT_ALERT_DAYS)));
            }));
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<MaintenanceContract, $this>
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(MaintenanceContract::class, 'maintenance_contract_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
