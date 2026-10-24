<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * One staff member's salary for one month, as the payroll works it out.
 *
 * The month's pay is the monthly salary (basic pay plus allowances) for the
 * days they were employed in it, less a day's pay for each day absent and
 * half for each half day; leave and days off are paid. A day's pay is the
 * monthly salary divided by the days in the month. Bonuses and deductions
 * such as an advance are added by hand. Until it is paid the salary is
 * worked out again each time the payroll is prepared; once paid it is kept
 * as it was.
 */
#[Fillable(['additions', 'deductions', 'note'])]
class SalaryPayment extends Model
{
    public const STATUSES = ['pending', 'paid'];

    public const PAYMENT_METHODS = StaffMember::PAYMENT_METHODS;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period' => 'date',
            'paid_on' => 'date',
            'basic_salary' => 'decimal:2',
            'allowances' => 'decimal:2',
            'gross_salary' => 'decimal:2',
            'days_in_month' => 'integer',
            'payable_days' => 'integer',
            'attendance_counts' => 'array',
            'earned_salary' => 'decimal:2',
            'absence_deduction' => 'decimal:2',
            'additions' => 'decimal:2',
            'deductions' => 'decimal:2',
            'net_pay' => 'decimal:2',
        ];
    }

    /**
     * Prepare the company's payroll for the month `$month` falls in: a salary
     * for everyone employed on any day of it. Salaries not yet paid are
     * worked out again from today's salary and attendance, keeping their
     * bonuses, deductions and notes; paid ones are left as they are. Unpaid
     * salaries of anyone no longer employed in the month are removed.
     *
     * Returns how many salaries the month has.
     */
    public static function prepareMonth(Company $company, CarbonInterface $month): int
    {
        $start = CarbonImmutable::parse($month)->startOfMonth();
        $end = $start->endOfMonth()->startOfDay();

        return DB::transaction(function () use ($company, $start, $end) {
            $staff = $company->staffMembers()->employedBetween($start, $end)->get();
            $payments = $company->salaryPayments()->whereDate('period', $start)->get()->keyBy('staff_member_id');

            $payments
                ->filter(fn (SalaryPayment $payment) => ! $payment->isPaid() && ! $staff->contains('id', $payment->staff_member_id))
                ->each(fn (SalaryPayment $payment) => $payment->delete());

            foreach ($staff as $member) {
                $payment = $payments->get($member->id) ?? (new SalaryPayment)->forceFill([
                    'company_id' => $company->id,
                    'staff_member_id' => $member->id,
                    'period' => $start,
                ]);

                if (! $payment->isPaid()) {
                    $payment->calculate($member);
                    $payment->save();
                }
            }

            return $company->salaryPayments()->whereDate('period', $start)->count();
        });
    }

    /**
     * Work out `$member`'s pay for this salary's month from their salary and
     * the attendance marked for the days they were employed.
     */
    public function calculate(StaffMember $member): void
    {
        $start = CarbonImmutable::parse($this->period)->startOfMonth();
        $end = $start->endOfMonth()->startOfDay();
        $from = CarbonImmutable::parse($member->joined_on)->max($start);
        $to = $member->left_on ? CarbonImmutable::parse($member->left_on)->min($end) : $end;
        $daysInMonth = $start->daysInMonth;
        $payableDays = (int) $from->diffInDays($to) + 1;
        $gross = $member->grossSalary();
        $dailyRate = $gross / $daysInMonth;

        $marked = $member->attendances()
            ->whereDate('work_date', '>=', $from)
            ->whereDate('work_date', '<=', $to)
            ->toBase()
            ->groupBy('status')
            ->selectRaw('status, count(*) as aggregate')
            ->pluck('aggregate', 'status');
        $counts = collect(StaffAttendance::STATUSES)->mapWithKeys(fn (string $status) => [$status => (int) ($marked[$status] ?? 0)]);
        $unpaidDays = collect(StaffAttendance::UNPAID_SHARE)->sum(fn (float $share, string $status) => $share * $counts[$status]);
        $earned = $payableDays === $daysInMonth ? $gross : round($dailyRate * $payableDays, 2);

        $this->forceFill([
            'basic_salary' => $member->basic_salary,
            'allowances' => $member->allowances(),
            'gross_salary' => $gross,
            'days_in_month' => $daysInMonth,
            'payable_days' => $payableDays,
            'attendance_counts' => $counts->all(),
            'earned_salary' => $earned,
            'absence_deduction' => min($earned, round($dailyRate * $unpaidDays, 2)),
            'additions' => $this->additions ?? 0,
            'deductions' => $this->deductions ?? 0,
            'status' => 'pending',
        ]);
        $this->refreshNetPay();
    }

    /**
     * Pay earned, less absences and deductions, plus additions; never below zero.
     */
    public function refreshNetPay(): void
    {
        $this->net_pay = max(0, round((float) $this->earned_salary - (float) $this->absence_deduction + (float) $this->additions - (float) $this->deductions, 2));
    }

    public function markPaid(CarbonInterface $on, ?string $method, ?string $reference, ?User $by = null): void
    {
        $this->forceFill([
            'status' => 'paid',
            'paid_on' => $on,
            'payment_method' => $method,
            'reference' => filled($reference) ? trim($reference) : null,
            'paid_by' => $by?->id,
        ])->save();
    }

    /**
     * Undo a payment recorded by mistake, so the salary can be changed again.
     */
    public function markUnpaid(): void
    {
        $this->forceFill(['status' => 'pending', 'paid_on' => null, 'payment_method' => null, 'reference' => null, 'paid_by' => null])->save();
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
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
    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
