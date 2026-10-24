<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Requests\PayrollMonthRequest;
use App\Http\Requests\SalaryAdjustmentRequest;
use App\Http\Requests\SalaryPaymentRequest;
use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffRole;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Payroll: each month's salaries, worked out from every staff member's
 * salary and the absences marked in attendance, adjusted by hand for
 * bonuses and deductions, then paid.
 */
class PayrollController extends Controller
{
    use DescribesStaff;

    /**
     * Show a month's payroll (`month` as YYYY-MM; this month by default).
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Staff/Payroll', ['company' => null]);
        }

        $currentMonth = CarbonImmutable::today()->startOfMonth();
        $month = $this->queryDate($request->query('month'), 'Y-m')?->startOfMonth()->min($currentMonth) ?? $currentMonth;
        $salaries = $company->salaryPayments()
            ->whereDate('period', $month)
            ->with(['staffMember' => fn ($query) => $query->withTrashed()->with(self::staffRelations())])
            ->get()
            ->sortBy(fn (SalaryPayment $salary) => sprintf(
                '%d-%05d-%s',
                array_search($salary->staffMember->work_level, StaffRole::LEVELS, true),
                $salary->staffMember->role->sort_order,
                Str::lower($salary->staffMember->full_name),
            ))
            ->values();
        $paid = $salaries->filter(fn (SalaryPayment $salary) => $salary->isPaid());
        $pending = $salaries->reject(fn (SalaryPayment $salary) => $salary->isPaid());
        $total = fn ($salaries, string $column) => round($salaries->sum(fn (SalaryPayment $salary) => (float) $salary->{$column}), 2);

        return Inertia::render('Staff/Payroll', [
            'company' => ['currency' => $company->default_currency],
            'month' => $month->format('Y-m'),
            'currentMonth' => $currentMonth->format('Y-m'),
            'salaries' => $salaries->map(fn (SalaryPayment $salary) => [
                ...self::salaryDetails($salary),
                'staff' => [...self::personDetails($salary->staffMember), 'paymentMethod' => $salary->staffMember->salary_payment_method],
            ]),
            'summary' => [
                'count' => $salaries->count(),
                'earned' => $total($salaries, 'earned_salary'),
                'deductions' => round($total($salaries, 'absence_deduction') + $total($salaries, 'deductions'), 2),
                'additions' => $total($salaries, 'additions'),
                'net' => $total($salaries, 'net_pay'),
                'paid' => ['count' => $paid->count(), 'amount' => $total($paid, 'net_pay')],
                'pending' => ['count' => $pending->count(), 'amount' => $total($pending, 'net_pay')],
            ],
            // Staff employed in the month without a salary yet, such as someone who joined after it was prepared.
            'notPrepared' => $company->staffMembers()
                ->employedBetween($month, $month->endOfMonth())
                ->whereNotIn('id', $salaries->pluck('staff_member_id'))
                ->count(),
            'paymentMethods' => SalaryPayment::PAYMENT_METHODS,
            // Supervisors see the payroll; staff admins prepare and pay it.
            'canManage' => Gate::allows('manage-staff'),
        ]);
    }

    /**
     * Prepare a month's payroll, or work it out again with the latest
     * salaries and attendance; salaries already paid stay as they are.
     */
    public function store(PayrollMonthRequest $request): RedirectResponse
    {
        $month = $request->month();
        $count = SalaryPayment::prepareMonth($this->currentCompany($request), $month);

        return to_route('payroll.index', ['month' => $month->format('Y-m')])
            ->with('success', "The payroll for {$month->format('F Y')} is ready: {$count} ".Str::plural('salary', $count).'.');
    }

    /**
     * Add a bonus or a deduction to a salary not yet paid.
     */
    public function update(SalaryAdjustmentRequest $request, SalaryPayment $salaryPayment): RedirectResponse
    {
        $salaryPayment->fill($request->validated());
        $salaryPayment->refreshNetPay();
        $salaryPayment->save();

        return back()->with('success', "The salary of {$salaryPayment->staffMember->full_name} was updated.");
    }

    /**
     * Record one salary as paid. Without a method, it is paid the way the staff member is usually paid.
     */
    public function pay(SalaryPaymentRequest $request, SalaryPayment $salaryPayment): RedirectResponse
    {
        $salaryPayment->markPaid(
            $request->date('paid_on'),
            $request->validated('payment_method') ?? $salaryPayment->staffMember?->salary_payment_method,
            $request->validated('reference'),
            $request->user(),
        );

        return back()->with('success', "The salary of {$salaryPayment->staffMember->full_name} was marked as paid.");
    }

    /**
     * Record every salary still to pay in a month as paid.
     *
     * @throws ValidationException When every salary in the month is already paid.
     */
    public function payAll(SalaryPaymentRequest $request): RedirectResponse
    {
        $month = $request->month();
        $pending = $this->currentCompany($request)->salaryPayments()
            ->whereDate('period', $month)
            ->where('status', 'pending')
            ->with('staffMember:id,salary_payment_method')
            ->get();

        if ($pending->isEmpty()) {
            throw ValidationException::withMessages(['salary' => "There are no salaries left to pay for {$month->format('F Y')}."]);
        }

        DB::transaction(fn () => $pending->each(fn (SalaryPayment $salary) => $salary->markPaid(
            $request->date('paid_on'),
            $request->validated('payment_method') ?? $salary->staffMember?->salary_payment_method,
            $request->validated('reference'),
            $request->user(),
        )));

        return back()->with('success', "{$pending->count()} ".Str::plural('salary', $pending->count())." for {$month->format('F Y')} marked as paid.");
    }

    /**
     * Undo a payment recorded by mistake.
     *
     * @throws ValidationException When the salary is not paid.
     */
    public function unpay(Request $request, SalaryPayment $salaryPayment): RedirectResponse
    {
        $this->ensureSameCompany($request, $salaryPayment);

        if (! $salaryPayment->isPaid()) {
            throw ValidationException::withMessages(['salary' => 'This salary is not paid yet.']);
        }

        $salaryPayment->markUnpaid();

        return back()->with('success', "The payment of {$salaryPayment->staffMember->full_name}'s salary was undone.");
    }

    /**
     * One salary as the payroll and a staff member's page show it.
     *
     * @return array<string, mixed>
     */
    public static function salaryDetails(SalaryPayment $salary): array
    {
        return [
            'id' => $salary->id,
            'period' => $salary->period->format('Y-m'),
            'basicSalary' => (float) $salary->basic_salary,
            'allowances' => (float) $salary->allowances,
            'grossSalary' => (float) $salary->gross_salary,
            'daysInMonth' => $salary->days_in_month,
            'payableDays' => $salary->payable_days,
            'attendance' => $salary->attendance_counts ?? [],
            'earned' => (float) $salary->earned_salary,
            'absenceDeduction' => (float) $salary->absence_deduction,
            'additions' => (float) $salary->additions,
            'deductions' => (float) $salary->deductions,
            'netPay' => (float) $salary->net_pay,
            'status' => $salary->status,
            'paidOn' => $salary->paid_on?->toDateString(),
            'paymentMethod' => $salary->payment_method,
            'reference' => $salary->reference,
            'note' => $salary->note,
        ];
    }
}
