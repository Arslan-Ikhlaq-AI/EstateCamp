import ChangeBadge from '@/Components/ChangeBadge';
import DataTable, { TotalsRow } from '@/Components/DataTable';
import { MaintenanceStatusBadge, PriorityBadge, useLookupNames } from '@/Components/MaintenanceBadges';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import { MonthlyAreaChart } from '@/Components/ReportCharts';
import ReportLayout, { Figures, ReportEmpty, ReportSection, ShareBar } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { useCalendarFormat } from '@/Components/StaffBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { CircleCheckIcon, ClipboardListIcon, TimerIcon, WrenchIcon } from 'lucide-react';

const BACKLOG_AGES = ['days_0_7', 'days_8_30', 'days_31_90', 'over_90'];

/**
 * The maintenance report: problems reported and fixed over a period against
 * the one before, how long fixing took, what the work cost, by kind of
 * problem, property, priority and vendor, and the work still open.
 */
export default function Maintenance({ company, prepared, period, previousPeriod, summary, previous, categories, properties, priorities, statuses, vendors, backlog, oldestOpen, trend }) {
    const { t, formatCurrency, formatMoney, formatNumber } = useTranslation();
    const { range, full } = usePeriodLabel();
    const { formatMonth } = useCalendarFormat();
    const { categoryName } = useLookupNames();
    const title = t('reports.maintenance.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.maintenance.description')} icon={WrenchIcon} company={null} />;
    }

    const currency = company.currency;
    const money = (value) => formatMoney(value, currency);
    const previousLabel = previousPeriod ? range(previousPeriod) : null;
    const change = (current, before, isGoodWhenUp = true) =>
        previous && current !== null && before !== null ? <ChangeBadge current={current} previous={before} isGoodWhenUp={isGoodWhenUp} previousLabel={previousLabel} /> : null;
    const days = (value) => (value === null ? '—' : t('reports.maintenance.days', { count: value }));
    const count = (value) => <span className={cn('tabular-nums', value === 0 && 'text-muted-foreground')}>{formatNumber(value)}</span>;
    const sumOf = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

    const breakdownColumns = (first) => [
        first,
        { id: 'reported', header: t('reports.maintenance.columns.reported'), align: 'end', cell: (row) => count(row.reported) },
        { id: 'completed', header: t('reports.maintenance.columns.completed'), align: 'end', cell: (row) => count(row.completed) },
        { id: 'open', header: t('reports.maintenance.columns.open'), align: 'end', cell: (row) => count(row.open) },
        { id: 'averageDays', header: t('reports.maintenance.columns.averageDays'), align: 'end', cell: (row) => <span className="whitespace-nowrap tabular-nums">{days(row.averageDays)}</span> },
        { id: 'cost', header: t('reports.maintenance.columns.cost'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.cost)}</span> },
    ];
    const breakdownTotals = (rows, firstId) => ({
        [firstId]: t('reports.common.total'),
        reported: formatNumber(sumOf(rows, 'reported')),
        completed: formatNumber(sumOf(rows, 'completed')),
        open: formatNumber(sumOf(rows, 'open')),
        averageDays: days(summary.averageDays),
        cost: money(sumOf(rows, 'cost')),
    });
    const categoryColumns = breakdownColumns({ id: 'category', header: t('reports.maintenance.columns.category'), cell: (row) => <span className="font-medium">{categoryName(row)}</span> });
    const propertyColumns = breakdownColumns({
        id: 'property',
        header: t('reports.common.columns.property'),
        cell: (row) => (
            <Link href={route('properties.show', row.id)} className="flex flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                <span dir="auto" className="font-medium">
                    {row.name}
                </span>
                <span className="text-xs text-muted-foreground">{row.code}</span>
            </Link>
        ),
    });

    const priorityColumns = [
        { id: 'priority', header: t('reports.maintenance.columns.priority'), cell: (row) => <PriorityBadge priority={row.priority} /> },
        { id: 'reported', header: t('reports.maintenance.columns.reported'), align: 'end', cell: (row) => count(row.reported) },
        { id: 'open', header: t('reports.maintenance.columns.openNow'), align: 'end', cell: (row) => count(row.open) },
    ];

    const vendorPeak = vendors[0]?.amount ?? 0;
    const vendorColumns = [
        {
            id: 'vendor',
            header: t('reports.maintenance.columns.vendor'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span dir="auto" className="max-w-56 truncate font-medium">
                        {row.name}
                    </span>
                    <ShareBar value={row.amount} max={vendorPeak} color="var(--cash-maintenance)" className="max-w-48" />
                </div>
            ),
        },
        { id: 'jobs', header: t('reports.maintenance.columns.jobs'), align: 'end', cell: (row) => count(row.jobs) },
        { id: 'unpaid', header: t('reports.maintenance.columns.unpaid'), align: 'end', cell: (row) => <span className={cn('tabular-nums', row.unpaid > 0 ? 'text-warning' : 'text-muted-foreground')}>{money(row.unpaid)}</span> },
        { id: 'amount', header: t('reports.maintenance.columns.cost'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.amount)}</span> },
    ];

    const oldestColumns = [
        {
            id: 'job',
            header: t('reports.maintenance.columns.job'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('maintenance.show', row.id)} dir="auto" className="max-w-64 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {row.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {row.number} · {categoryName(row.category)}
                    </span>
                </div>
            ),
        },
        {
            id: 'property',
            header: t('reports.common.columns.property'),
            cell: (row) => (
                <span dir="auto" className="block max-w-48 truncate">
                    {row.property}
                </span>
            ),
        },
        { id: 'priority', header: t('reports.maintenance.columns.priority'), cell: (row) => <PriorityBadge priority={row.priority} /> },
        { id: 'status', header: t('reports.maintenance.columns.status'), cell: (row) => <MaintenanceStatusBadge status={row.status} /> },
        {
            id: 'waiting',
            header: t('reports.maintenance.columns.waiting'),
            align: 'end',
            cell: (row) => <span className={cn('whitespace-nowrap font-semibold tabular-nums', row.days > 30 && 'text-warning')}>{days(row.days)}</span>,
        },
    ];
    const backlogTotal = BACKLOG_AGES.reduce((total, age) => total + backlog[age], 0);

    const exports = [
        {
            key: 'categories',
            label: t('reports.maintenance.exports.categories'),
            name: 'maintenance-by-kind',
            header: [
                t('reports.maintenance.columns.category'),
                t('reports.maintenance.columns.reported'),
                t('reports.maintenance.columns.completed'),
                t('reports.maintenance.columns.open'),
                t('reports.maintenance.columns.averageDays'),
                t('reports.maintenance.columns.cost'),
            ],
            rows: () => categories.map((row) => [categoryName(row), row.reported, row.completed, row.open, row.averageDays, row.cost]),
        },
        {
            key: 'properties',
            label: t('reports.maintenance.exports.properties'),
            name: 'maintenance-by-property',
            header: [
                t('reports.common.columns.property'),
                t('reports.maintenance.columns.reported'),
                t('reports.maintenance.columns.completed'),
                t('reports.maintenance.columns.open'),
                t('reports.maintenance.columns.averageDays'),
                t('reports.maintenance.columns.cost'),
            ],
            rows: () => properties.map((row) => [row.name, row.reported, row.completed, row.open, row.averageDays, row.cost]),
        },
        {
            key: 'vendors',
            label: t('reports.maintenance.exports.vendors'),
            name: 'maintenance-vendors',
            header: [t('reports.maintenance.columns.vendor'), t('reports.maintenance.columns.jobs'), t('reports.maintenance.columns.cost'), t('reports.maintenance.columns.unpaid')],
            rows: () => vendors.map((row) => [row.name, row.jobs, row.amount, row.unpaid]),
        },
        {
            key: 'trend',
            label: t('reports.maintenance.exports.trend'),
            name: 'maintenance-by-month',
            header: [t('reports.common.columns.month'), t('reports.maintenance.columns.reported'), t('reports.maintenance.columns.completed'), t('reports.maintenance.columns.cost')],
            rows: () => trend.map((row) => [row.month, row.reported, row.completed, row.cost]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.maintenance.description')}
            icon={WrenchIcon}
            routeName="reports.maintenance"
            company={company}
            prepared={prepared}
            period={period}
            comparedWith={previousLabel}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={ClipboardListIcon}
                    label={t('reports.maintenance.stats.reported')}
                    value={formatNumber(summary.reported)}
                    detail={full(period)}
                    badge={change(summary.reported, previous?.reported ?? null, false)}
                />
                <StatCard
                    icon={CircleCheckIcon}
                    tone="success"
                    label={t('reports.maintenance.stats.completed')}
                    value={formatNumber(summary.completed)}
                    detail={full(period)}
                    badge={change(summary.completed, previous?.completed ?? null)}
                />
                <StatCard
                    icon={WrenchIcon}
                    tone={summary.urgent > 0 ? 'warning' : 'primary'}
                    label={t('reports.maintenance.stats.open')}
                    value={formatNumber(summary.open)}
                    detail={t('reports.maintenance.stats.openDetail', { count: summary.urgent })}
                    href={route('maintenance.index')}
                />
                <StatCard
                    icon={TimerIcon}
                    tone="gold"
                    label={t('reports.maintenance.stats.averageDays')}
                    value={days(summary.averageDays)}
                    detail={t('reports.maintenance.stats.averageDaysDetail')}
                    badge={change(summary.averageDays, previous?.averageDays ?? null, false)}
                />
            </section>

            <div className="grid gap-4 xl:grid-cols-5">
                <ReportSection
                    title={t('reports.maintenance.trend.title')}
                    description={t('reports.maintenance.trend.description', { from: formatMonth(trend[0].month), to: formatMonth(trend[trend.length - 1].month) })}
                    className="xl:col-span-3"
                >
                    <MonthlyAreaChart
                        data={trend}
                        compactAxis={false}
                        valueFormatter={formatNumber}
                        series={[
                            { key: 'reported', label: t('reports.maintenance.columns.reported'), color: 'var(--cash-clients)', total: formatNumber(sumOf(trend, 'reported')) },
                            { key: 'completed', label: t('reports.maintenance.columns.completed'), color: 'var(--cash-rentals)', total: formatNumber(sumOf(trend, 'completed')) },
                        ]}
                    />
                </ReportSection>
                <ReportSection title={t('reports.maintenance.costs.title')} description={t('reports.maintenance.costs.description')} className="xl:col-span-2">
                    <Figures
                        columns={2}
                        items={[
                            {
                                label: t('reports.maintenance.costs.workDone'),
                                value: formatCurrency(summary.cost, currency),
                                detail: t('reports.maintenance.costs.workDoneDetail'),
                                badge: change(summary.cost, previous?.cost ?? null, false),
                            },
                            {
                                label: t('reports.maintenance.costs.paid'),
                                value: formatCurrency(summary.paid, currency),
                                detail: t('reports.maintenance.costs.paidDetail'),
                                badge: change(summary.paid, previous?.paid ?? null, false),
                            },
                            {
                                label: t('reports.maintenance.costs.unpaid'),
                                value: formatCurrency(summary.unpaid.amount, currency),
                                detail: t('reports.common.bills', { count: summary.unpaid.count }),
                                tone: summary.unpaid.count > 0 ? 'warning' : undefined,
                            },
                            {
                                label: t('reports.maintenance.costs.averageJob'),
                                value: summary.completed > 0 ? formatCurrency(summary.cost / summary.completed, currency) : '—',
                                detail: t('reports.maintenance.costs.averageJobDetail'),
                            },
                        ]}
                    />
                </ReportSection>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
                <ReportSection title={t('reports.maintenance.categories.title')} description={t('reports.maintenance.categories.description')} flush={categories.length > 0}>
                    {categories.length > 0 ? (
                        <DataTable
                            columns={categoryColumns}
                            rows={categories}
                            footer={categories.length > 1 && <TotalsRow columns={categoryColumns} values={breakdownTotals(categories, 'category')} />}
                        />
                    ) : (
                        <ReportEmpty>{t('reports.maintenance.empty')}</ReportEmpty>
                    )}
                </ReportSection>
                <ReportSection title={t('reports.maintenance.properties.title')} description={t('reports.maintenance.properties.description')} flush>
                    <DataTable
                        columns={propertyColumns}
                        rows={properties}
                        footer={properties.length > 1 && <TotalsRow columns={propertyColumns} values={breakdownTotals(properties, 'property')} />}
                    />
                </ReportSection>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
                <ReportSection title={t('reports.maintenance.priorities.title')} description={t('reports.maintenance.priorities.description')} flush>
                    <DataTable columns={priorityColumns} rows={priorities} rowKey="priority" />
                </ReportSection>
                <ReportSection title={t('reports.maintenance.statuses.title')} description={t('reports.maintenance.statuses.description')}>
                    {statuses.length > 0 ? (
                        <ul className="flex flex-col gap-3">
                            {statuses.map((status) => (
                                <li key={status.id} className="flex items-center justify-between gap-3">
                                    <MaintenanceStatusBadge status={status} />
                                    <span className="font-semibold tabular-nums">{formatNumber(status.count)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ReportEmpty>{t('reports.maintenance.empty')}</ReportEmpty>
                    )}
                </ReportSection>
                <ReportSection title={t('reports.maintenance.backlog.title')} description={t('reports.maintenance.backlog.description')}>
                    <ul className="flex flex-col gap-3">
                        {BACKLOG_AGES.map((age) => (
                            <li key={age} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2 text-sm">
                                    <span>{t(`reports.maintenance.backlog.ages.${age}`)}</span>
                                    <span className="font-semibold tabular-nums">{formatNumber(backlog[age])}</span>
                                </div>
                                <ShareBar value={backlog[age]} max={backlogTotal} color={age === 'days_0_7' ? 'var(--cash-in)' : 'var(--cash-out)'} />
                            </li>
                        ))}
                    </ul>
                </ReportSection>
            </div>

            <div className="grid gap-4 2xl:grid-cols-5">
                <ReportSection
                    title={t('reports.maintenance.oldest.title')}
                    description={t('reports.maintenance.oldest.description')}
                    className="2xl:col-span-3"
                    flush={oldestOpen.length > 0}
                >
                    {oldestOpen.length > 0 ? <DataTable columns={oldestColumns} rows={oldestOpen} /> : <ReportEmpty>{t('reports.maintenance.oldest.empty')}</ReportEmpty>}
                </ReportSection>
                <ReportSection
                    title={t('reports.maintenance.vendors.title')}
                    description={t('reports.maintenance.vendors.description')}
                    className="2xl:col-span-2"
                    flush={vendors.length > 0}
                >
                    {vendors.length > 0 ? <DataTable columns={vendorColumns} rows={vendors} rowKey="name" /> : <ReportEmpty>{t('reports.maintenance.vendors.empty')}</ReportEmpty>}
                </ReportSection>
            </div>
        </ReportLayout>
    );
}
