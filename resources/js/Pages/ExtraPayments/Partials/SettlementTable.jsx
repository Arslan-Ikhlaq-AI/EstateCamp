import DataTable from '@/Components/DataTable';
import { METHOD_ICONS } from '@/Components/FinanceBadges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';

/**
 * How the money was settled: the day, what it came out of, how much, who to
 * and how, latest first, with how many there are and their total.
 */
export default function SettlementTable({ settlements, currency, showKind = false }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const isCut = settlements.count > settlements.rows.length;

    const columns = [
        { id: 'date', header: t('extraPayments.history.columns.date'), cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.settledOn)}</span> },
        {
            id: 'record',
            header: t('extraPayments.history.columns.record'),
            cell: (row) => (
                <div className="flex max-w-56 flex-col">
                    <span className="font-medium tabular-nums">
                        {showKind ? `${t(`extraPayments.kinds.${row.kind}`)} · ` : ''}
                        {row.recordNumber ?? '—'}
                    </span>
                    {row.property && (
                        <Link href={route('properties.show', row.property.id)} className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                            {row.property.name}
                        </Link>
                    )}
                </div>
            ),
        },
        { id: 'paidTo', header: t('extraPayments.history.columns.paidTo'), cell: (row) => <span dir="auto">{row.paidTo ?? '—'}</span> },
        {
            id: 'how',
            header: t('extraPayments.history.columns.how'),
            cell: (row) => {
                const Icon = METHOD_ICONS[row.method];

                return (
                    <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-sm">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {t(`leasing.methods.${row.method}`)}
                        </span>
                        {row.reference && <span className="text-xs text-muted-foreground">{row.reference}</span>}
                    </div>
                );
            },
        },
        {
            id: 'notes',
            header: t('extraPayments.history.columns.notes'),
            cell: (row) => (
                <p dir="auto" className="max-w-64 truncate text-sm text-muted-foreground">
                    {row.notes ?? '—'}
                </p>
            ),
        },
        {
            id: 'amount',
            header: t('extraPayments.history.columns.amount'),
            align: 'end',
            cell: (row) => <span className="font-semibold tabular-nums">{formatMoney(row.amount, currency)}</span>,
        },
    ];

    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t('extraPayments.history.title')}</CardTitle>
                <CardDescription>
                    {t('extraPayments.history.description', { count: settlements.count, amount: formatMoney(settlements.amount, currency) })}
                    {isCut && ` ${t('extraPayments.history.latest', { count: settlements.rows.length })}`}
                </CardDescription>
            </CardHeader>
            {settlements.rows.length === 0 ? (
                <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('extraPayments.history.empty')}</CardContent>
            ) : (
                <DataTable columns={columns} rows={settlements.rows} />
            )}
        </Card>
    );
}
