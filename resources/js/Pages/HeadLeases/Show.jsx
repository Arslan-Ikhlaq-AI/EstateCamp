import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { InstalmentStatusBadge, LeaseStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { BanknoteIcon, CalendarClockIcon, CircleCheckIcon, PencilIcon, ReceiptIcon, RefreshCwIcon, WalletIcon } from 'lucide-react';
import { useState } from 'react';
import RecordInstalmentDialog from './Partials/RecordInstalmentDialog';

export default function Show({ lease, stats, payments, paymentStatuses, paymentMethods, currency }) {
    const { t, formatCurrency, formatMoney, formatDate, formatNumber } = useTranslation();
    const { period } = useLeasingFormat();
    const [recording, setRecording] = useState(null);
    const canRenew = ['active', 'expired'].includes(lease.status) && lease.renewal === null;

    return (
        <DashboardLayout>
            <Head title={lease.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.agreements') }, { label: t('leasing.headLeases.title'), href: route('head-leases.index') }, { label: lease.number }]}
                title={lease.number}
                badge={<LeaseStatusBadge status={lease.status} />}
                description={
                    <span>
                        <Link href={route('landlords.show', lease.landlordId)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {lease.landlordName}
                        </Link>{' '}
                        · <span dir="auto">{lease.property.name}</span> · {period(lease.startDate, lease.endDate)}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('head-leases.edit', lease.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        {canRenew && (
                            <Button nativeButton={false} render={<Link href={route('head-leases.create', { renew: lease.id })} />}>
                                <RefreshCwIcon data-icon="inline-start" />
                                {t('leasing.headLeases.renew')}
                            </Button>
                        )}
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('leasing.headLeases.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    label={t('leasing.headLeases.form.fields.annualRent')}
                    value={formatCurrency(lease.annualRent, currency)}
                    detail={t('leasing.headLeases.instalments', { count: lease.paymentsPerYear, amount: formatCurrency(lease.installmentAmount, currency) })}
                />
                <StatCard
                    icon={CircleCheckIcon}
                    tone="success"
                    label={t('leasing.headLeases.show.paid')}
                    value={formatCurrency(stats.paid, currency)}
                    detail={t('leasing.headLeases.show.paidDetail')}
                />
                <StatCard
                    icon={WalletIcon}
                    tone={stats.overdue > 0 ? 'warning' : 'primary'}
                    label={t('leasing.headLeases.stats.outstanding')}
                    value={formatCurrency(stats.outstanding, currency)}
                    detail={stats.overdue > 0 ? t('leasing.headLeases.stats.overdueDetail', { count: stats.overdue }) : t('leasing.headLeases.stats.outstandingDetail')}
                />
                <StatCard
                    icon={CalendarClockIcon}
                    label={t('leasing.headLeases.stats.next')}
                    value={stats.nextPayment ? formatMoney(stats.nextPayment.amount, currency) : '—'}
                    detail={stats.nextPayment ? formatDate(stats.nextPayment.dueDate) : t('leasing.landlords.stats.nothingDue')}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('leasing.headLeases.show.schedule')} description={t('leasing.headLeases.show.scheduleDescription')} flush>
                        <DataTable
                            rows={payments}
                            columns={[
                                { id: 'number', header: '#', cell: (payment) => <span className="tabular-nums">{formatNumber(payment.installmentNumber)}</span> },
                                { id: 'due', header: t('leasing.landlordPayments.columns.due'), cell: (payment) => <span className="tabular-nums">{formatDate(payment.dueDate)}</span> },
                                {
                                    id: 'amount',
                                    header: t('leasing.common.amount'),
                                    align: 'end',
                                    cell: (payment) => <span className="font-medium tabular-nums">{formatMoney(payment.amount, currency)}</span>,
                                },
                                {
                                    id: 'method',
                                    header: t('leasing.landlordPayments.columns.method'),
                                    cell: (payment) => (
                                        <div className="flex flex-col text-sm">
                                            <span>{t(`leasing.methods.${payment.method}`)}</span>
                                            {payment.chequeNumber && <span className="font-mono text-xs text-muted-foreground">{payment.chequeNumber}</span>}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'status',
                                    header: t('leasing.common.status'),
                                    cell: (payment) => (
                                        <div className="flex flex-col items-start gap-1">
                                            <InstalmentStatusBadge status={payment.status} isOverdue={payment.isOverdue} />
                                            {payment.paidOn && (
                                                <span className="text-xs text-muted-foreground">{t('leasing.landlordPayments.paidOn', { date: formatDate(payment.paidOn) })}</span>
                                            )}
                                        </div>
                                    ),
                                },
                            ]}
                            actions={(payment) => (
                                <Button variant="outline" size="sm" onClick={() => setRecording(payment)}>
                                    <ReceiptIcon data-icon="inline-start" />
                                    {payment.status === 'scheduled' ? t('leasing.landlordPayments.record') : t('leasing.common.edit')}
                                </Button>
                            )}
                        />
                    </SectionCard>

                    {lease.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{lease.notes}</p>
                        </SectionCard>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.headLeases.show.terms')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.common.property'), value: <span dir="auto">{`${lease.property.name} · ${lease.property.code}`}</span> },
                                { label: t('leasing.headLeases.columns.term'), value: period(lease.startDate, lease.endDate) },
                                { label: t('leasing.common.ejariNumber'), value: lease.ejariNumber },
                                { label: t('leasing.common.securityDeposit'), value: lease.securityDeposit === null ? null : formatCurrency(lease.securityDeposit, currency) },
                                {
                                    label: t('leasing.headLeases.form.fields.noticeDays'),
                                    value: lease.noticePeriodDays === null ? null : t('leasing.common.days', { count: lease.noticePeriodDays }),
                                },
                                {
                                    label: t('leasing.headLeases.show.renewedFrom'),
                                    value: lease.renewedFrom && (
                                        <Link href={route('head-leases.show', lease.renewedFrom.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {lease.renewedFrom.number}
                                        </Link>
                                    ),
                                },
                                {
                                    label: t('leasing.headLeases.show.renewedBy'),
                                    value: lease.renewal && (
                                        <Link href={route('head-leases.show', lease.renewal.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {lease.renewal.number}
                                        </Link>
                                    ),
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title={t('leasing.headLeases.show.landlord')}>
                        <DetailList
                            columns={1}
                            rows={[
                                {
                                    label: t('leasing.landlords.columns.name'),
                                    value: (
                                        <Link href={route('landlords.show', lease.landlord.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                                            {lease.landlord.name}
                                        </Link>
                                    ),
                                },
                                { label: t('leasing.landlords.form.fields.phone'), value: lease.landlord.phone },
                                { label: t('leasing.landlords.form.fields.bankName'), value: lease.landlord.bank_name },
                                { label: t('leasing.landlords.form.fields.iban'), value: lease.landlord.iban && <span className="font-mono">{lease.landlord.iban}</span> },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>

            {recording && (
                <RecordInstalmentDialog
                    key={recording.id}
                    payment={recording}
                    open
                    onOpenChange={(open) => !open && setRecording(null)}
                    statuses={paymentStatuses}
                    methods={paymentMethods}
                    currency={currency}
                />
            )}
        </DashboardLayout>
    );
}
