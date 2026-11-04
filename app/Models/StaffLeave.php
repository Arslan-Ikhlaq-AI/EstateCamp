<?php

namespace App\Models;

use App\Models\Concerns\LimitedToCamps;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Database\Factories\StaffLeaveFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Leave a staff member asked for, or that the company gave them, from
 * `starts_on` to `ends_on`. Every calendar day counts, weekends included,
 * since the payroll pays by the calendar day.
 *
 * A request waits (`pending`) until someone who manages leave approves it
 * as paid or unpaid, or rejects it; the staff member may cancel it while it
 * waits. Leave the company gives is approved as it is added. Approving
 * marks each of its days the staff member is employed as paid or unpaid
 * leave in attendance, replacing what was marked, and works out again the
 * salaries of those months not yet paid, so each unpaid day comes off the
 * pay like an absence. Cancelling approved leave clears those days and works
 * the salaries out again. Salaries already paid stay as they were.
 */
#[Fillable(['type', 'starts_on', 'ends_on', 'reason'])]
class StaffLeave extends Model
{
    /** @use HasFactory<StaffLeaveFactory> */
    use HasFactory, LimitedToCamps;

    public const TYPES = ['annual', 'sick', 'emergency', 'other'];

    public const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

    /**
     * Requests still waiting and leave approved: the leave that stops another from overlapping it.
     */
    public const ACTIVE_STATUSES = ['pending', 'approved'];

