import DataTable from '@/Components/DataTable';
import { ContractStatusBadge, LeaseStatusBadge } from '@/Components/LeasingBadges';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { FileSignatureIcon } from 'lucide-react';

/**
 * Leases and contracts ending within this many days have their days left flagged.
 */
const ENDING_SOON_DAYS = 90;

function EmptyLine({ children }) {
    return <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{children}</p>;
}

/**
 * The term, with the days left under a running one.
 */
function TermCell({ record, isRunning }) {
    const { t } = useTranslation();
    const { period } = useLeasingFormat();

    return (
        <div className="flex flex-col text-sm whitespace-nowrap">
            <span>{period(record.startDate, record.endDate)}</span>
            {isRunning && (
                <span className={record.daysLeft <= ENDING_SOON_DAYS ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                    {t('leasing.common.daysLeft', { count: record.daysLeft })}
                </span>
            )}
        </div>
    );
}

/**
 * Every client contract renting units in the property, live ones first,
 * with its client, what it rents here, how many are staying and its
 * monthly value here.
 */
export function ClientContracts({ contracts, currency }) {
    const { t, formatNumber, formatCurrency } = useTranslation();
    const { unitsSummary } = useLeasingFormat();

    if (contracts.length === 0) {
        return <EmptyLine>{t('propertyShow.contracts.empty')}</EmptyLine>;
    }

    return (
        <DataTable
            rows={contracts}
            columns={[
                {
                    id: 'number',
                    header: t('propertyShow.contracts.columns.contract'),
                    cell: (contract) => (
                        <div className="flex max-w-52 flex-col">
                            <Link href={route('contracts.show', contract.id)} className="font-medium whitespace-nowrap underline-offset-4 hover:text-brand-ink hover:underline">
                                {contract.number}
                            </Link>
                            <Link
                                href={route('clients.show', contract.client.id)}
                                dir="auto"
                                className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
                            >
                                {contract.client.name}
                            </Link>
                        </div>
                    ),
                },
                { id: 'term', header: t('leasing.contracts.columns.term'), cell: (contract) => <TermCell record={contract} isRunning={contract.status === 'active'} /> },
                {
                    id: 'units',
                    header: t('propertyShow.contracts.columns.units'),
                    cell: (contract) => (
                        <div className="flex flex-col text-sm">
                            <span>{unitsSummary(contract.units) || '—'}</span>
                            {contract.staying > 0 && <span className="text-xs text-muted-foreground">{t('leasing.holdings.staying', { count: formatNumber(contract.staying) })}</span>}
                        </div>
                    ),
                },
                {
                    id: 'monthly',
                    header: t('propertyShow.contracts.columns.monthly'),
                    align: 'end',
                    cell: (contract) => <span className="font-medium whitespace-nowrap tabular-nums">{formatCurrency(contract.monthlyValue, currency)}</span>,
                },
                { id: 'status', header: t('leasing.common.status'), cell: (contract) => <ContractStatusBadge status={contract.status} /> },
            ]}
        />
    );
}

/**
 * The head leases the property is rented under, newest first, with the
 * landlord, the rent, what has been paid and when the next cheque is due.
 * With none yet, a link to record one for the property.
 */
export function HeadLeases({ leases, currency, propertyId }) {
    const { t, formatDate, formatCurrency } = useTranslation();

    if (leases.length === 0) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 lg:px-6">
                <p className="text-sm text-muted-foreground">{t('propertyShow.leases.empty')}</p>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('head-leases.create', { property: propertyId })} />}>
                    <FileSignatureIcon data-icon="inline-start" />
                    {t('propertyShow.leases.add')}
                </Button>
            </div>
        );
    }

    return (
        <DataTable
            rows={leases}
            columns={[
                {
                    id: 'number',
                    header: t('propertyShow.leases.columns.lease'),
                    cell: (lease) => (
                        <div className="flex max-w-52 flex-col">
                            <Link href={route('head-leases.show', lease.id)} className="font-medium whitespace-nowrap underline-offset-4 hover:text-brand-ink hover:underline">
                                {lease.number}
                            </Link>
                            <Link
                                href={route('landlords.show', lease.landlordId)}
                                dir="auto"
                                className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline"
                            >
                                {lease.landlordName}
                            </Link>
                            {lease.ejariNumber && <span className="text-xs whitespace-nowrap text-muted-foreground">{t('leasing.common.ejari', { number: lease.ejariNumber })}</span>}
                        </div>
                    ),
                },
                { id: 'term', header: t('leasing.headLeases.columns.term'), cell: (lease) => <TermCell record={lease} isRunning={lease.status === 'active'} /> },
                {
                    id: 'rent',
                    header: t('leasing.headLeases.columns.annualRent'),
                    align: 'end',
                    cell: (lease) => (
                        <div className="flex flex-col items-end whitespace-nowrap">
                            <span className="font-medium tabular-nums">{formatCurrency(lease.annualRent, currency)}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {t('leasing.headLeases.instalments', { count: lease.paymentsPerYear, amount: formatCurrency(lease.installmentAmount, currency) })}
                            </span>
                        </div>
                    ),
                },
                {
                    id: 'paid',
                    header: t('propertyShow.leases.columns.paid'),
                    align: 'end',
                    cell: (lease) => (
                        <div className="flex flex-col items-end whitespace-nowrap">
                            <span className="tabular-nums">{formatCurrency(lease.paidAmount, currency)}</span>
                            {lease.nextDueDate && (
                                <span className="text-xs text-muted-foreground tabular-nums">{t('propertyShow.leases.nextDue', { date: formatDate(lease.nextDueDate) })}</span>
                            )}
                        </div>
                    ),
                },
                { id: 'status', header: t('leasing.headLeases.columns.status'), cell: (lease) => <LeaseStatusBadge status={lease.status} /> },
            ]}
        />
    );
}
