import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { LeaseStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    Building2Icon,
    CalendarClockIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    EyeIcon,
    FileClockIcon,
    FileSignatureIcon,
    FileXIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    WalletIcon,
} from 'lucide-react';

const STATUS_ICONS = { draft: FileClockIcon, active: CircleCheckIcon, expired: CirclePauseIcon, terminated: FileXIcon };

export default function Index({ company, filters, facets, summary, leases }) {
    const { t, formatNumber, formatCurrency, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const title = t('leasing.headLeases.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('head-leases.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('leasing.headLeases.add')}
        </Button>
    );

    const columns = [
        {
            id: 'lease',
            header: t('leasing.headLeases.columns.lease'),
            cell: (lease) => (
                <div className="flex flex-col">
                    <Link href={route('head-leases.show', lease.id)} className="font-medium hover:underline">
                        {lease.number}
                    </Link>
                    <span className="text-xs text-muted-foreground">{lease.ejariNumber ? t('leasing.common.ejari', { number: lease.ejariNumber }) : '—'}</span>
                </div>
            ),
        },
        {
            id: 'property',
            header: t('leasing.headLeases.columns.property'),
            cell: (lease) => (
                <div className="flex max-w-56 flex-col">
                    <span dir="auto" className="truncate">{lease.property.name}</span>
                    <Link href={route('landlords.show', lease.landlordId)} dir="auto" className="truncate text-xs text-muted-foreground hover:underline">
                        {lease.landlordName}
                    </Link>
                </div>
            ),
        },
        {
            id: 'term',
            header: t('leasing.headLeases.columns.term'),
            cell: (lease) => (
                <div className="flex flex-col text-sm">
                    <span>{period(lease.startDate, lease.endDate)}</span>
                    {lease.status === 'active' && (
                        <span className={lease.daysLeft <= 90 ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
                            {t('leasing.common.daysLeft', { count: lease.daysLeft })}
                        </span>
                    )}
                </div>
            ),
        },
        {
            id: 'rent',
            header: t('leasing.headLeases.columns.annualRent'),
            align: 'end',
            cell: (lease) => (
                <div className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatCurrency(lease.annualRent, company.currency)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {t('leasing.headLeases.instalments', { count: lease.paymentsPerYear, amount: formatCurrency(lease.installmentAmount, company.currency) })}
                    </span>
                </div>
            ),
        },
        {
            id: 'next',
            header: t('leasing.headLeases.columns.nextPayment'),
            cell: (lease) => <span className="text-sm tabular-nums">{lease.nextDueDate ? formatDate(lease.nextDueDate) : '—'}</span>,
        },
        { id: 'status', header: t('leasing.headLeases.columns.status'), cell: (lease) => <LeaseStatusBadge status={lease.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.agreements') }, { label: title }]}
                title={title}
                count={leases?.total}
                description={t('leasing.headLeases.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={FileSignatureIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.headLeases.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={FileSignatureIcon}
                            label={t('leasing.headLeases.stats.active')}
                            value={formatNumber(summary.activeLeases)}
                            detail={t('leasing.headLeases.stats.activeDetail')}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            label={t('leasing.headLeases.stats.annualRent')}
                            value={formatCurrency(summary.annualRent, company.currency)}
                            detail={t('leasing.headLeases.stats.annualRentDetail')}
                        />
                        <StatCard
                            icon={WalletIcon}
                            label={t('leasing.headLeases.stats.outstanding')}
                            value={formatCurrency(summary.outstanding, company.currency)}
                            detail={
                                summary.overdue > 0
                                    ? t('leasing.headLeases.stats.overdueDetail', { count: summary.overdue })
                                    : t('leasing.headLeases.stats.outstandingDetail')
                            }
                            tone={summary.overdue > 0 ? 'warning' : 'primary'}
                        />
                        <StatCard
                            icon={CalendarClockIcon}
                            label={t('leasing.headLeases.stats.next')}
                            value={summary.nextPayment ? formatCurrency(summary.nextPayment.amount, company.currency) : '—'}
                            detail={
                                summary.nextPayment
                                    ? t('leasing.headLeases.stats.nextDetail', { date: formatDate(summary.nextPayment.dueDate), lease: summary.nextPayment.leaseNumber })
                                    : t('leasing.landlords.stats.nothingDue')
                            }
                        />
                    </section>

                    <RecordList
                        routeName="head-leases.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.lease.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{ status: t('leasing.common.status'), properties: t('leasing.common.property') }}
                        only={['leases', 'facets']}
                        paginator={leases}
                        searchLabel={t('leasing.headLeases.searchLabel')}
                        searchPlaceholder={t('leasing.headLeases.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={FileSignatureIcon}
                                title={t('leasing.headLeases.empty.title')}
                                description={t('leasing.headLeases.empty.description')}
                                action={addButton}
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={leases.data}
                            actions={(lease) => (
                                <RowActions
                                    label={lease.number}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('head-leases.show', lease.id), icon: EyeIcon },
                                        { label: t('leasing.common.edit'), href: route('head-leases.edit', lease.id), icon: PencilIcon },
                                        { label: t('leasing.headLeases.renew'), href: route('head-leases.create', { renew: lease.id }), icon: RefreshCwIcon },
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