    /**
     * The longest leave that can be asked for or given, in days.
     */
    public const MAX_DAYS = 366;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'days' => 'integer',
            'is_request' => 'boolean',
            'is_paid' => 'boolean',
            'decided_at' => 'datetime',
        ];
    }

    /**
     * The days from `$from` to `$to`, both included.
     */
    public static function daysBetween(CarbonInterface $from, CarbonInterface $to): int
    {
        return (int) CarbonImmutable::parse($from)->startOfDay()->diffInDays(CarbonImmutable::parse($to)->startOfDay()) + 1;
    }

    /**
     * Save leave for `$member` with `$details` (its type, days and reason),
     * added by `$by`: their own request when `$isRequest`, otherwise leave
     * the company gives them, still to be approved.
     *
     * @param  array{type: string, starts_on: string, ends_on: string, reason?: string|null}  $details
     */
    public static function record(StaffMember $member, array $details, User $by, bool $isRequest): self
    {
        $leave = new self($details);
        $leave->forceFill([
            'company_id' => $member->company_id,
            'staff_member_id' => $member->id,
            'days' => self::daysBetween(CarbonImmutable::parse($details['starts_on']), CarbonImmutable::parse($details['ends_on'])),
            'reason' => filled($details['reason'] ?? null) ? trim($details['reason']) : null,
            'is_request' => $isRequest,
            'status' => 'pending',
            'requested_by' => $by->id,
        ])->save();

        return $leave->setRelation('staffMember', $member);
    }

    /**
     * Approve the leave as paid or unpaid: its days are marked in attendance
     * and the salaries of their months not yet paid are worked out again.
     */
    public function approve(bool $isPaid, ?string $note, User $by): void
    {
        DB::transaction(function () use ($isPaid, $note, $by) {
            $this->forceFill([
                'status' => 'approved',
                'is_paid' => $isPaid,
                'decision_note' => filled($note) ? trim($note) : null,
                'decided_by' => $by->id,
                'decided_at' => now(),
            ])->save();

            $this->markAttendance($by);
            $this->refreshSalaries();
        });
    }

    /**
     * Turn the request down; nothing is marked.
     */
    public function reject(?string $note, User $by): void
    {
        $this->forceFill([
            'status' => 'rejected',
            'decision_note' => filled($note) ? trim($note) : null,
            'decided_by' => $by->id,
            'decided_at' => now(),
        ])->save();
    }

    /**
     * Withdraw a request, or call off approved leave: its days are cleared
     * from attendance and the salaries of their months not yet paid are
     * worked out again.
     */
    public function cancel(User $by): void
    {
        DB::transaction(function () use ($by) {
            $wasApproved = $this->isApproved();

            $this->forceFill(['status' => 'cancelled', 'decided_by' => $by->id, 'decided_at' => now()])->save();

            if ($wasApproved) {
                $this->attendances()->delete();
                $this->refreshSalaries();
            }
        });
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    /**
     * Each month the leave falls in, with how many of its days are in that
     * month and the days in the month.
     *
     * @return Collection<int, array{month: CarbonImmutable, days: int, daysInMonth: int}>
     */
    public function months(): Collection
    {
        $start = CarbonImmutable::parse($this->starts_on);
        $end = CarbonImmutable::parse($this->ends_on);

        return collect(CarbonPeriod::create($start->startOfMonth(), '1 month', $end->startOfMonth()))
            ->map(function (CarbonInterface $month) use ($start, $end): array {
                $month = CarbonImmutable::parse($month);

                return [
                    'month' => $month,
                    'days' => self::daysBetween($start->max($month), $end->min($month->endOfMonth())),
                    'daysInMonth' => $month->daysInMonth,
                ];
            })
            ->values();
    }

    /**
     * Months of the leave whose salary is already paid, so approving or
     * cancelling it did not change them.
     *
     * @return Collection<int, CarbonImmutable>
     */
    public function paidMonths(): Collection
    {
        $paid = $this->staffMember->salaryPayments()
            ->where('status', 'paid')
            ->whereDate('period', '>=', CarbonImmutable::parse($this->starts_on)->startOfMonth())
            ->whereDate('period', '<=', CarbonImmutable::parse($this->ends_on)->startOfMonth())
            ->pluck('period')
            ->map(fn ($period) => CarbonImmutable::parse($period)->format('Y-m'));

        return $this->months()->pluck('month')->filter(fn (CarbonImmutable $month) => $paid->contains($month->format('Y-m')))->values();
    }

    /**
     * Mark each day of the leave the staff member is employed as paid or
     * unpaid leave, replacing whatever was marked on it.
     */
    private function markAttendance(User $by): void
    {
        $member = $this->staffMember;
        $from = CarbonImmutable::parse($this->starts_on)->max(CarbonImmutable::parse($member->joined_on));
        $to = $member->left_on ? CarbonImmutable::parse($this->ends_on)->min(CarbonImmutable::parse($member->left_on)) : CarbonImmutable::parse($this->ends_on);

        if ($from->gt($to)) {
            return;
        }

        // Dates are written as Eloquent writes them, so each day meets the row already there.
        $model = new StaffAttendance;
        $rows = collect(CarbonPeriod::create($from, $to))->map(fn (CarbonInterface $day): array => [
            'company_id' => $this->company_id,
            'staff_member_id' => $this->staff_member_id,
            'staff_leave_id' => $this->id,
            'work_date' => $model->fromDateTime($day),
            'status' => $this->is_paid ? 'leave' : 'unpaid_leave',
            'check_in' => null,
            'check_out' => null,
            'note' => null,
            'recorded_by' => $by->id,
        ]);

        foreach ($rows->chunk(200) as $chunk) {
            StaffAttendance::query()->upsert($chunk->values()->all(), ['staff_member_id', 'work_date'], ['staff_leave_id', 'status', 'check_in', 'check_out', 'note', 'recorded_by']);
        }
    }

    /**
     * Work out again the salaries of the leave's months that are not yet paid.
     */
    private function refreshSalaries(): void
    {
        $member = $this->staffMember;
        $member->salaryPayments()
            ->where('status', 'pending')
            ->whereDate('period', '>=', CarbonImmutable::parse($this->starts_on)->startOfMonth())
            ->whereDate('period', '<=', CarbonImmutable::parse($this->ends_on)->startOfMonth())
            ->get()
            ->each(function (SalaryPayment $salary) use ($member) {
                $salary->calculate($member);
                $salary->save();
            });
    }

    /**
     * Leave on any day from `$from` to `$to`.
     *
     * @param  Builder<StaffLeave>  $query
     */
    #[Scope]
    protected function overlapping(Builder $query, CarbonInterface $from, CarbonInterface $to): void
    {
        $query->whereDate('starts_on', '<=', $to)->whereDate('ends_on', '>=', $from);
    }

    /**
     * Requests still waiting and leave approved.
     *
     * @param  Builder<StaffLeave>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
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
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    /**
     * The days of attendance the approved leave marked.
     *
     * @return HasMany<StaffAttendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(StaffAttendance::class);
    }

    /**
     * Leave of the camps' staff.
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
