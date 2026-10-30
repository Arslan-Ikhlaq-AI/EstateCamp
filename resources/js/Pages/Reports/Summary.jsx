import ChangeBadge from '@/Components/ChangeBadge';
import DataTable, { TotalsRow } from '@/Components/DataTable';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import ReportLayout, { Figures, ReportSection, ShareBar } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { ArrowDownLeftIcon, ArrowUpRightIcon, BedDoubleIcon, PresentationIcon, ScaleIcon } from 'lucide-react';

const IN = ['client_payment', 'rental_payment', 'extra_income'];
const OUT = ['landlord_rent', 'maintenance', 'salary', 'maintenance_contract', 'deposit_refund', 'other_payment'];

const sum = (totals, categories) => categories.reduce((total, category) => total + (totals?.[category]?.amount ?? 0), 0);

/**
 * The company summary: everything at a glance for a period against the one
 * before it, then each property side by side.
 */
export default function Summary({ company, prepared, period, previousPeriod, canSeeStaff, cash, previousCash, occupancy, tenancy, billing, cheques, maintenance, staff, properties }) {
    const { t, formatCurrency, formatMoney, formatNumber, formatPercent } = useTranslation();
    const { range, full } = usePeriodLabel();
    const title = t('reports.summary.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.summary.description')} icon={PresentationIcon} company={null} />;
    }

    const money = (value) => formatCurrency(value, company.currency);
    const previousLabel = previousPeriod ? range(previousPeriod) : null;
    const change = (current, previous, isGoodWhenUp = true) => <ChangeBadge current={current} previous={previous} isGoodWhenUp={isGoodWhenUp} previousLabel={previousLabel} />;
    const outCategories = OUT.filter((category) => canSeeStaff || category !== 'salary');
    const moneyIn = sum(cash, IN);
    const moneyOut = sum(cash, outCategories);
    const net = moneyIn - moneyOut;
    const beds = occupancy.beds;
    const receivables = billing.receivables;

    const sections = [
        {
            key: 'cash',
            items: [
                ...[...IN, ...outCategories].map((category) => ({
                    label: t(`finance.categories.${category}`),
                    value: money(cash[category].amount),
                    detail: t('reports.common.payments', { count: cash[category].count }),
                    badge: previousCash && change(cash[category].amount, previousCash[category].amount, IN.includes(category)),
                })),
            ],
        },
        {
            key: 'billing',
            items: [
                { label: t('reports.summary.figures.invoiced'), value: money(billing.invoiced.amount), detail: t('reports.common.invoices', { count: billing.invoiced.count }) },
                { label: t('reports.summary.figures.owedToday'), value: money(receivables.total), detail: t('reports.summary.figures.owedTodayDetail') },
                {
                    label: t('reports.summary.figures.overdueInvoices'),
                    value: money(receivables.overdue.amount),
                    detail: t('reports.common.invoices', { count: receivables.overdue.count }),
                    tone: receivables.overdue.count > 0 ? 'warning' : undefined,
                },
                {
                    label: t('reports.summary.figures.rentOwed'),
                    value: money(receivables.rent.amount),
                    detail: t('reports.common.tenants', { count: receivables.rent.count }),
                    tone: receivables.rent.count > 0 ? 'warning' : undefined,
                },
            ],
        },
        {
            key: 'occupancy',
            items: [
                { label: t('reports.summary.figures.properties'), value: formatNumber(occupancy.properties), detail: t('common.rooms', { count: occupancy.rooms }) },
                { label: t('reports.summary.figures.beds'), value: formatNumber(beds.total), detail: t('reports.summary.figures.bedsDetail', { available: beds.available, outOfService: beds.outOfService }) },
                { label: t('reports.summary.figures.occupied'), value: formatNumber(beds.occupied), detail: beds.occupancyRate === null ? null : t('reports.summary.figures.occupiedDetail', { rate: formatPercent(beds.occupancyRate) }) },
                { label: t('reports.summary.figures.rentRoll'), value: money(occupancy.rentRoll), detail: t('reports.summary.figures.rentRollDetail', { amount: money(occupancy.potentialRent) }) },
                { label: t('reports.summary.figures.vacancyLoss'), value: money(occupancy.potentialRent - occupancy.rentRoll), detail: t('reports.summary.figures.vacancyLossDetail') },
                { label: t('reports.summary.figures.checkIns'), value: formatNumber(occupancy.checkIns), detail: t('reports.common.inPeriod') },
                { label: t('reports.summary.figures.checkOuts'), value: formatNumber(occupancy.checkOuts), detail: t('reports.common.inPeriod') },
            ],
        },
        {
            key: 'tenancy',
            items: [
                { label: t('reports.summary.figures.clients'), value: formatNumber(tenancy.clients), detail: t('reports.summary.figures.clientsDetail') },
                { label: t('reports.summary.figures.contracts'), value: formatNumber(tenancy.contracts), detail: t('reports.summary.figures.contractsDetail', { count: tenancy.signed }) },
                { label: t('reports.summary.figures.contractValue'), value: money(tenancy.contractValue), detail: t('reports.common.perMonth') },
                {
                    label: t('reports.summary.figures.endingSoon'),
                    value: formatNumber(tenancy.endingSoon),
                    detail: t('reports.summary.figures.endingSoonDetail'),
                    tone: tenancy.endingSoon > 0 ? 'warning' : undefined,
                },
                { label: t('reports.summary.figures.rentals'), value: formatNumber(tenancy.rentals), detail: t('reports.summary.figures.rentalsDetail', { amount: money(tenancy.rentalValue) }) },
            ],
        },
        {
            key: 'cheques',
            items: [
                { label: t('reports.summary.figures.chequesCleared'), value: money(cheques.cleared.amount), detail: t('reports.common.cheques', { count: cheques.cleared.count }) },
                { label: t('reports.summary.figures.chequesPaid'), value: money(cheques.paid.amount), detail: t('reports.common.cheques', { count: cheques.paid.count }) },
                {
                    label: t('reports.summary.figures.chequesBounced'),
                    value: money(cheques.bounced.amount),
                    detail: t('reports.common.cheques', { count: cheques.bounced.count }),
                    tone: cheques.bounced.count > 0 ? 'negative' : undefined,
                },
                { label: t('reports.summary.figures.chequesHeld'), value: money(cheques.held.amount), detail: t('reports.summary.figures.chequesHeldDetail', { count: cheques.held.count }) },
                { label: t('reports.summary.figures.chequesDue'), value: money(cheques.dueToPay.amount), detail: t('reports.summary.figures.chequesDueDetail', { count: cheques.dueToPay.count }) },
            ],
        },
        {
            key: 'maintenance',
            items: [
                { label: t('reports.summary.figures.jobsReported'), value: formatNumber(maintenance.reported), detail: t('reports.common.inPeriod') },
                { label: t('reports.summary.figures.jobsCompleted'), value: formatNumber(maintenance.completed), detail: t('reports.common.inPeriod') },
                {
                    label: t('reports.summary.figures.jobsOpen'),
                    value: formatNumber(maintenance.open),
                    detail: t('reports.summary.figures.jobsOpenDetail', { count: maintenance.urgent }),
                    tone: maintenance.urgent > 0 ? 'warning' : undefined,
                },
                { label: t('reports.summary.figures.billsUnpaid'), value: money(maintenance.unpaid.amount), detail: t('reports.common.bills', { count: maintenance.unpaid.count }) },
            ],
        },
        ...(staff
            ? [
                  {
                      key: 'staff',
                      items: [
                          { label: t('reports.summary.figures.headcount'), value: formatNumber(staff.headcount), detail: t('reports.summary.figures.headcountDetail', { count: staff.onLeave }) },
                          { label: t('reports.summary.figures.joinedLeft'), value: `${formatNumber(staff.joined)} / ${formatNumber(staff.left)}`, detail: t('reports.common.inPeriod') },
                          { label: t('reports.summary.figures.monthlyPayroll'), value: money(staff.monthlyPayroll), detail: t('reports.summary.figures.monthlyPayrollDetail') },
                          { label: t('reports.summary.figures.salaries'), value: money(staff.net), detail: t('reports.summary.figures.salariesDetail', { amount: money(staff.pending.amount) }) },
                          {
                              label: t('reports.summary.figures.attendance'),
                              value: staff.attendanceRate === null ? '—' : formatPercent(staff.attendanceRate),
                              detail: t('reports.summary.figures.attendanceDetail'),
                          },
                      ],
                  },
              ]
            : []),
    ];

    const columns = [
        {
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
        },
        { id: 'rooms', header: t('reports.common.columns.rooms'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.rooms)}</span> },
        { id: 'beds', header: t('reports.common.columns.beds'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.beds.total)}</span> },
        { id: 'occupied', header: t('reports.common.columns.occupied'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.beds.occupied)}</span> },
        {
            id: 'rate',
            header: t('reports.common.columns.occupancy'),
            className: 'w-40',
            cell: (row) =>
                row.beds.occupancyRate === null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <div className="flex items-center gap-2">
                        <ShareBar value={row.beds.occupancyRate} max={100} />
                        <span className="w-12 text-end text-xs font-medium tabular-nums">{formatPercent(row.beds.occupancyRate)}</span>
                    </div>
                ),
        },
        { id: 'rentRoll', header: t('reports.common.columns.rentRoll'), align: 'end', cell: (row) => <span className="tabular-nums">{formatMoney(row.rentRoll, company.currency)}</span> },
        { id: 'openJobs', header: t('reports.common.columns.openJobs'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.openJobs)}</span> },
        {
            id: 'maintenanceSpend',
            header: t('reports.common.columns.maintenancePaid'),
            align: 'end',
            cell: (row) => <span className="tabular-nums">{formatMoney(row.maintenanceSpend, company.currency)}</span>,
        },
    ];
    const totalOf = (key) => properties.reduce((total, row) => total + key(row), 0);

    const exports = [
        {
            key: 'figures',
            label: t('reports.summary.exports.figures'),
            name: 'company-summary',
            header: [t('reports.common.columns.section'), t('reports.common.columns.figure'), t('reports.common.columns.value'), t('reports.common.columns.detail')],
            rows: () => sections.flatMap((section) => section.items.map((item) => [t(`reports.summary.sections.${section.key}.title`), item.label, item.value, item.detail ?? ''])),
        },
        {
            key: 'properties',
            label: t('reports.summary.exports.properties'),
            name: 'properties-at-a-glance',
            header: [
                t('reports.common.columns.property'),
                t('reports.common.columns.code'),
                t('reports.common.columns.rooms'),
                t('reports.common.columns.beds'),
                t('reports.common.columns.occupied'),
                t('reports.common.columns.occupancyPercent'),
                t('reports.common.columns.rentRoll'),
                t('reports.common.columns.openJobs'),
                t('reports.common.columns.maintenancePaid'),
            ],
            rows: () => properties.map((row) => [row.name, row.code, row.rooms, row.beds.total, row.beds.occupied, row.beds.occupancyRate, row.rentRoll, row.openJobs, row.maintenanceSpend]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.summary.description')}
            icon={PresentationIcon}
            routeName="reports.summary"
            company={company}
            prepared={prepared}
            period={period}
            comparedWith={previousLabel}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={ArrowDownLeftIcon}
                    label={t('reports.summary.stats.moneyIn')}
                    value={money(moneyIn)}
                    detail={full(period)}
                    badge={previousCash && change(moneyIn, sum(previousCash, IN))}
                />
                <StatCard
                    icon={ArrowUpRightIcon}
                    tone="gold"
                    label={t('reports.summary.stats.moneyOut')}
                    value={money(moneyOut)}
                    detail={full(period)}
                    badge={previousCash && change(moneyOut, sum(previousCash, outCategories), false)}
                />
                <StatCard
                    icon={ScaleIcon}
                    tone={net < 0 ? 'warning' : 'success'}
                    label={t('reports.summary.stats.net')}
                    value={money(net)}
                    detail={net < 0 ? t('reports.summary.stats.netNegative') : t('reports.summary.stats.netPositive')}
                />
                <StatCard
                    icon={BedDoubleIcon}
                    label={t('reports.summary.stats.occupancy')}
                    value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                    meter={beds.occupancyRate ?? 0}
                    detail={t('reports.summary.stats.occupancyDetail', { occupied: beds.occupied, total: beds.occupied + beds.available })}
                />
            </section>

            <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                {sections.map((section) => (
                    <ReportSection
                        key={section.key}
                        title={t(`reports.summary.sections.${section.key}.title`)}
                        description={t(`reports.summary.sections.${section.key}.description`)}
                        className={section.key === 'cash' ? 'lg:col-span-2 print:col-span-2' : undefined}
                    >
                        <Figures items={section.items} columns={section.key === 'cash' ? 3 : 2} />
                    </ReportSection>
                ))}
            </div>

            <ReportSection title={t('reports.summary.sections.properties.title')} description={t('reports.summary.sections.properties.description')} flush>
                <DataTable
                    columns={columns}
                    rows={properties}
                    footer={
                        properties.length > 1 && (
                            <TotalsRow
                                columns={columns}
                                values={{
                                    property: t('reports.common.total'),
                                    rooms: formatNumber(totalOf((row) => row.rooms)),
                                    beds: formatNumber(totalOf((row) => row.beds.total)),
                                    occupied: formatNumber(beds.occupied),
                                    rate: beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate),
                                    rentRoll: formatMoney(occupancy.rentRoll, company.currency),
                                    openJobs: formatNumber(maintenance.open),
                                    maintenanceSpend: formatMoney(totalOf((row) => row.maintenanceSpend), company.currency),
                                }}
                            />
                        )
                    }
                />
            </ReportSection>
        </ReportLayout>
    );
}
