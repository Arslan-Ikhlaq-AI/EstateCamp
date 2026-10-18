import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { PaymentStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    CircleCheckIcon,
    ClockIcon,
    CreditCardIcon,
    EyeIcon,
    LandmarkIcon,
    PlusIcon,
    ReceiptIcon,
    ScrollTextIcon,
    UndoIcon,
    UserIcon,
    WalletIcon,
} from 'lucide-react';

const METHOD_ICONS = { cash: BanknoteIcon, bank_transfer: LandmarkIcon, cheque: ScrollTextIcon, card: CreditCardIcon };
const STATUS_ICONS = { pending: ClockIcon, cleared: CircleCheckIcon, bounced: UndoIcon };

export default function Index({ company, filters, facets, summary, payments }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const title = t('leasing.payments.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('payments.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('leasing.payments.add')}
        </Button>
    );

    const columns = [
        {
            id: 'payment',
            header: t('leasing.payments.columns.payment'),
            cell: (payment) => (
                <div className="flex flex-col">
                    <Link href={route('payments.show', payment.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {payment.number}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(payment.receivedOn)}</span>
                </div>
            ),
        },
        {
            id: 'client',
            header: t('leasing.invoices.columns.client'),
            cell: (payment) => (
                <Link href={route('clients.show', payment.client.id)} dir="auto" className="block max-w-56 truncate underline-offset-4 hover:text-brand-ink hover:underline">
                    {payment.client.name}
                </Link>
            ),
        },
        {
            id: 'method',
            header: t('leasing.payments.columns.method'),
            cell: (payment) => {
                const Icon = METHOD_ICONS[payment.method];

                return (
                    <div className="flex flex-col text-sm">
                        <span className="flex items-center gap-1.5">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {t(`leasing.methods.${payment.method}`)}
                        </span>
                        {payment.chequeNumber && (
                            <span className="font-mono text-xs text-muted-foreground">
                                {payment.chequeNumber}
                                {payment.chequeDate && ` · ${formatDate(payment.chequeDate)}`}
                            </span>
                        )}
                    </div>
                );
            },
        },
        { id: 'amount', header: t('leasing.common.amount'), align: 'end', cell: (payment) => <span className="font-medium tabular-nums">{formatMoney(payment.amount, company.currency)}</span> },
        {
            id: 'allocated',
            header: t('leasing.payments.columns.allocated'),
            align: 'end',
            cell: (payment) => (
                <span className={cn('tabular-nums', payment.allocated < payment.amount && 'text-warning')}>{formatMoney(payment.allocated, company.currency)}</span>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (payment) => <PaymentStatusBadge status={payment.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.payments') }, { label: title }]}
                title={title}
                count={payments?.total}
                description={t('leasing.payments.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={ReceiptIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.payments.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={BanknoteIcon}
                            tone="success"
                            label={t('leasing.payments.stats.received')}
                            value={formatCurrency(summary.receivedThisMonth, company.currency)}
                            detail={t('leasing.payments.stats.receivedDetail')}
                        />
                        <StatCard
                            icon={ClockIcon}
                            tone={summary.pending.count > 0 ? 'warning' : 'primary'}
                            label={t('leasing.payments.stats.pending')}
                            value={formatCurrency(summary.pending.amount, company.currency)}
                            detail={t('leasing.payments.stats.pendingDetail', { count: summary.pending.count })}
                        />
                        <StatCard
                            icon={UndoIcon}
                            tone={summary.bounced.count > 0 ? 'warning' : 'primary'}
                            label={t('leasing.payments.stats.bounced')}
                            value={formatCurrency(summary.bounced.amount, company.currency)}
                            detail={t('leasing.payments.stats.bouncedDetail', { count: summary.bounced.count })}
                        />
                        <StatCard
                            icon={WalletIcon}
                            label={t('leasing.payments.stats.unallocated')}
                            value={formatCurrency(summary.unallocated, company.currency)}
                            detail={t('leasing.payments.stats.unallocatedDetail')}
                        />
                    </section>

                    <RecordList
                        routeName="payments.index"
                        filters={filters}
                        facets={{
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.payment.${option.value}`), icon: STATUS_ICONS[option.value] })),
                        }}
                        labels={{ method: t('leasing.payments.columns.method'), status: t('leasing.common.status') }}
                        only={['payments', 'facets']}
                        paginator={payments}
                        searchLabel={t('leasing.payments.searchLabel')}
                        searchPlaceholder={t('leasing.payments.searchPlaceholder')}
                        empty={<ListEmpty icon={ReceiptIcon} title={t('leasing.payments.empty.title')} description={t('leasing.payments.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={payments.data}
                            actions={(payment) => (
                                <RowActions
                                    label={payment.number}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('payments.show', payment.id), icon: EyeIcon },
                                        { label: t('leasing.payments.viewClient'), href: route('clients.show', payment.client.id), icon: UserIcon },
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
