import DataTable from '@/Components/DataTable';
import { METHOD_ICONS } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import { SalaryStatusBadge, StaffAvatar, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { BanknoteIcon, CalculatorIcon, CircleAlertIcon, CircleCheckIcon, EyeIcon, HourglassIcon, ReceiptTextIcon } from 'lucide-react';

const STATUS_ICONS = { pending: HourglassIcon, paid: CircleCheckIcon };

/**
 * Staff salaries as payments: every salary the payroll worked out, across
 * months, with the period filter picking the salary months shown.
 * Preparing and paying salaries stays on the payroll page.
 */
export default function Index({ company, filters, period, facets, summary, salaries }) {
    const { t, formatCurrency, formatMoney, formatDate, formatNumber } = useTranslation();
    const { full } = usePeriodLabel();
    const { roleName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const title = t('finance.salaries.title');

    const payrollButton = (
        <Button variant="outline" nativeButton={false} render={<Link href={route('payroll.index')} />}>
            <CalculatorIcon data-icon="inline-start" />
            {t('finance.salaries.openPayroll')}
        </Button>
    );

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
            id: 'month',
            header: t('finance.salaries.columns.month'),
            cell: (salary) => (
                <div className="flex flex-col">
                    <span className="font-medium">{formatMonth(salary.period)}</span>
                    <Workplace workplace={salary.staff.workplace} className="max-w-44 text-xs text-muted-foreground" />
                </div>
            ),
        },
        { id: 'gross', header: t('staff.payroll.columns.salary'), align: 'end', cell: (salary) => <span className="tabular-nums">{formatMoney(salary.grossSalary, company.currency)}</span> },
        {
            id: 'deductions',
            header: t('staff.payroll.columns.deductions'),
            align: 'end',
            cell: (salary) => {
                const total = salary.absenceDeduction + salary.deductions;

                return (
                    <div className="flex flex-col items-end">
                        {total > 0 ? <span className="text-destructive tabular-nums">−{formatMoney(total, company.currency)}</span> : <span className="text-muted-foreground">—</span>}
                        {salary.additions > 0 && <span className="text-xs text-success tabular-nums">+{formatMoney(salary.additions, company.currency)}</span>}
                    </div>
                );
            },
        },
        { id: 'net', header: t('staff.payroll.columns.net'), align: 'end', cell: (salary) => <span className="font-semibold tabular-nums">{formatMoney(salary.netPay, company.currency)}</span> },
        {
            id: 'status',
            header: t('staff.payroll.columns.status'),
            cell: (salary) => {
                const Icon = METHOD_ICONS[salary.paymentMethod];

                return (
                    <div className="flex flex-col items-start gap-0.5">
                        <SalaryStatusBadge status={salary.status} />
                        {salary.paidOn && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                                {Icon && <Icon className="size-3" />}
                                {[formatDate(salary.paidOn), salary.reference].filter(Boolean).join(' · ')}
                            </span>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={salaries?.total} description={t('finance.salaries.description')} actions={company && payrollButton} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={BanknoteIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.salaries.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={ReceiptTextIcon}
                            label={t('finance.salaries.stats.net')}
                            value={formatCurrency(summary.net, company.currency)}
                            detail={t('finance.salaries.stats.netDetail', { staff: formatNumber(summary.staff), months: formatNumber(summary.months), period: full(period) })}
                        />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('finance.salaries.stats.paid')}
                            value={formatCurrency(summary.paid.amount, company.currency)}
                            meter={summary.net > 0 ? (summary.paid.amount / summary.net) * 100 : 0}
                            detail={t('staff.payroll.stats.paidDetail', { count: summary.paid.count })}
                        />
                        <StatCard
                            icon={HourglassIcon}
                            tone={summary.pending.count > 0 ? 'gold' : 'success'}
                            label={t('finance.salaries.stats.pending')}
                            value={formatCurrency(summary.pending.amount, company.currency)}
                            detail={summary.pending.count > 0 ? t('staff.payroll.stats.pendingDetail', { count: summary.pending.count }) : t('staff.payroll.stats.nothingPending')}
                            href={route('salaries.index', { ...(period.value ? { period: period.value } : {}), status: ['pending'] })}
                        />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone="warning"
                            label={t('staff.payroll.stats.deductions')}
                            value={formatCurrency(summary.deductions, company.currency)}
                            detail={t('staff.payroll.stats.deductionsDetail', { additions: formatCurrency(summary.additions, company.currency) })}
                        />
                    </section>

                    <RecordList
                        routeName="salaries.index"
                        filters={filters}
                        period={period}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`staff.payroll.statuses.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            method: facets.method.map((option) => ({ ...option, label: t(`staff.paymentMethods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                        }}
                        labels={{ status: t('staff.payroll.columns.status'), method: t('staff.payroll.pay.method') }}
                        only={['salaries', 'facets', 'summary']}
                        paginator={salaries}
                        searchLabel={t('finance.salaries.searchLabel')}
                        searchPlaceholder={t('finance.salaries.searchPlaceholder')}
                        empty={<ListEmpty icon={BanknoteIcon} title={t('finance.salaries.empty.title')} description={t('finance.salaries.empty.description')} action={payrollButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={salaries.data}
                            actions={(salary) => (
                                <RowActions
                                    label={salary.staff.name}
                                    items={[
                                        { label: t('finance.salaries.actions.payroll', { month: formatMonth(salary.period) }), href: route('payroll.index', { month: salary.period }), icon: CalculatorIcon },
                                        { label: t('staff.payroll.actions.profile'), href: route('staff.show', salary.staff.id), icon: EyeIcon },
                                    ]}
                                />
                            )}
                        />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
