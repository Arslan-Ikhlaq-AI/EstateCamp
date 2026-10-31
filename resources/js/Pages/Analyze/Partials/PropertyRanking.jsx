import ChangeBadge from '@/Components/ChangeBadge';
import DataTable, { TotalsRow } from '@/Components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TableCell, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowUpRightIcon } from 'lucide-react';

/**
 * A property's share of all revenue as a short meter in the brand blue, on
 * a track of the same hue.
 */
function ShareMeter({ share }) {
    const { formatPercent } = useTranslation();

    return (
        <div className="flex items-center gap-2.5">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--chart-1)_16%,transparent)]">
                <div className="h-full rounded-full bg-(--chart-1)" style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
            </div>
            <span className="w-11 text-xs text-muted-foreground tabular-nums">{formatPercent(share)}</span>
        </div>
    );
}

/**
 * Every property side by side, highest revenue first: its share of all
 * revenue, how it moved against the period before, what it cost and what
 * it kept, with a link to its payments for the same period. Money of no
 * property and the totals close the table.
 */
export default function PropertyRanking({ properties, totals, unlinked, period, previousLabel, currency }) {
    const { t, formatCurrency, formatPercent } = useTranslation();
    const margin = (figures) => (figures.revenue > 0 ? formatPercent((figures.net / figures.revenue) * 100) : '—');
    const net = (value) => <span className={cn('font-semibold tabular-nums', value < 0 && 'text-destructive')}>{formatCurrency(value, currency)}</span>;
    const paymentsPeriod = period.value || period.default;

    const columns = [
        {
            id: 'rank',
            header: t('analyze.ranking.rank'),
            className: 'w-12',
            cell: (row) => (
                <span
                    className={cn(
                        'flex size-7 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                        row.rank === 1 && row.revenue > 0 ? 'bg-gold/20 text-gold-ink inset-ring inset-ring-gold/40' : 'bg-muted text-muted-foreground',
                    )}
                >
                    {row.rank}
                </span>
            ),
        },
        {
            id: 'property',
            header: t('analyze.ranking.property'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('properties.show', row.id)} dir="auto" className="max-w-60 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {row.name}
                    </Link>
                    <span dir="auto" className="max-w-60 truncate text-xs text-muted-foreground">
                        {[row.code, row.type].filter(Boolean).join(' · ')}
                    </span>
                </div>
            ),
        },
        { id: 'revenue', header: t('analyze.ranking.revenue'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{formatCurrency(row.revenue, currency)}</span> },
        { id: 'share', header: t('analyze.ranking.share'), cell: (row) => <ShareMeter share={totals.revenue > 0 ? (row.revenue / totals.revenue) * 100 : 0} /> },
        {
            id: 'change',
            header: t('analyze.ranking.change'),
            cell: (row) => (row.previous ? <ChangeBadge compact current={row.revenue} previous={row.previous.revenue} previousLabel={previousLabel} /> : <span className="text-muted-foreground">—</span>),
        },
        { id: 'expenses', header: t('analyze.ranking.expenses'), align: 'end', cell: (row) => <span className="tabular-nums">{formatCurrency(row.expenses, currency)}</span> },
        { id: 'net', header: t('analyze.ranking.net'), align: 'end', cell: (row) => net(row.net) },
        { id: 'margin', header: t('analyze.ranking.margin'), align: 'end', cell: (row) => <span className="text-muted-foreground tabular-nums">{margin(row)}</span> },
        {
            id: 'payments',
            header: <span className="sr-only">{t('analyze.ranking.payments')}</span>,
            align: 'end',
            cell: (row) => (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('analyze.ranking.openPayments', { name: row.name })}
                    nativeButton={false}
                    render={<Link href={route('properties.payments', { property: row.id, period: paymentsPeriod })} />}
                >
                    <ArrowUpRightIcon className="rtl:-scale-x-100" />
                </Button>
            ),
        },
    ];

    const hasUnlinked = unlinked && (unlinked.revenue !== 0 || unlinked.expenses !== 0);

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('analyze.ranking.title')}</CardTitle>
                <CardDescription>{t('analyze.ranking.description')}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <DataTable
                    columns={columns}
                    rows={properties.map((property, index) => ({ ...property, rank: index + 1 }))}
                    footer={
                        <>
                            {hasUnlinked && (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell className="ps-4 sm:ps-5 lg:ps-6" />
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{t('analyze.ranking.unlinked')}</span>
                                            <span className="text-xs text-muted-foreground">{t('analyze.ranking.unlinkedHint')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-end font-semibold tabular-nums">{formatCurrency(unlinked.revenue, currency)}</TableCell>
                                    <TableCell>
                                        <ShareMeter share={totals.revenue > 0 ? (unlinked.revenue / totals.revenue) * 100 : 0} />
                                    </TableCell>
                                    <TableCell />
                                    <TableCell className="text-end tabular-nums">{formatCurrency(unlinked.expenses, currency)}</TableCell>
                                    <TableCell className="text-end">{net(unlinked.net)}</TableCell>
                                    <TableCell />
                                    <TableCell className="pe-4 sm:pe-5 lg:pe-6" />
                                </TableRow>
                            )}
                            {properties.length > 1 && (
                                <TotalsRow
                                    columns={columns}
                                    values={{
                                        property: t('analyze.ranking.total'),
                                        revenue: formatCurrency(totals.revenue, currency),
                                        change: totals.previous ? <ChangeBadge compact current={totals.revenue} previous={totals.previous.revenue} previousLabel={previousLabel} /> : null,
                                        expenses: formatCurrency(totals.expenses, currency),
                                        net: net(totals.net),
                                        margin: margin(totals),
                                    }}
                                />
                            )}
                        </>
                    }
                />
            </CardContent>
        </Card>
    );
}
