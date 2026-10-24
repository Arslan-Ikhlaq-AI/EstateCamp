import DataTable, { TotalsRow } from '@/Components/DataTable';
import ReportLayout, { Figures, ReportEmpty, ReportSection, ShareBar } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { DocumentStatusBadge, StaffAvatar, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { BanknoteIcon, CalendarCheckIcon, CoinsIcon, UsersRoundIcon } from 'lucide-react';

const MARKS = ['present', 'half_day', 'absent', 'leave', 'day_off'];

/**
 * The staff and payroll report: who works where and in what role, the
 * salaries for the period's months, attendance by person, and identity
 * documents to renew.
 */
export default function Staff({ company, prepared, period, summary, workplaces, roles, payroll, people, documents }) {
    const { t, formatCurrency, formatMoney, formatNumber, formatPercent, formatDate } = useTranslation();
    const { formatMonth } = useCalendarFormat();
    const { roleName, workplaceName } = useStaffNames();
    const title = t('reports.staff.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.staff.description')} icon={UsersRoundIcon} company={null} />;
    }

    const currency = company.currency;
    const money = (value) => formatMoney(value, currency);
    const rate = (value) => (value === null ? '—' : formatPercent(value));
    const count = (value) => <span className={cn('tabular-nums', value === 0 && 'text-muted-foreground')}>{formatNumber(value)}</span>;
    const sumOf = (rows, key) => rows.reduce((total, row) => total + key(row), 0);
    const attendance = summary.attendance;

    const person = (staff) => (
        <div className="flex min-w-0 items-center gap-3">
            <StaffAvatar name={staff.name} className="print:hidden" />
            <div className="flex min-w-0 flex-col">
                <Link href={route('staff.show', staff.id)} dir="auto" className="max-w-52 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                    {staff.name}
                </Link>
                <span className="max-w-52 truncate text-xs text-muted-foreground">
                    {staff.number} · {roleName(staff.role)}
                </span>
            </div>
        </div>
    );

    const workplaceColumns = [
        { id: 'workplace', header: t('reports.staff.columns.workplace'), cell: (row) => <Workplace workplace={row} link className="font-medium" /> },
        { id: 'headcount', header: t('reports.staff.columns.staff'), align: 'end', cell: (row) => count(row.headcount) },
        { id: 'payroll', header: t('reports.staff.columns.monthlyPayroll'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.payroll)}</span> },
    ];
    const roleColumns = [
        {
            id: 'role',
            header: t('reports.staff.columns.role'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium">{roleName(row)}</span>
                    <span className="text-xs text-muted-foreground">{t(`staff.levels.${row.level}`)}</span>
                </div>
            ),
        },
        { id: 'headcount', header: t('reports.staff.columns.staff'), align: 'end', cell: (row) => count(row.headcount) },
        { id: 'payroll', header: t('reports.staff.columns.monthlyPayroll'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.payroll)}</span> },
    ];
    const headcountTotals = (columns, rows) => ({
        [columns[0].id]: t('reports.common.total'),
        headcount: formatNumber(sumOf(rows, (row) => row.headcount)),
        payroll: money(sumOf(rows, (row) => row.payroll)),
    });

    const payrollColumns = [
        { id: 'month', header: t('reports.common.columns.month'), cell: (row) => <span className="font-medium whitespace-nowrap">{formatMonth(row.month)}</span> },
        { id: 'staff', header: t('reports.staff.columns.staff'), align: 'end', cell: (row) => count(row.staff) },
        { id: 'gross', header: t('reports.staff.columns.gross'), align: 'end', cell: (row) => <span className="tabular-nums">{money(row.gross)}</span> },
        { id: 'deductions', header: t('reports.staff.columns.deductions'), align: 'end', cell: (row) => <span className="tabular-nums">{money(row.deductions)}</span> },
        { id: 'additions', header: t('reports.staff.columns.additions'), align: 'end', cell: (row) => <span className="tabular-nums">{money(row.additions)}</span> },
        { id: 'net', header: t('reports.staff.columns.net'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.net)}</span> },
        { id: 'paid', header: t('reports.staff.columns.paid'), align: 'end', cell: (row) => <span className="text-success tabular-nums">{money(row.paid)}</span> },
        { id: 'pending', header: t('reports.staff.columns.pending'), align: 'end', cell: (row) => <span className={cn('tabular-nums', row.pending > 0 && 'text-warning')}>{money(row.pending)}</span> },
    ];

    const peopleColumns = [
        { id: 'person', header: t('reports.staff.columns.person'), cell: (row) => person(row) },
        { id: 'workplace', header: t('reports.staff.columns.workplace'), cell: (row) => <Workplace workplace={row.workplace} className="max-w-44" /> },
        ...MARKS.map((mark) => ({ id: mark, header: t(`staff.attendance.statuses.${mark}`), align: 'end', cell: (row) => count(row.counts[mark]) })),
        {
            id: 'rate',
            header: t('reports.staff.columns.rate'),
            className: 'w-36',
            cell: (row) =>
                row.rate === null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <div className="flex items-center gap-2">
                        <ShareBar value={row.rate} max={100} color={row.rate < 90 ? 'var(--cash-out)' : 'var(--cash-in)'} />
                        <span className="w-12 text-end text-xs font-medium tabular-nums">{rate(row.rate)}</span>
                    </div>
                ),
        },
    ];

    const documentColumns = [
        { id: 'person', header: t('reports.staff.columns.person'), cell: (row) => person(row.staff) },
        {
            id: 'document',
            header: t('reports.staff.columns.document'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium">{t(`staff.documents.${row.type}`)}</span>
                    {row.number && <span className="font-mono text-xs text-muted-foreground">{row.number}</span>}
                </div>
            ),
        },
        {
            id: 'expires',
            header: t('reports.staff.columns.expires'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="whitespace-nowrap tabular-nums">{formatDate(row.expiresOn)}</span>
                    <span className="text-xs text-muted-foreground">
                        {row.days < 0
                            ? t('reports.staff.documents.expiredAgo', { count: Math.abs(row.days) })
                            : row.days === 0
                              ? t('reports.staff.documents.today')
                              : t('reports.staff.documents.daysLeft', { count: row.days })}
                    </span>
                </div>
            ),
        },
        { id: 'status', header: t('reports.staff.columns.status'), cell: (row) => <DocumentStatusBadge days={row.days} /> },
    ];

    const exports = [
        {
            key: 'payroll',
            label: t('reports.staff.exports.payroll'),
            name: 'payroll-by-month',
            header: payrollColumns.map((column) => column.header),
            rows: () => payroll.map((row) => [row.month, row.staff, row.gross, row.deductions, row.additions, row.net, row.paid, row.pending]),
        },
        {
            key: 'attendance',
            label: t('reports.staff.exports.attendance'),
            name: 'attendance-by-person',
            header: [
                t('reports.staff.columns.number'),
                t('reports.staff.columns.person'),
                t('reports.staff.columns.role'),
                t('reports.staff.columns.workplace'),
                ...MARKS.map((mark) => t(`staff.attendance.statuses.${mark}`)),
                t('reports.staff.columns.rate'),
            ],
            rows: () => people.map((row) => [row.number, row.name, roleName(row.role), workplaceName(row.workplace), ...MARKS.map((mark) => row.counts[mark]), row.rate]),
        },
        {
            key: 'headcount',
            label: t('reports.staff.exports.headcount'),
            name: 'headcount-by-workplace',
            header: [t('reports.staff.columns.workplace'), t('reports.staff.columns.staff'), t('reports.staff.columns.monthlyPayroll')],
            rows: () => workplaces.map((row) => [workplaceName(row), row.headcount, row.payroll]),
        },
        {
            key: 'documents',
            label: t('reports.staff.exports.documents'),
            name: 'documents-to-renew',
            header: [t('reports.staff.columns.number'), t('reports.staff.columns.person'), t('reports.staff.columns.document'), t('reports.staff.columns.documentNumber'), t('reports.staff.columns.expires')],
            rows: () => documents.map((row) => [row.staff.number, row.staff.name, t(`staff.documents.${row.type}`), row.number, row.expiresOn]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.staff.description')}
            icon={UsersRoundIcon}
            routeName="reports.staff"
            company={company}
            prepared={prepared}
            period={period}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={UsersRoundIcon}
                    label={t('reports.staff.stats.headcount')}
                    value={formatNumber(summary.headcount)}
                    detail={t('reports.staff.stats.headcountDetail', { count: summary.onLeave })}
                    href={route('staff.index')}
                />
                <StatCard
                    icon={CoinsIcon}
                    tone="gold"
                    label={t('reports.staff.stats.monthlyPayroll')}
                    value={formatCurrency(summary.monthlyPayroll, currency)}
                    detail={t('reports.staff.stats.monthlyPayrollDetail')}
                />
                <StatCard
                    icon={BanknoteIcon}
                    tone={summary.pending.count > 0 ? 'warning' : 'success'}
                    label={t('reports.staff.stats.salaries')}
                    value={formatCurrency(summary.net, currency)}
                    detail={t('reports.staff.stats.salariesDetail', { paid: summary.paid.count, pending: summary.pending.count })}
                    href={route('salaries.index')}
                />
                <StatCard
                    icon={CalendarCheckIcon}
                    tone="success"
                    label={t('reports.staff.stats.attendance')}
                    value={rate(attendance.rate)}
                    meter={attendance.rate ?? 0}
                    detail={t('reports.staff.stats.attendanceDetail')}
                />
            </section>

            <ReportSection title={t('reports.staff.payroll.title')} description={t('reports.staff.payroll.description')} flush={payroll.length > 0}>
                {payroll.length > 0 ? (
                    <DataTable
                        columns={payrollColumns}
                        rows={payroll}
                        rowKey="month"
                        footer={
                            payroll.length > 1 && (
                                <TotalsRow
                                    columns={payrollColumns}
                                    values={{
                                        month: t('reports.common.total'),
                                        gross: money(sumOf(payroll, (row) => row.gross)),
                                        deductions: money(sumOf(payroll, (row) => row.deductions)),
                                        additions: money(sumOf(payroll, (row) => row.additions)),
                                        net: money(sumOf(payroll, (row) => row.net)),
                                        paid: money(sumOf(payroll, (row) => row.paid)),
                                        pending: money(sumOf(payroll, (row) => row.pending)),
                                    }}
                                />
                            )
                        }
                    />
                ) : (
                    <ReportEmpty>{t('reports.staff.payroll.empty')}</ReportEmpty>
                )}
            </ReportSection>

            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3 print:grid-cols-2">
                <ReportSection title={t('reports.staff.changes.title')} description={t('reports.staff.changes.description')}>
                    <Figures
                        columns={2}
                        items={[
                            { label: t('reports.staff.changes.joined'), value: formatNumber(summary.joined) },
                            { label: t('reports.staff.changes.left'), value: formatNumber(summary.left) },
                            { label: t('reports.staff.changes.onLeave'), value: formatNumber(summary.onLeave), detail: t('reports.staff.changes.today') },
                            {
                                label: t('reports.staff.changes.documents'),
                                value: formatNumber(documents.length),
                                detail: t('reports.staff.changes.documentsDetail'),
                                tone: documents.some((document) => document.days < 0) ? 'negative' : documents.length > 0 ? 'warning' : undefined,
                            },
                        ]}
                    />
                </ReportSection>
                <ReportSection title={t('reports.staff.workplaces.title')} description={t('reports.staff.workplaces.description')} flush>
                    <DataTable
                        columns={workplaceColumns}
                        rows={workplaces}
                        rowKey="key"
                        footer={workplaces.length > 1 && <TotalsRow columns={workplaceColumns} values={headcountTotals(workplaceColumns, workplaces)} />}
                    />
                </ReportSection>
                <ReportSection title={t('reports.staff.roles.title')} description={t('reports.staff.roles.description')} flush>
                    <DataTable columns={roleColumns} rows={roles} footer={roles.length > 1 && <TotalsRow columns={roleColumns} values={headcountTotals(roleColumns, roles)} />} />
                </ReportSection>
            </div>

            <ReportSection title={t('reports.staff.attendance.title')} description={t('reports.staff.attendance.description')} flush={people.length > 0}>
                {people.length > 0 ? (
                    <DataTable
                        columns={peopleColumns}
                        rows={people}
                        footer={
                            people.length > 1 && (
                                <TotalsRow
                                    columns={peopleColumns}
                                    values={{
                                        person: t('reports.common.total'),
                                        ...Object.fromEntries(MARKS.map((mark) => [mark, formatNumber(attendance[mark])])),
                                        rate: rate(attendance.rate),
                                    }}
                                />
                            )
                        }
                    />
                ) : (
                    <ReportEmpty>{t('reports.staff.attendance.empty')}</ReportEmpty>
                )}
            </ReportSection>

            <ReportSection title={t('reports.staff.documents.title')} description={t('reports.staff.documents.description')} flush={documents.length > 0}>
                {documents.length > 0 ? (
                    <DataTable columns={documentColumns} rows={documents.map((row) => ({ ...row, key: `${row.staff.id}-${row.type}` }))} rowKey="key" />
                ) : (
                    <ReportEmpty>{t('reports.staff.documents.empty')}</ReportEmpty>
                )}
            </ReportSection>
        </ReportLayout>
    );
}
