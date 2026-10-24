import DataTable, { TotalsRow } from '@/Components/DataTable';
import { PartyTypeBadge } from '@/Components/LeasingBadges';
import { MonthlyAreaChart } from '@/Components/ReportCharts';
import ReportLayout, { Figures, ReportEmpty, ReportSection, ShareBar } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { useCalendarFormat } from '@/Components/StaffBadges';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { BedDoubleIcon, BedSingleIcon, CoinsIcon, UsersRoundIcon } from 'lucide-react';

/**
 * The occupancy columns shared by the property and room type tables:
 * rooms, beds, how many are taken, free and out of service, the rate, and
 * the rent taken beds bring in against a full house.
 */
function useBedColumns(currency) {
    const { t, formatNumber, formatPercent, formatMoney } = useTranslation();
    const count = (value) => <span className="tabular-nums">{formatNumber(value)}</span>;

    return [
        { id: 'rooms', header: t('reports.common.columns.rooms'), align: 'end', cell: (row) => count(row.rooms), total: (rows) => formatNumber(rows.reduce((total, row) => total + row.rooms, 0)) },
        { id: 'beds', header: t('reports.common.columns.beds'), align: 'end', cell: (row) => count(row.beds.total), total: (rows) => formatNumber(rows.reduce((total, row) => total + row.beds.total, 0)) },
        { id: 'occupied', header: t('reports.common.columns.occupied'), align: 'end', cell: (row) => count(row.beds.occupied), total: (rows) => formatNumber(rows.reduce((total, row) => total + row.beds.occupied, 0)) },
        { id: 'free', header: t('reports.occupancy.columns.free'), align: 'end', cell: (row) => count(row.beds.available), total: (rows) => formatNumber(rows.reduce((total, row) => total + row.beds.available, 0)) },
        {
            id: 'outOfService',
            header: t('reports.occupancy.columns.outOfService'),
            align: 'end',
            cell: (row) => count(row.beds.outOfService),
            total: (rows) => formatNumber(rows.reduce((total, row) => total + row.beds.outOfService, 0)),
        },
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
        {
            id: 'rentRoll',
            header: t('reports.common.columns.rentRoll'),
            align: 'end',
            cell: (row) => <span className="tabular-nums">{formatMoney(row.rentRoll, currency)}</span>,
            total: (rows) => formatMoney(rows.reduce((total, row) => total + row.rentRoll, 0), currency),
        },
        {
            id: 'vacancyLoss',
            header: t('reports.occupancy.columns.vacancyLoss'),
            align: 'end',
            cell: (row) => <span className="text-muted-foreground tabular-nums">{formatMoney(row.potentialRent - row.rentRoll, currency)}</span>,
            total: (rows) => formatMoney(rows.reduce((total, row) => total + row.potentialRent - row.rentRoll, 0), currency),
        },
    ];
}

/**
 * The occupancy report: how full each property and kind of room is, who
 * is staying, who moved in and out over the period, a year of people
 * staying, and the rooms with beds free.
 */
