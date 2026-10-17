import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { InvoiceStatusBadge, PaymentStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import PostButton from '@/Components/PostButton';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { CircleCheckIcon, UndoIcon } from 'lucide-react';

export default function Show({ payment, allocations, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const isCheque = payment.method === 'cheque';
    const unallocated = Math.max(0, Math.round((payment.amount - payment.allocated) * 100) / 100);

    return (
        <DashboardLayout>
            <Head title={payment.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.payments') }, { label: t('leasing.payments.title'), href: route('payments.index') }, { label: payment.number }]}
                title={payment.number}
                badge={<PaymentStatusBadge status={payment.status} />}
                description={
                    <span>
                        <Link href={route('clients.show', payment.client.id)} className="hover:underline" dir="auto">
                            {payment.client.name}
                        </Link>{' '}
                        · {formatMoney(payment.amount, currency)} · {formatDate(payment.receivedOn)}
                    </span>
                }
                actions={
                    isCheque && (
                        <>
                            {payment.status !== 'bounced' && (
                                <PostButton variant="outline" method="patch" href={route('payments.update', payment.id)} data={{ status: 'bounced' }} icon={UndoIcon}>
                                    {t('leasing.payments.show.markBounced')}
                                </PostButton>
                            )}
                            {payment.status !== 'cleared' && (
                                <PostButton method="patch" href={route('payments.update', payment.id)} data={{ status: 'cleared' }} icon={CircleCheckIcon}>
                                    {t('leasing.payments.show.markCleared')}
                                </PostButton>
                            )}
                        </>
                    )
                }
            />

            <FlashMessages errorKeys={['status']} />

            <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="flex flex-col gap-6 xl:col-span-2">
                    <SectionCard title={t('leasing.payments.show.allocations')} description={t('leasing.payments.show.allocationsDescription')} flush>
                        {allocations.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">{t('leasing.payments.show.noAllocations')}</p>
                        ) : (
                            <DataTable
                                rows={allocations}
                                columns={[
                                    {
                                        id: 'invoice',
                                        header: t('leasing.invoices.columns.invoice'),
                                        cell: (allocation) => (
                                            <Link href={route('invoices.show', allocation.invoice.id)} className="font-medium hover:underline">
                                                {allocation.invoice.number}
                                            </Link>
                                        ),
                                    },
                                    {
                                        id: 'period',
                                        header: t('leasing.invoices.columns.period'),
                                        cell: (allocation) => <span className="text-sm">{period(allocation.invoice.periodStart, allocation.invoice.periodEnd)}</span>,
                                    },
                                    {
                                        id: 'total',
                                        header: t('leasing.invoices.columns.total'),
                                        align: 'end',
                                        cell: (allocation) => <span className="tabular-nums">{formatMoney(allocation.invoice.total, currency)}</span>,
                                    },
                                    {
                                        id: 'amount',
                                        header: t('leasing.payments.columns.allocated'),
                                        align: 'end',
                                        cell: (allocation) => <span className="font-medium tabular-nums">{formatMoney(allocation.amount, currency)}</span>,
                                    },
                                    {
                                        id: 'status',
                                        header: t('leasing.common.status'),
                                        cell: (allocation) => <InvoiceStatusBadge status={allocation.invoice.status} isOverdue={allocation.invoice.isOverdue} />,
                                    },
                                ]}
                            />
                        )}
                    </SectionCard>

                    {payment.status === 'pending' && <p className="text-sm text-muted-foreground">{t('leasing.payments.show.pendingNote')}</p>}
                    {payment.status === 'bounced' && <p className="text-sm text-destructive">{t('leasing.payments.show.bouncedNote')}</p>}
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.payments.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                {
                                    label: t('leasing.invoices.columns.client'),
                                    value: (
                                        <Link href={route('clients.show', payment.client.id)} className="hover:underline" dir="auto">
                                            {payment.client.name}
                                        </Link>
                                    ),
                                },
                                { label: t('leasing.payments.form.fields.receivedOn'), value: formatDate(payment.receivedOn) },
                                { label: t('leasing.payments.columns.method'), value: t(`leasing.methods.${payment.method}`) },
                                ...(isCheque
                                    ? [
                                          { label: t('leasing.common.chequeNumber'), value: <span className="font-mono">{payment.chequeNumber}</span> },
                                          { label: t('leasing.payments.form.fields.chequeDate'), value: payment.chequeDate && formatDate(payment.chequeDate) },
                                          { label: t('leasing.common.bank'), value: payment.bankName },
                                      ]
                                    : [{ label: t('leasing.common.reference'), value: payment.reference }]),
                                { label: t('leasing.common.amount'), value: formatMoney(payment.amount, currency) },
                                { label: t('leasing.payments.form.summary.allocated'), value: formatMoney(payment.allocated, currency) },
                                { label: t('leasing.payments.form.summary.credit'), value: formatMoney(unallocated, currency) },
                            ]}
                        />
                    </SectionCard>

                    {payment.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{payment.notes}</p>
                        </SectionCard>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
