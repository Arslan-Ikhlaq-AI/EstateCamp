import { Link } from '@inertiajs/react';
import { agreementHref } from './ManageDialog';
import StandingBadge from './StandingBadge';

/**
 * The table columns of a commission or deposit: the record, who paid, its
 * property and agreement, the amount, what was settled and what is left.
 */
export function agreementColumns({ t, formatDate, formatMoney, currency }) {
    return [
        {
            id: 'record',
            header: t('extraPayments.columns.record'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium whitespace-nowrap tabular-nums">{row.number}</span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">{row.receivedOn ? formatDate(row.receivedOn) : t('extraPayments.notReceived')}</span>
                </div>
            ),
        },
        {
            id: 'client',
            header: t('extraPayments.columns.client'),
            cell: (row) => (
                <span dir="auto" className="block max-w-52 truncate">
                    {row.client?.name ?? '—'}
                </span>
            ),
        },
        {
            id: 'property',
            header: t('extraPayments.columns.property'),
            cell: (row) =>
                row.property ? (
                    <Link href={route('properties.show', row.property.id)} className="flex max-w-48 flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                        <span className="truncate font-medium">{row.property.name}</span>
                        <span className="text-xs text-muted-foreground">{row.property.code}</span>
                    </Link>
                ) : (
                    '—'
                ),
        },
        {
            id: 'agreement',
            header: t('extraPayments.columns.agreement'),
            cell: (row) =>
                row.agreement ? (
                    <Link href={agreementHref(row.agreement)} className="flex flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                        <span className="font-medium whitespace-nowrap tabular-nums">{row.agreement.number}</span>
                        <span className="text-xs whitespace-nowrap text-muted-foreground">{t(`extraPayments.agreements.${row.agreement.type}`)}</span>
                    </Link>
                ) : (
                    '—'
                ),
        },
        {
            id: 'amount',
            header: t('extraPayments.columns.amount'),
            align: 'end',
            cell: (row) => (
                <div className="flex flex-col items-end">
                    <span className="font-semibold whitespace-nowrap tabular-nums">{formatMoney(row.amount, currency)}</span>
                    {row.rate !== null && <span className="text-xs whitespace-nowrap text-muted-foreground">{t('extraPayments.rate', { rate: row.rate })}</span>}
                </div>
            ),
        },
        ...moneyColumns({ t, formatMoney, currency }),
    ];
}

/**
 * What was settled, what is left and where the money stands, for any kind.
 */
export function moneyColumns({ t, formatMoney, currency }) {
    return [
        {
            id: 'settled',
            header: t('extraPayments.columns.settled'),
            align: 'end',
            cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatMoney(row.settled, currency)}</span>,
        },
        {
            id: 'remaining',
            header: t('extraPayments.columns.remaining'),
            align: 'end',
            cell: (row) => <span className="font-semibold whitespace-nowrap tabular-nums">{formatMoney(row.remaining, currency)}</span>,
        },
        { id: 'standing', header: t('extraPayments.columns.standing'), cell: (row) => <StandingBadge standing={row.standing} /> },
    ];
}
