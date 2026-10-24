import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { InvoiceKindBadge, InvoiceStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleDashedIcon,
    CircleSlashIcon,
    CylinderIcon,
    EyeIcon,
    FileSignatureIcon,
    FileTextIcon,
    ReceiptIcon,
    WalletIcon,
} from 'lucide-react';

const STATUS_ICONS = { issued: CircleDashedIcon, partially_paid: WalletIcon, paid: CircleCheckIcon, void: CircleSlashIcon };
const KIND_ICONS = { rent: FileSignatureIcon, gas: CylinderIcon };

export default function Index({ company, filters, period: listPeriod, facets, summary, invoices }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const { full } = usePeriodLabel();
    const title = t('leasing.invoices.title');

    const columns = [
        {
            id: 'invoice',
            header: t('leasing.invoices.columns.invoice'),
            cell: (invoice) => (
                <div className="flex flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                        <Link href={route('invoices.show', invoice.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {invoice.number}
                        </Link>
                        <InvoiceKindBadge kind={invoice.kind} />
                    </span>
                    <span className="text-xs text-muted-foreground">{t('leasing.invoices.issuedOn', { date: formatDate(invoice.issueDate) })}</span>
                </div>
            ),
        },
        {
            id: 'client',
            header: t('leasing.invoices.columns.client'),
            cell: (invoice) => (
                <div className="flex max-w-56 flex-col">
                    <Link href={route('clients.show', invoice.client.id)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                        {invoice.client.name}
                    </Link>
                    <Link href={route('contracts.show', invoice.contract.id)} className="text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                        {invoice.contract.number}
                    </Link>
                </div>
            ),
        },
        { id: 'period', header: t('leasing.invoices.columns.period'), cell: (invoice) => <span className="text-sm">{period(invoice.periodStart, invoice.periodEnd)}</span> },
        {
            id: 'due',
            header: t('leasing.invoices.columns.due'),
            cell: (invoice) => <span className={cn('text-sm tabular-nums', invoice.isOverdue && 'font-medium text-destructive')}>{formatDate(invoice.dueDate)}</span>,
        },
        { id: 'total', header: t('leasing.invoices.columns.total'), align: 'end', cell: (invoice) => <span className="tabular-nums">{formatMoney(invoice.total, company.currency)}</span> },
        {
            id: 'balance',
            header: t('leasing.invoices.columns.balance'),
            align: 'end',
            cell: (invoice) => (
                <span className={cn('tabular-nums', invoice.balance > 0 && 'font-medium')}>{invoice.balance > 0 ? formatMoney(invoice.balance, company.currency) : '—'}</span>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (invoice) => <InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={invoices?.total} description={t('leasing.invoices.description')} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={FileTextIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.invoices.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={WalletIcon}
                            label={t('leasing.invoices.stats.outstanding')}
                            value={formatCurrency(summary.outstanding, company.currency)}
                            detail={t('leasing.invoices.stats.outstandingDetail')}
                        />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone={summary.overdue.count > 0 ? 'warning' : 'success'}
                            label={t('leasing.invoices.stats.overdue')}
                            value={formatCurrency(summary.overdue.amount, company.currency)}
                            detail={t('leasing.invoices.stats.overdueDetail', { count: summary.overdue.count })}
                        />
                        <StatCard
                            icon={FileTextIcon}
                            label={t('leasing.invoices.stats.invoiced')}
                            value={formatCurrency(summary.invoiced, company.currency)}
                            detail={summary.inPeriod ? full(listPeriod) : t('leasing.invoices.stats.thisMonth')}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            tone="success"
                            label={t('leasing.invoices.stats.collected')}
                            value={formatCurrency(summary.collected, company.currency)}
                            detail={summary.inPeriod ? full(listPeriod) : t('leasing.invoices.stats.collectedDetail')}
                        />
                    </section>

                    <RecordList
                        routeName="invoices.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.invoice.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            kind: facets.kind.map((option) => ({ ...option, label: t(`leasing.invoices.kinds.${option.value}`), icon: KIND_ICONS[option.value] })),
                            due: facets.due.map((option) => ({ ...option, label: t('leasing.status.invoice.overdue'), icon: CircleAlertIcon })),
                        }}
                        labels={{ status: t('leasing.common.status'), kind: t('leasing.invoices.filters.kind'), due: t('leasing.invoices.filters.due') }}
                        only={['invoices', 'facets', 'summary']}
                        period={listPeriod}
                        paginator={invoices}
                        searchLabel={t('leasing.invoices.searchLabel')}
                        searchPlaceholder={t('leasing.invoices.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={FileTextIcon}
                                title={t('leasing.invoices.empty.title')}
                                description={t('leasing.invoices.empty.description')}
                                action={
                                    <Button nativeButton={false} render={<Link href={route('contracts.index')} />}>
                                        <FileSignatureIcon data-icon="inline-start" />
                                        {t('leasing.contracts.title')}
                                    </Button>
                                }
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={invoices.data}
                            actions={(invoice) => (
                                <RowActions
                                    label={invoice.number}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('invoices.show', invoice.id), icon: EyeIcon },
                                        ...(invoice.balance > 0
                                            ? [{ label: t('leasing.payments.add'), href: route('payments.create', { client: invoice.client.id, invoice: invoice.id }), icon: ReceiptIcon }]
                                            : []),
                                        { label: t('leasing.invoices.viewContract'), href: route('contracts.show', invoice.contract.id), icon: FileSignatureIcon },
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