export default function Occupancy({ company, prepared, period, summary, properties, roomTypes, clients, nationalities, gender, trend, vacancies }) {
    const { t, formatCurrency, formatMoney, formatNumber, formatPercent } = useTranslation();
    const { formatMonth } = useCalendarFormat();
    const bedColumns = useBedColumns(company?.currency);
    const title = t('reports.occupancy.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.occupancy.description')} icon={BedDoubleIcon} company={null} />;
    }

    const currency = company.currency;
    const beds = summary.beds;
    const rateText = (rate) => (rate === null ? '—' : formatPercent(rate));
    const totalsFor = (columns, rows, label) => ({
        ...Object.fromEntries(columns.filter((column) => column.total).map((column) => [column.id, column.total(rows)])),
        rate: rateText(beds.occupancyRate),
        [columns[0].id]: label,
    });

    const propertyColumns = [
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
        ...bedColumns,
    ];
    const typeColumns = [{ id: 'type', header: t('reports.occupancy.columns.roomType'), cell: (row) => <span className="font-medium">{row.name}</span> }, ...bedColumns.filter((column) => column.id !== 'vacancyLoss')];

    const staying = gender.male + gender.female;
    const clientColumns = [
        {
            id: 'client',
            header: t('reports.occupancy.clients.columns.client'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Link href={route('clients.show', row.id)} dir="auto" className="max-w-60 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {row.name}
                    </Link>
                    <ShareBar value={row.staying} max={clients[0]?.staying ?? 0} className="max-w-48" />
                </div>
            ),
        },
        { id: 'type', header: t('reports.occupancy.clients.columns.type'), cell: (row) => <PartyTypeBadge type={row.type} /> },
        { id: 'male', header: t('gender.male'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.male)}</span> },
        { id: 'female', header: t('gender.female'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.female)}</span> },
        { id: 'staying', header: t('reports.occupancy.clients.columns.staying'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{formatNumber(row.staying)}</span> },
        { id: 'share', header: '%', align: 'end', cell: (row) => <span className="text-muted-foreground tabular-nums">{staying > 0 ? formatPercent((row.staying / staying) * 100) : '—'}</span> },
    ];

    const vacancyColumns = [
        {
            id: 'room',
            header: t('reports.occupancy.vacancies.columns.room'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium">{t('reports.occupancy.vacancies.room', { number: row.number })}</span>
                    <span dir="auto" className="text-xs text-muted-foreground">
                        {row.property}
                    </span>
                </div>
            ),
        },
        { id: 'type', header: t('reports.occupancy.columns.roomType'), cell: (row) => row.type },
        { id: 'gender', header: t('reports.occupancy.vacancies.columns.gender'), cell: (row) => (row.genderPolicy ? t(`gender.${row.genderPolicy}`) : '—') },
        {
            id: 'beds',
            header: t('reports.occupancy.vacancies.columns.taken'),
            align: 'end',
            cell: (row) => <span className="tabular-nums">{t('reports.occupancy.vacancies.taken', { occupied: row.occupied, capacity: row.capacity })}</span>,
        },
        { id: 'free', header: t('reports.occupancy.columns.free'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{formatNumber(row.free)}</span> },
        {
            id: 'rent',
            header: t('reports.occupancy.vacancies.columns.rent'),
            align: 'end',
            cell: (row) => <span className="tabular-nums">{row.rentPerBed === null ? '—' : formatMoney(row.rentPerBed, currency)}</span>,
        },
        {
            id: 'income',
            header: t('reports.occupancy.vacancies.columns.income'),
            align: 'end',
            cell: (row) => <span className="tabular-nums">{row.rentPerBed === null ? '—' : formatMoney(row.rentPerBed * row.free, currency)}</span>,
        },
    ];
    const nationalityPeak = Math.max(...nationalities.map((row) => row.count), 1);
    const nationalityName = (row) => (row.group === 'named' ? row.nationality : t(`reports.occupancy.nationalities.${row.group}`));

    const exports = [
        {
            key: 'properties',
            label: t('reports.occupancy.exports.properties'),
            name: 'occupancy-by-property',
            header: [
                t('reports.common.columns.property'),
                t('reports.common.columns.code'),
                t('reports.common.columns.rooms'),
                t('reports.common.columns.beds'),
                t('reports.common.columns.occupied'),
                t('reports.occupancy.columns.free'),
                t('reports.occupancy.columns.outOfService'),
                t('reports.common.columns.occupancyPercent'),
                t('reports.common.columns.rentRoll'),
                t('reports.occupancy.columns.potentialRent'),
            ],
            rows: () =>
                properties.map((row) => [row.name, row.code, row.rooms, row.beds.total, row.beds.occupied, row.beds.available, row.beds.outOfService, row.beds.occupancyRate, row.rentRoll, row.potentialRent]),
        },
        {
            key: 'clients',
            label: t('reports.occupancy.exports.clients'),
            name: 'who-is-staying',
            header: [t('reports.occupancy.clients.columns.client'), t('reports.occupancy.clients.columns.type'), t('gender.male'), t('gender.female'), t('reports.occupancy.clients.columns.staying')],
            rows: () => clients.map((row) => [row.name, t(`leasing.partyTypes.${row.type}`), row.male, row.female, row.staying]),
        },
        {
            key: 'vacancies',
            label: t('reports.occupancy.exports.vacancies'),
            name: 'rooms-with-free-beds',
            header: [
                t('reports.common.columns.property'),
                t('reports.occupancy.vacancies.columns.room'),
                t('reports.occupancy.columns.roomType'),
                t('reports.occupancy.vacancies.columns.gender'),
                t('reports.common.columns.beds'),
                t('reports.common.columns.occupied'),
                t('reports.occupancy.columns.free'),
                t('reports.occupancy.vacancies.columns.rent'),
            ],
            rows: () => vacancies.map((row) => [row.property, row.number, row.type, row.genderPolicy ? t(`gender.${row.genderPolicy}`) : '', row.capacity, row.occupied, row.free, row.rentPerBed]),
        },
        {
            key: 'trend',
            label: t('reports.occupancy.exports.trend'),
            name: 'people-staying-by-month',
            header: [t('reports.common.columns.month'), t('reports.occupancy.trend.staying')],
            rows: () => trend.map((row) => [row.month, row.staying]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.occupancy.description')}
            icon={BedDoubleIcon}
            routeName="reports.occupancy"
            company={company}
            prepared={prepared}
            period={period}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={BedDoubleIcon}
                    label={t('reports.occupancy.stats.rate')}
                    value={rateText(beds.occupancyRate)}
                    meter={beds.occupancyRate ?? 0}
                    detail={t('reports.occupancy.stats.rateDetail', { occupied: beds.occupied, total: beds.occupied + beds.available })}
                />
                <StatCard
                    icon={UsersRoundIcon}
                    label={t('reports.occupancy.stats.staying')}
                    value={formatNumber(summary.staying)}
                    detail={t('reports.occupancy.stats.stayingDetail', { male: gender.male, female: gender.female })}
                />
                <StatCard
                    icon={BedSingleIcon}
                    tone={beds.available > 0 ? 'gold' : 'success'}
                    label={t('reports.occupancy.stats.free')}
                    value={formatNumber(beds.available)}
                    detail={t('reports.occupancy.stats.freeDetail', { count: beds.outOfService })}
                />
                <StatCard
                    icon={CoinsIcon}
                    label={t('reports.occupancy.stats.rentRoll')}
                    value={formatCurrency(summary.rentRoll, currency)}
                    detail={t('reports.occupancy.stats.rentRollDetail', { amount: formatCurrency(summary.potentialRent - summary.rentRoll, currency) })}
                />
            </section>

            <ReportSection title={t('reports.occupancy.properties.title')} description={t('reports.occupancy.properties.description')} flush>
                <DataTable
                    columns={propertyColumns}
                    rows={properties}
                    footer={properties.length > 1 && <TotalsRow columns={propertyColumns} values={totalsFor(propertyColumns, properties, t('reports.common.total'))} />}
                />
            </ReportSection>

            <div className="grid gap-4 xl:grid-cols-5">
                <ReportSection
                    title={t('reports.occupancy.trend.title')}
                    description={t('reports.occupancy.trend.description', { from: formatMonth(trend[0].month), to: formatMonth(trend[trend.length - 1].month) })}
                    className="xl:col-span-3"
                >
                    <MonthlyAreaChart
                        data={trend}
                        compactAxis={false}
                        className="h-56"
                        series={[{ key: 'staying', label: t('reports.occupancy.trend.staying'), color: 'var(--chart-1)' }]}
                    />
                </ReportSection>
                <ReportSection title={t('reports.occupancy.movements.title')} description={t('reports.occupancy.movements.description')} className="xl:col-span-2">
                    <Figures
                        columns={2}
                        items={[
                            { label: t('reports.occupancy.movements.checkIns'), value: formatNumber(summary.checkIns) },
                            { label: t('reports.occupancy.movements.checkOuts'), value: formatNumber(summary.checkOuts) },
                            {
                                label: t('reports.occupancy.movements.net'),
                                value: `${summary.checkIns - summary.checkOuts > 0 ? '+' : ''}${formatNumber(summary.checkIns - summary.checkOuts)}`,
                                tone: summary.checkIns - summary.checkOuts < 0 ? 'warning' : undefined,
                            },
                            { label: t('reports.occupancy.movements.stayingNow'), value: formatNumber(summary.staying) },
                        ]}
                    />
                </ReportSection>
            </div>

            <ReportSection title={t('reports.occupancy.roomTypes.title')} description={t('reports.occupancy.roomTypes.description')} flush>
                <DataTable columns={typeColumns} rows={roomTypes} rowKey="slug" />
            </ReportSection>

            <div className="grid gap-4 xl:grid-cols-5">
                <ReportSection title={t('reports.occupancy.clients.title')} description={t('reports.occupancy.clients.description')} className="xl:col-span-3" flush={clients.length > 0}>
                    {clients.length > 0 ? <DataTable columns={clientColumns} rows={clients} /> : <ReportEmpty>{t('reports.occupancy.clients.empty')}</ReportEmpty>}
                </ReportSection>
                <ReportSection title={t('reports.occupancy.nationalities.title')} description={t('reports.occupancy.nationalities.description')} className="xl:col-span-2">
                    {nationalities.length > 0 ? (
                        <div className="flex flex-col gap-6">
                            <ul className="flex flex-col gap-3">
                                {nationalities.map((row) => (
                                    <li key={`${row.group}-${row.nationality}`} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span dir="auto" className="flex-1 truncate">
                                                {nationalityName(row)}
                                            </span>
                                            <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                                            <span className="w-12 text-end text-xs text-muted-foreground tabular-nums">{staying > 0 ? formatPercent((row.count / staying) * 100) : '—'}</span>
                                        </div>
                                        <ShareBar value={row.count} max={nationalityPeak} color="var(--chart-1)" />
                                    </li>
                                ))}
                            </ul>
                            <Figures
                                columns={2}
                                items={[
                                    { label: t('gender.male'), value: formatNumber(gender.male), detail: staying > 0 ? formatPercent((gender.male / staying) * 100) : null },
                                    { label: t('gender.female'), value: formatNumber(gender.female), detail: staying > 0 ? formatPercent((gender.female / staying) * 100) : null },
                                ]}
                            />
                        </div>
                    ) : (
                        <ReportEmpty>{t('reports.occupancy.clients.empty')}</ReportEmpty>
                    )}
                </ReportSection>
            </div>

            <ReportSection title={t('reports.occupancy.vacancies.title')} description={t('reports.occupancy.vacancies.description')} flush={vacancies.length > 0}>
                {vacancies.length > 0 ? (
                    <DataTable
                        columns={vacancyColumns}
                        rows={vacancies}
                        footer={
                            vacancies.length > 1 && (
                                <TotalsRow
                                    columns={vacancyColumns}
                                    values={{
                                        room: t('reports.common.total'),
                                        free: formatNumber(vacancies.reduce((total, row) => total + row.free, 0)),
                                        income: formatMoney(
                                            vacancies.reduce((total, row) => total + (row.rentPerBed ?? 0) * row.free, 0),
                                            currency,
                                        ),
                                    }}
                                />
                            )
                        }
                    />
                ) : (
                    <ReportEmpty>{t('reports.occupancy.vacancies.empty')}</ReportEmpty>
                )}
            </ReportSection>
        </ReportLayout>
    );
}
