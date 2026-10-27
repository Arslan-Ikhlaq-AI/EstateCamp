import DataTable from '@/Components/DataTable';
import { METHOD_ICONS, ReceiptStatusBadge } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
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
import { BanIcon, BanknoteIcon, CircleCheckIcon, EyeIcon, HandCoinsIcon, KeyRoundIcon, PrinterIcon, ReceiptIcon, ScrollTextIcon, ShieldCheckIcon, TagIcon } from 'lucide-react';

const PURPOSE_ICONS = { rent: BanknoteIcon, deposit: ShieldCheckIcon, other: TagIcon };
const STATUS_ICONS = { cleared: CircleCheckIcon, void: BanIcon };

/**
 * Rent collections: every receipt for what short-term tenants paid, with
 * the period filter, and the tenants' cheques still waiting to clear.
 */
export default function Index({ company, filters, period, facets, summary, payments }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { period: dates } = useLeasingFormat();
    const { full } = usePeriodLabel();
    const title = t('finance.receipts.title');
    const range = summary ? (summary.inPeriod ? full(period) : t('finance.lists.thisMonth')) : '';

    const rentalsButton = (
        <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.index', { status: ['active'] })} />}>
            <KeyRoundIcon data-icon="inline-start" />
            {t('finance.receipts.openRentals')}
        </Button>
    );

    const columns = [
        {
            id: 'receipt',
            header: t('finance.receipts.columns.receipt'),
            cell: (payment) => (
                <div className="flex flex-col">
                    <Link
                        href={route('rental-payments.show', payment.id)}
                        className={cn('font-medium underline-offset-4 hover:text-brand-ink hover:underline', payment.status === 'void' && 'text-muted-foreground line-through')}
                    >
                        {payment.number}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(payment.paidOn)}</span>
                </div>
            ),
        },
        {
            id: 'tenant',
            header: t('finance.rentals.columns.tenant'),
            cell: (payment) =>
                payment.rental ? (
                    <div className="flex max-w-56 flex-col">
                        <Link href={route('rentals.show', payment.rental.id)} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {payment.rental.tenant?.name ?? payment.rental.number}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">{[payment.rental.number, payment.rental.rooms.length > 0 && t('finance.rentals.place', { count: payment.rental.rooms.length, rooms: payment.rental.rooms.join(', ') }), payment.rental.property].filter(Boolean).join(' · ')}</span>
                    </div>
                ) : (
                    '—'
                ),
        },
        {
            id: 'for',
            header: t('finance.receipts.columns.for'),
            cell: (payment) => (
                <div className="flex flex-col text-sm">
                    <span>{t(`finance.receipts.purposes.${payment.purpose}`)}</span>
                    {payment.periodStart && <span className="text-xs text-muted-foreground">{dates(payment.periodStart, payment.periodEnd)}</span>}
                </div>
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
                        {payment.reference && <span className="max-w-40 truncate font-mono text-xs text-muted-foreground">{payment.reference}</span>}
                    </div>
                );
            },
        },
        {
            id: 'amount',
            header: t('leasing.common.amount'),
            align: 'end',
            cell: (payment) => <span className={cn('font-semibold tabular-nums', payment.status === 'void' && 'text-muted-foreground line-through')}>{formatMoney(payment.amount, company.currency)}</span>,
        },
        { id: 'status', header: t('leasing.common.status'), cell: (payment) => <ReceiptStatusBadge status={payment.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={payments?.total} description={t('finance.receipts.description')} actions={company && rentalsButton} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={ReceiptIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.receipts.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={HandCoinsIcon}
                            tone="success"
                            label={t('finance.receipts.stats.collected')}
                            value={formatCurrency(summary.collected.amount, company.currency)}
                            detail={t('finance.receipts.stats.collectedDetail', { count: summary.collected.count, period: range })}
                        />
                        <StatCard icon={BanknoteIcon} label={t('finance.receipts.stats.rent')} value={formatCurrency(summary.byPurpose.rent, company.currency)} detail={range} />
                        <StatCard
                            icon={ShieldCheckIcon}
                            tone="gold"
                            label={t('finance.receipts.stats.deposits')}
                            value={formatCurrency(summary.byPurpose.deposit, company.currency)}
                            detail={summary.byPurpose.other > 0 ? t('finance.receipts.stats.other', { amount: formatCurrency(summary.byPurpose.other, company.currency) }) : range}
                        />
                        <StatCard
                            icon={ScrollTextIcon}
                            tone={summary.chequesWaiting.count > 0 ? 'warning' : 'primary'}
                            label={t('finance.receipts.stats.chequesWaiting')}
                            value={formatCurrency(summary.chequesWaiting.amount, company.currency)}
                            detail={t('finance.receipts.stats.chequesWaitingDetail', { count: summary.chequesWaiting.count })}
                            href={route('cheques.index', { direction: ['received'], stage: ['received', 'deposited'] })}
                        />
                    </section>

                    <RecordList
                        routeName="rental-payments.index"
                        filters={filters}
                        period={period}
                        facets={{
                            purpose: facets.purpose.map((option) => ({ ...option, label: t(`finance.receipts.purposes.${option.value}`), icon: PURPOSE_ICONS[option.value] })),
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`finance.receipts.status.${option.value}`), icon: STATUS_ICONS[option.value] })),
                        }}
                        labels={{ purpose: t('finance.receipts.filters.purpose'), method: t('leasing.payments.columns.method'), status: t('leasing.common.status') }}
                        only={['payments', 'facets', 'summary']}
                        paginator={payments}
                        searchLabel={t('finance.receipts.searchLabel')}
                        searchPlaceholder={t('finance.receipts.searchPlaceholder')}
                        empty={<ListEmpty icon={ReceiptIcon} title={t('finance.receipts.empty.title')} description={t('finance.receipts.empty.description')} action={rentalsButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={payments.data}
                            actions={(payment) => (
                                <RowActions
                                    label={payment.number}
                                    items={[
                                        { label: t('finance.receipts.actions.open'), href: route('rental-payments.show', payment.id), icon: PrinterIcon },
                                        ...(payment.rental ? [{ label: t('finance.receipts.actions.rental'), href: route('rentals.show', payment.rental.id), icon: EyeIcon }] : []),
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
