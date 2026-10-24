import ActionDialog from '@/Components/ActionDialog';
import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
import { SalaryStatusBadge, StaffAvatar, useAbsences, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardFooter } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router } from '@inertiajs/react';
import {
    BanknoteIcon,
    CalculatorIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    EyeIcon,
    HandCoinsIcon,
    HourglassIcon,
    InfoIcon,
    MoreHorizontalIcon,
    RefreshCwIcon,
    ReceiptTextIcon,
    SlidersHorizontalIcon,
    Undo2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { AdjustDialog, PayDialog } from './Partials/SalaryDialogs';

/**
 * The "more" menu of one salary: adjust or pay it while unpaid, undo its
 * payment once paid, or open the person's profile. Supervisors, who only
 * see the payroll, get the profile link alone.
 */
function SalaryActions({ salary, canManage, onAdjust, onPay, onUndo }) {
    const { t } = useTranslation();
    const isPaid = salary.status === 'paid';

    if (!canManage) {
        return (
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('staff.payroll.actions.profile')}
                nativeButton={false}
                render={<Link href={route('staff.show', salary.staff.id)} />}
                className="text-muted-foreground hover:text-foreground"
            >
                <EyeIcon />
            </Button>
        );
    }


    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('staff.payroll.actions.menu', { name: salary.staff.name })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{salary.staff.name}</DropdownMenuLabel>
                    {isPaid ? (
                        <DropdownMenuItem onClick={onUndo}>
                            <Undo2Icon />
                            {t('staff.payroll.actions.unpay')}
                        </DropdownMenuItem>
                    ) : (
                        <>
                            <DropdownMenuItem onClick={onAdjust}>
                                <SlidersHorizontalIcon />
                                {t('staff.payroll.actions.adjust')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onPay}>
                                <HandCoinsIcon />
                                {t('staff.payroll.actions.pay')}
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href={route('staff.show', salary.staff.id)} />}>
                    <EyeIcon />
                    {t('staff.payroll.actions.profile')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Payroll: one month's salaries with their totals, prepared from everyone's
 * pay and attendance, adjusted, then paid one by one or all at once.
 */
export default function Payroll({ company, month, currentMonth, salaries, summary, notPrepared, paymentMethods, canManage }) {
    const { t, formatMoney, formatCurrency, formatNumber, formatDate } = useTranslation();
    const { roleName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const absences = useAbsences();
    const [adjusting, setAdjusting] = useState(null);
    const [paying, setPaying] = useState(null);
    const [undoing, setUndoing] = useState(null);
    const [busy, setBusy] = useState(false);
    const title = t('staff.payroll.title');
    const monthName = month ? formatMonth(month) : '';
    const currency = company?.currency;

    const goTo = (next) => router.get(route('payroll.index'), next === currentMonth ? {} : { month: next }, { preserveScroll: true });
    const request = (url, data = {}, onSuccess) => router.post(url, data, { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false), onSuccess });
    const prepare = () => request(route('payroll.store'), { month });

    const columns = [
        {
            id: 'staff',
            header: t('staff.payroll.columns.staff'),
            cell: (salary) => (
                <div className="flex min-w-0 items-center gap-3">
                    <StaffAvatar name={salary.staff.name} />
                    <div className="flex min-w-0 flex-col">
                        <Link href={route('staff.show', salary.staff.id)} dir="auto" className="max-w-56 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {salary.staff.name}
                        </Link>
                        <span dir="auto" className="max-w-56 truncate text-xs text-muted-foreground">
                            {roleName(salary.staff.role)}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            id: 'salary',
            header: t('staff.payroll.columns.salary'),
            align: 'end',
            cell: (salary) => (
                <div className="flex flex-col items-end">
                    <span className="tabular-nums">{formatMoney(salary.grossSalary, currency)}</span>
                    <Workplace workplace={salary.staff.workplace} className="max-w-40 text-xs text-muted-foreground" />
                </div>
            ),
        },
        {
            id: 'days',
            header: t('staff.payroll.columns.days'),
            cell: (salary) => (
                <div className="flex flex-col text-sm tabular-nums">
                    <span>{t('staff.payroll.days', { payable: salary.payableDays, total: salary.daysInMonth })}</span>
                    <span className={(salary.attendance.absent ?? 0) + (salary.attendance.half_day ?? 0) > 0 ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                        {absences(salary.attendance)}
                    </span>
                </div>
            ),
        },
        {
            id: 'deductions',
            header: t('staff.payroll.columns.deductions'),
            align: 'end',
            cell: (salary) => {
                const total = salary.absenceDeduction + salary.deductions;

                return total === 0 ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <div className="flex flex-col items-end">
                        <span className="text-destructive tabular-nums">−{formatMoney(total, currency)}</span>
                        {salary.absenceDeduction > 0 && salary.deductions > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {t('staff.payroll.breakdown', { absence: formatMoney(salary.absenceDeduction, currency), other: formatMoney(salary.deductions, currency) })}
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            id: 'net',
            header: t('staff.payroll.columns.net'),
            align: 'end',
            cell: (salary) => (
                <div className="flex flex-col items-end">
                    <span className="font-semibold tabular-nums">{formatMoney(salary.netPay, currency)}</span>
                    {salary.additions > 0 && <span className="text-xs text-success tabular-nums">+{formatMoney(salary.additions, currency)}</span>}
                    {salary.note && (
                        <span dir="auto" title={salary.note} className="max-w-40 truncate text-xs text-muted-foreground">
                            {salary.note}
                        </span>
                    )}
                </div>
            ),
        },
        {
            id: 'status',
            header: t('staff.payroll.columns.status'),
            cell: (salary) => (
                <div className="flex flex-col items-start gap-0.5">
                    <SalaryStatusBadge status={salary.status} />
                    {salary.paidOn && (
                        <span title={salary.paymentMethod ? t(`staff.paymentMethods.${salary.paymentMethod}`) : undefined} className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(salary.paidOn)}
                        </span>
                    )}
                </div>
            ),
        },
    ];

    const totalsRow = salaries?.length > 0 && (
        <TableRow className="bg-muted/40 font-semibold hover:bg-muted/40">
            <TableCell colSpan={3} className="ps-4 sm:ps-5 lg:ps-6">
                {t('staff.payroll.totals')}
            </TableCell>
            <TableCell className="text-end text-destructive tabular-nums">−{formatMoney(summary.deductions, currency)}</TableCell>
            <TableCell className="text-end tabular-nums">
                <span className="flex flex-col items-end">
                    {formatMoney(summary.net, currency)}
                    {summary.additions > 0 && <span className="text-xs font-normal text-success">+{formatMoney(summary.additions, currency)}</span>}
                </span>
            </TableCell>
            <TableCell colSpan={2} />
        </TableRow>
    );

    return (
        <DashboardLayout>
            <Head title={month ? `${title} · ${monthName}` : title} />

            <PageHeader
                breadcrumbs={[{ label: t('staff.title'), href: route('staff.index') }, { label: title }]}
                title={title}
                description={t('staff.payroll.description')}
                actions={
                    company &&
                    canManage &&
                    salaries.length > 0 && (
                        <>
                            {(summary.pending.count > 0 || notPrepared > 0) && (
                                <Button variant="outline" onClick={prepare} disabled={busy} title={t('staff.payroll.recalculateHint')}>
                                    {busy ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
                                    {t('staff.payroll.recalculate')}
                                </Button>
                            )}
                            {summary.pending.count > 0 && (
                                <Button onClick={() => setPaying('all')}>
                                    <HandCoinsIcon data-icon="inline-start" />
                                    {t('staff.payroll.payAll')}
                                </Button>
                            )}
                        </>
                    )
                }
            />

            <FlashMessages errorKeys={['month', 'salary']} />

            {company === null ? (
                <NoCompany icon={BanknoteIcon} />
            ) : (
                <>
                    <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="icon" aria-label={t('staff.payroll.previousMonth')} onClick={() => goTo(addMonths(`${month}-01`, -1).slice(0, 7))}>
                            <ChevronLeftIcon className="rtl:-scale-x-100" />
                        </Button>
                        <Input
                            type="month"
                            aria-label={t('staff.payroll.month')}
                            value={month}
                            max={currentMonth}
                            onChange={(event) => event.target.value && goTo(event.target.value)}
                            className="w-44 tabular-nums"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label={t('staff.payroll.nextMonth')}
                            onClick={() => goTo(addMonths(`${month}-01`, 1).slice(0, 7))}
                            disabled={month >= currentMonth}
                        >
                            <ChevronRightIcon className="rtl:-scale-x-100" />
                        </Button>
                        <span className="ms-2 font-heading text-lg font-semibold">{monthName}</span>
                    </div>

                    {canManage && salaries.length > 0 && notPrepared > 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/[0.08] px-4 py-3 text-[0.875rem] text-warning ring-1 ring-warning/25">
                            <CircleAlertIcon className="size-4 shrink-0" />
                            <span className="flex-1">{t('staff.payroll.notPrepared', { count: notPrepared })}</span>
                            <Button variant="outline" size="sm" onClick={prepare} disabled={busy}>
                                <RefreshCwIcon data-icon="inline-start" />
                                {t('staff.payroll.recalculate')}
                            </Button>
                        </div>
                    )}

                    {salaries.length === 0 ? (
                        <Empty className="border bg-card py-16 shadow-(--card-shadow)">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <CalculatorIcon />
                                </EmptyMedia>
                                <EmptyTitle>{t('staff.payroll.empty.title', { month: monthName })}</EmptyTitle>
                                <EmptyDescription>{t('staff.payroll.empty.description')}</EmptyDescription>
                            </EmptyHeader>
                            {canManage && (
                                <EmptyContent>
                                    <Button variant="brand" onClick={prepare} disabled={busy}>
                                        {busy ? <Spinner data-icon="inline-start" /> : <CalculatorIcon data-icon="inline-start" />}
                                        {t('staff.payroll.prepare', { month: monthName })}
                                    </Button>
                                </EmptyContent>
                            )}
                        </Empty>
                    ) : (
                        <>
                            <section aria-label={t('staff.payroll.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                                <StatCard
                                    icon={ReceiptTextIcon}
                                    label={t('staff.payroll.stats.net')}
                                    value={formatCurrency(summary.net, currency)}
                                    detail={t('staff.payroll.stats.netDetail', { count: formatNumber(summary.count), earned: formatCurrency(summary.earned, currency) })}
                                />
                                <StatCard
                                    icon={CircleAlertIcon}
                                    tone="warning"
                                    label={t('staff.payroll.stats.deductions')}
                                    value={formatCurrency(summary.deductions, currency)}
                                    detail={t('staff.payroll.stats.deductionsDetail', { additions: formatCurrency(summary.additions, currency) })}
                                />
                                <StatCard
                                    icon={CircleCheckIcon}
                                    tone="success"
                                    label={t('staff.payroll.stats.paid')}
                                    value={formatCurrency(summary.paid.amount, currency)}
                                    meter={summary.net > 0 ? (summary.paid.amount / summary.net) * 100 : 0}
                                    detail={t('staff.payroll.stats.paidDetail', { count: summary.paid.count })}
                                />
                                <StatCard
                                    icon={HourglassIcon}
                                    tone="gold"
                                    label={t('staff.payroll.stats.pending')}
                                    value={formatCurrency(summary.pending.amount, currency)}
                                    detail={summary.pending.count > 0 ? t('staff.payroll.stats.pendingDetail', { count: summary.pending.count }) : t('staff.payroll.stats.nothingPending')}
                                />
                            </section>

                            <Card className="gap-0 py-0">
                                <DataTable
                                    columns={columns}
                                    rows={salaries}
                                    footer={totalsRow}
                                    actions={(salary) => (
                                        <SalaryActions
                                            canManage={canManage}
                                            salary={salary}
                                            onAdjust={() => setAdjusting(salary)}
                                            onPay={() => setPaying(salary)}
                                            onUndo={() => setUndoing(salary)}
                                        />
                                    )}
                                />
                                <CardFooter className="flex gap-2 border-t bg-transparent px-4 py-3 text-[0.8125rem] text-pretty text-muted-foreground sm:px-5 lg:px-6">
                                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                                    {t('staff.payroll.explain')}
                                </CardFooter>
                            </Card>
                        </>
                    )}
                </>
            )}

            {adjusting && <AdjustDialog key={adjusting.id} salary={adjusting} currency={currency} open onOpenChange={(open) => !open && setAdjusting(null)} />}

            {paying && (
                <PayDialog
                    key={paying === 'all' ? 'all' : paying.id}
                    salary={paying === 'all' ? null : paying}
                    month={month}
                    monthName={monthName}
                    pending={summary.pending}
                    currency={currency}
                    paymentMethods={paymentMethods}
                    open
                    onOpenChange={(open) => !open && setPaying(null)}
                />
            )}

            {undoing && (
                <ActionDialog
                    open
                    onOpenChange={(open) => !open && setUndoing(null)}
                    title={t('staff.payroll.unpay.title', { name: undoing.staff.name })}
                    description={t('staff.payroll.unpay.description')}
                    submitLabel={t('staff.payroll.unpay.submit')}
                    processing={busy}
                    onSubmit={() => request(route('payroll.unpay', undoing.id), {}, () => setUndoing(null))}
                />
            )}
        </DashboardLayout>
    );
}
