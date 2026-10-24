import DataTable, { TotalsRow } from '@/Components/DataTable';
import { InvoiceKindBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import { RentalStatusBadge } from '@/Components/FinanceBadges';
import ReportLayout, { Amount, Figures, ReportEmpty, ReportSection, ShareBar, useAmountFormat } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { CircleAlertIcon, HandCoinsIcon, HourglassIcon, ScrollTextIcon, TimerIcon } from 'lucide-react';

/**
 * Buckets past due shown as needing attention, and as serious.
 */
const OVERDUE = ['days_1_30', 'days_31_60', 'days_61_90', 'over_90'];
const LONG_OVERDUE = ['days_61_90', 'over_90'];

const bucketSum = (amounts, buckets) => buckets.reduce((total, bucket) => total + (amounts[bucket] ?? 0), 0);

/**
 * An aging bucket as a badge: not yet due, past due, or long past due.
 */
function BucketBadge({ bucket }) {
    const { t } = useTranslation();
    const variant = bucket === 'current' ? 'success' : LONG_OVERDUE.includes(bucket) ? 'destructive' : 'warning';

    return <Badge variant={variant}>{t(`reports.receivables.buckets.${bucket}`)}</Badge>;
}

/**
 * The receivables report, as of today: what is owed by how long it has
 * been due, by client and tenant, every open invoice and rent in arrears,
 * and the cheques held against it.
 */
export default function Receivables({ company, prepared, asOf, buckets, totals, parties, invoices, rentals, cheques }) {
    const { t, formatCurrency, formatMoney, formatNumber, formatDate, formatPercent } = useTranslation();
    const title = t('reports.receivables.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.receivables.description')} icon={HourglassIcon} company={null} />;
    }

    const currency = company.currency;
    const money = (value) => formatMoney(value, currency);
    const format = useAmountFormat();
    const amount = (value) => <Amount value={value} />;
    const inCurrency = (key) => `${t(key)} ${t('reports.common.amountsIn', { currency })}`;
    const bucketTotals = Object.fromEntries(buckets.map((bucket) => [bucket, totals.invoices[bucket] + totals.rent[bucket]]));
    const owed = bucketSum(bucketTotals, buckets);
    const overdue = bucketSum(bucketTotals, OVERDUE);
    const longOverdue = bucketSum(bucketTotals, LONG_OVERDUE);
    const bucketHeader = (bucket) => t(`reports.receivables.buckets.${bucket}`);

    const agingRows = [
        { key: 'invoices', label: t('reports.receivables.aging.invoices'), amounts: totals.invoices },
        { key: 'rent', label: t('reports.receivables.aging.rent'), amounts: totals.rent },
    ];
    const agingColumns = [
        { id: 'source', header: t('reports.receivables.aging.source'), cell: (row) => <span className="font-medium">{row.label}</span> },
        ...buckets.map((bucket) => ({ id: bucket, header: bucketHeader(bucket), align: 'end', cell: (row) => amount(row.amounts[bucket]) })),
        { id: 'total', header: t('reports.common.total'), align: 'end', cell: (row) => <Amount value={bucketSum(row.amounts, buckets)} className="font-semibold" /> },
    ];

    const partyColumns = [
        {
            id: 'party',
            header: t('reports.receivables.parties.columns.party'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col gap-1">
                    <Link href={route('clients.show', row.id)} dir="auto" className="max-w-60 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {row.name}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PartyTypeBadge type={row.type} />
                        {[row.invoices > 0 && t('reports.common.invoices', { count: row.invoices }), row.rentals > 0 && t('reports.receivables.parties.rentals', { count: row.rentals })]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </div>
            ),
        },
        ...buckets.map((bucket) => ({ id: bucket, header: bucketHeader(bucket), align: 'end', cell: (row) => amount(row.buckets[bucket]) })),
        { id: 'total', header: t('reports.common.total'), align: 'end', cell: (row) => <Amount value={row.total} className="font-semibold" /> },
        { id: 'oldest', header: t('reports.receivables.parties.columns.oldestDue'), align: 'end', cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.oldestDue)}</span> },
    ];

    const invoiceColumns = [
        {
            id: 'invoice',
            header: t('reports.receivables.invoices.columns.invoice'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                        <Link href={route('invoices.show', row.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {row.number}
                        </Link>
                        <InvoiceKindBadge kind={row.kind} />
                    </span>
                    <span dir="auto" className="max-w-56 truncate text-xs text-muted-foreground">
                        {row.client}
                    </span>
                </div>
            ),
        },
        { id: 'issued', header: t('reports.receivables.invoices.columns.issued'), cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.issueDate)}</span> },
        { id: 'due', header: t('reports.receivables.invoices.columns.due'), cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.dueDate)}</span> },
        {
            id: 'age',
            header: t('reports.receivables.invoices.columns.age'),
            cell: (row) => (
                <div className="flex flex-col items-start gap-1">
                    <BucketBadge bucket={row.bucket} />
                    {row.daysPastDue > 0 && <span className="text-xs text-muted-foreground">{t('reports.receivables.daysPastDue', { count: row.daysPastDue })}</span>}
                </div>
            ),
        },
        { id: 'total', header: t('reports.receivables.invoices.columns.total'), align: 'end', cell: (row) => amount(row.total) },
        { id: 'paid', header: t('reports.receivables.invoices.columns.paid'), align: 'end', cell: (row) => amount(row.paid) },
        { id: 'balance', header: t('reports.receivables.invoices.columns.balance'), align: 'end', cell: (row) => <Amount value={row.balance} className="font-semibold" /> },
    ];

    const rentalColumns = [
        {
            id: 'rental',
            header: t('reports.receivables.rentals.columns.rental'),
            cell: (row) => (
                <div className="flex flex-col">
                    <Link href={route('rentals.show', row.id)} dir="auto" className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {row.client}
                    </Link>
                    <span className="text-xs text-muted-foreground">{row.number}</span>
                </div>
            ),
        },
        { id: 'status', header: t('reports.receivables.rentals.columns.status'), cell: (row) => <RentalStatusBadge status={row.status} /> },
        { id: 'months', header: t('reports.receivables.rentals.columns.months'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.months)}</span> },
        {
            id: 'since',
            header: t('reports.receivables.rentals.columns.since'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="whitespace-nowrap tabular-nums">{formatDate(row.dueSince)}</span>
                    {row.daysPastDue > 0 && <span className="text-xs text-muted-foreground">{t('reports.receivables.daysPastDue', { count: row.daysPastDue })}</span>}
                </div>
            ),
        },
        { id: 'amount', header: t('reports.receivables.rentals.columns.amount'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{money(row.amount)}</span> },
    ];

    const exports = [
        {
            key: 'parties',
            label: t('reports.receivables.exports.parties'),
            name: 'receivables-aging',
            header: [t('reports.receivables.parties.columns.party'), t('reports.receivables.parties.columns.type'), ...buckets.map(bucketHeader), t('reports.common.total'), t('reports.receivables.parties.columns.oldestDue')],
            rows: () => parties.map((row) => [row.name, t(`leasing.partyTypes.${row.type}`), ...buckets.map((bucket) => row.buckets[bucket]), row.total, row.oldestDue]),
        },
        {
            key: 'invoices',
            label: t('reports.receivables.exports.invoices'),
            name: 'open-invoices',
            header: [
                t('reports.receivables.invoices.columns.invoice'),
                t('reports.receivables.parties.columns.party'),
                t('reports.receivables.invoices.columns.issued'),
                t('reports.receivables.invoices.columns.due'),
                t('reports.receivables.invoices.columns.daysPastDue'),
                t('reports.receivables.invoices.columns.total'),
                t('reports.receivables.invoices.columns.paid'),
                t('reports.receivables.invoices.columns.balance'),
            ],
            rows: () => invoices.map((row) => [row.number, row.client, row.issueDate, row.dueDate, row.daysPastDue, row.total, row.paid, row.balance]),
        },
        {
            key: 'rentals',
            label: t('reports.receivables.exports.rentals'),
            name: 'rent-arrears',
            header: [
                t('reports.receivables.rentals.columns.rental'),
                t('reports.receivables.parties.columns.party'),
                t('reports.receivables.rentals.columns.months'),
                t('reports.receivables.rentals.columns.since'),
                t('reports.receivables.invoices.columns.daysPastDue'),
                t('reports.receivables.rentals.columns.amount'),
            ],
            rows: () => rentals.map((row) => [row.number, row.client, row.months, row.dueSince, row.daysPastDue, row.amount]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.receivables.description')}
            icon={HourglassIcon}
            routeName="reports.receivables"
            company={company}
            prepared={prepared}
            asOf={asOf}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={HandCoinsIcon}
                    label={t('reports.receivables.stats.owed')}
                    value={formatCurrency(owed, currency)}
                    detail={`${t('reports.common.invoices', { count: invoices.length })} · ${t('reports.receivables.stats.tenantsBehind', { count: rentals.length })}`}
                />
                <StatCard
                    icon={TimerIcon}
                    tone={overdue > 0 ? 'warning' : 'success'}
                    label={t('reports.receivables.stats.overdue')}
                    value={formatCurrency(overdue, currency)}
                    meter={owed > 0 ? (overdue / owed) * 100 : 0}
                    detail={owed > 0 ? t('reports.receivables.stats.share', { rate: formatPercent((overdue / owed) * 100) }) : t('reports.receivables.stats.nothingOwed')}
                />
                <StatCard
                    icon={CircleAlertIcon}
                    tone={longOverdue > 0 ? 'warning' : 'success'}
                    label={t('reports.receivables.stats.longOverdue')}
                    value={formatCurrency(longOverdue, currency)}
                    detail={t('reports.receivables.stats.longOverdueDetail')}
                />
                <StatCard
                    icon={ScrollTextIcon}
                    tone="gold"
                    label={t('reports.receivables.stats.chequesHeld')}
                    value={formatCurrency(cheques.inHand.amount + cheques.toDeposit.amount, currency)}
                    detail={t('reports.common.cheques', { count: cheques.inHand.count + cheques.toDeposit.count })}
                />
            </section>

            <ReportSection title={t('reports.receivables.aging.title')} description={inCurrency('reports.receivables.aging.description')}>
                <div className="flex flex-col gap-6">
                    <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
                        {buckets.map((bucket) => (
                            <li key={bucket} className="flex flex-col gap-1.5">
                                <span className="text-[0.8125rem] text-muted-foreground">{bucketHeader(bucket)}</span>
                                <span className="font-heading text-xl font-bold tracking-tight tabular-nums">{formatCurrency(bucketTotals[bucket], currency)}</span>
                                <ShareBar value={bucketTotals[bucket]} max={owed} color={bucket === 'current' ? 'var(--cash-in)' : 'var(--cash-out)'} />
                                <span className="text-xs text-muted-foreground tabular-nums">{owed > 0 ? formatPercent((bucketTotals[bucket] / owed) * 100) : '—'}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="-mx-(--card-spacing)">
                        <DataTable
                            columns={agingColumns}
                            rows={agingRows}
                            rowKey="key"
                            footer={
                                <TotalsRow
                                    columns={agingColumns}
                                    values={{
                                        source: t('reports.common.total'),
                                        ...Object.fromEntries(buckets.map((bucket) => [bucket, format(bucketTotals[bucket])])),
                                        total: format(owed),
                                    }}
                                />
                            }
                        />
                    </div>
                </div>
            </ReportSection>

            <ReportSection title={t('reports.receivables.parties.title')} description={inCurrency('reports.receivables.parties.description')} flush={parties.length > 0}>
                {parties.length > 0 ? (
                    <DataTable
                        columns={partyColumns}
                        rows={parties}
                        footer={
                            parties.length > 1 && (
                                <TotalsRow
                                    columns={partyColumns}
                                    values={{
                                        party: t('reports.common.total'),
                                        ...Object.fromEntries(buckets.map((bucket) => [bucket, format(bucketTotals[bucket])])),
                                        total: format(owed),
                                    }}
                                />
                            )
                        }
                    />
                ) : (
                    <ReportEmpty>{t('reports.receivables.parties.empty')}</ReportEmpty>
                )}
            </ReportSection>

            <ReportSection title={t('reports.receivables.invoices.title')} description={inCurrency('reports.receivables.invoices.description')} flush={invoices.length > 0}>
                {invoices.length > 0 ? <DataTable columns={invoiceColumns} rows={invoices} /> : <ReportEmpty>{t('reports.receivables.invoices.empty')}</ReportEmpty>}
            </ReportSection>

            <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                <ReportSection title={t('reports.receivables.rentals.title')} description={t('reports.receivables.rentals.description')} flush={rentals.length > 0}>
                    {rentals.length > 0 ? <DataTable columns={rentalColumns} rows={rentals} /> : <ReportEmpty>{t('reports.receivables.rentals.empty')}</ReportEmpty>}
                </ReportSection>
                <ReportSection title={t('reports.receivables.cheques.title')} description={t('reports.receivables.cheques.description')}>
                    <Figures
                        columns={2}
                        items={[
                            { label: t('reports.receivables.cheques.inHand'), value: money(cheques.inHand.amount), detail: t('reports.common.cheques', { count: cheques.inHand.count }) },
                            { label: t('reports.receivables.cheques.toDeposit'), value: money(cheques.toDeposit.amount), detail: t('reports.common.cheques', { count: cheques.toDeposit.count }) },
                            { label: t('reports.receivables.cheques.atBank'), value: money(cheques.atBank.amount), detail: t('reports.common.cheques', { count: cheques.atBank.count }) },
                            {
                                label: t('reports.receivables.cheques.bounced'),
                                value: money(cheques.bounced.amount),
                                detail: t('reports.common.cheques', { count: cheques.bounced.count }),
                                tone: cheques.bounced.count > 0 ? 'negative' : undefined,
                            },
                        ]}
                    />
                </ReportSection>
            </div>
        </ReportLayout>
    );
}
