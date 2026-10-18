import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { InstalmentStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    Building2Icon,
    CalendarClockIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ClockIcon,
    LandmarkIcon,
    ReceiptIcon,
    UndoIcon,
    WalletIcon,
} from 'lucide-react';
import { useState } from 'react';
import RecordInstalmentDialog from '../HeadLeases/Partials/RecordInstalmentDialog';

const STATUS_ICONS = { scheduled: ClockIcon, paid: CircleCheckIcon, bounced: UndoIcon, cancelled: CircleSlashIcon };
const DUE_ICONS = { overdue: CircleAlertIcon, next_30_days: CalendarClockIcon };

export default function Index({ company, filters, facets, summary, payments, paymentStatuses, paymentMethods }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const [recording, setRecording] = useState(null);
    const title = t('leasing.landlordPayments.title');

    const columns = [
        {
            id: 'due',
            header: t('leasing.landlordPayments.columns.due'),
            cell: (payment) => (
                <div className="flex flex-col">
                    <span className="font-medium tabular-nums">{formatDate(payment.dueDate)}</span>
                    <span className="text-xs text-muted-foreground">
                        {t('leasing.landlordPayments.instalmentOf', { number: payment.installmentNumber, lease: payment.lease.number })}
                    </span>
                </div>
            ),
        },
        {
            id: 'landlord',
            header: t('leasing.landlordPayments.columns.landlord'),
            cell: (payment) => (
                <div className="flex max-w-56 flex-col">
                    <Link href={route('landlords.show', payment.landlord.id)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                        {payment.landlord.name}
                    </Link>
                    <Link href={route('head-leases.show', payment.lease.id)} dir="auto" className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                        {payment.property.name}
                    </Link>
                </div>
            ),
        },
        {
            id: 'amount',
            header: t('leasing.common.amount'),
            align: 'end',
            cell: (payment) => <span className="font-medium tabular-nums">{formatMoney(payment.amount, company.currency)}</span>,
        },
        {
            id: 'method',
            header: t('leasing.landlordPayments.columns.method'),
            cell: (payment) => (
                <div className="flex flex-col text-sm">
                    <span>{t(`leasing.methods.${payment.method}`)}</span>
                    {payment.chequeNumber && (
                        <span className="font-mono text-xs text-muted-foreground">
                            {payment.chequeNumber}
                            {payment.bankName && ` · ${payment.bankName}`}
                        </span>
                    )}
                </div>
            ),
        },
        {
            id: 'status',
            header: t('leasing.common.status'),
            cell: (payment) => (
                <div className="flex flex-col items-start gap-1">
                    <InstalmentStatusBadge status={payment.status} isOverdue={payment.isOverdue} />
                    {payment.paidOn && <span className="text-xs text-muted-foreground">{t('leasing.landlordPayments.paidOn', { date: formatDate(payment.paidOn) })}</span>}
                </div>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.payments') }, { label: title }]}
                title={title}
                count={payments?.total}
                description={t('leasing.landlordPayments.description')}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={LandmarkIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.landlordPayments.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={CalendarClockIcon}
                            label={t('leasing.landlordPayments.stats.dueSoon')}
                            value={formatCurrency(summary.dueSoon.amount, company.currency)}
                            detail={t('leasing.landlordPayments.stats.dueSoonDetail', { count: summary.dueSoon.count })}
                        />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone={summary.overdue.count > 0 ? 'warning' : 'success'}
                            label={t('leasing.landlordPayments.stats.overdue')}
                            value={formatCurrency(summary.overdue.amount, company.currency)}
                            detail={t('leasing.landlordPayments.stats.overdueDetail', { count: summary.overdue.count })}
                        />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('leasing.landlordPayments.stats.paidThisYear')}
                            value={formatCurrency(summary.paidThisYear, company.currency)}
                            detail={t('leasing.landlordPayments.stats.paidThisYearDetail')}
                        />
                        <StatCard
                            icon={WalletIcon}
                            label={t('leasing.landlordPayments.stats.remaining')}
                            value={formatCurrency(summary.remaining, company.currency)}
                            detail={t('leasing.landlordPayments.stats.remainingDetail')}
                        />
                    </section>

                    <RecordList
                        routeName="landlord-payments.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.instalment.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            due: facets.due.map((option) => ({ ...option, label: t(`leasing.landlordPayments.due.${option.value}`), icon: DUE_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{
                            status: t('leasing.common.status'),
                            due: t('leasing.landlordPayments.filters.due'),
                            properties: t('leasing.common.property'),
                        }}
                        only={['payments', 'facets']}
                        paginator={payments}
                        searchLabel={t('leasing.landlordPayments.searchLabel')}
                        searchPlaceholder={t('leasing.landlordPayments.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={LandmarkIcon}
                                title={t('leasing.landlordPayments.empty.title')}
                                description={t('leasing.landlordPayments.empty.description')}
                                action={
                                    <Button nativeButton={false} render={<Link href={route('head-leases.create')} />}>
                                        {t('leasing.headLeases.add')}
                                    </Button>
                                }
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={payments.data}
                            actions={(payment) => (
                                <Button variant="outline" size="sm" onClick={() => setRecording(payment)}>
                                    <ReceiptIcon data-icon="inline-start" />
                                    {payment.status === 'scheduled' ? t('leasing.landlordPayments.record') : t('leasing.common.edit')}
                                </Button>
                            )}
                        />
                    </RecordList>
                </>
            )}

            {recording && (
                <RecordInstalmentDialog
                    key={recording.id}
                    payment={recording}
                    open
                    onOpenChange={(open) => !open && setRecording(null)}
                    statuses={paymentStatuses}
                    methods={paymentMethods}
                    currency={company.currency}
                />
            )}
        </DashboardLayout>
    );
}
