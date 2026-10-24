import { SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    Building2Icon,
    CircleCheckIcon,
    CircleDashedIcon,
    CircleSlashIcon,
    CylinderIcon,
    FileSignatureIcon,
    HandCoinsIcon,
    PlusIcon,
    ReceiptTextIcon,
    WalletIcon,
} from 'lucide-react';
import GasBillTable, { isWholeMonth } from './Partials/GasBillTable';

const STATUS_ICONS = { issued: CircleDashedIcon, partially_paid: WalletIcon, paid: CircleCheckIcon, void: CircleSlashIcon };

/**
 * The contracts that pay for their gas and have no bill yet for the month
 * at a property they rent, each with a link to bill it.
 */
function StillToBill({ toBill, hasGasContracts }) {
    const { t } = useTranslation();
    const { name } = usePeriodLabel();
    const { period } = useLeasingFormat();
    const month = name({ kind: 'month', from: `${toBill.month}-01` });

    return (
        <SectionCard title={t('finance.gas.toBill.title', { month })} description={t('finance.gas.toBill.description')} flush={toBill.contracts.length > 0}>
            {toBill.contracts.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    {hasGasContracts && <CircleCheckIcon className="size-4 shrink-0 text-success" />}
                    {hasGasContracts ? t('finance.gas.toBill.allBilled', { month }) : t('finance.gas.toBill.noContracts')}
                </p>
            ) : (
                <ul className="flex flex-col divide-y">
                    {toBill.contracts.map((row) => (
                        <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5 lg:px-6">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--cash-gas)_12%,transparent)] text-(--cash-gas)">
                                <CylinderIcon className="size-4.5" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="flex flex-wrap items-center gap-x-2 text-sm">
                                    <Link href={route('clients.show', row.client.id)} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                        {row.client.name}
                                    </Link>
                                    <Link href={route('contracts.show', row.contract.id)} className="text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                                        {row.contract.number}
                                    </Link>
                                </span>
                                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1" dir="auto">
                                        <Building2Icon className="size-3" />
                                        {row.property.name}
                                    </span>
                                    {!isWholeMonth(row.periodStart, row.periodEnd) && <span>· {t('finance.gas.toBill.runs', { period: period(row.periodStart, row.periodEnd) })}</span>}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={<Link href={route('gas-bills.create', { contract: row.contract.id, property: row.property.id, month: toBill.month })} />}
                            >
                                <PlusIcon data-icon="inline-start" />
                                {t('finance.gas.toBill.bill')}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

/**
 * Gas bills: each month's gas charged to the clients whose contracts do
 * not include it, what is still to bill for the month, and what is owed.
 */
export default function Index({ company, filters, period, facets, summary, toBill, bills }) {
    const { t, formatCurrency, formatNumber } = useTranslation();
    const { full } = usePeriodLabel();
    const title = t('finance.gas.title');
    const range = summary ? (summary.inPeriod ? full(period) : t('finance.lists.thisMonth')) : '';
    const addButton = (
        <Button nativeButton={false} render={<Link href={route('gas-bills.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('finance.gas.add')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={bills?.total} description={t('finance.gas.description')} actions={company && addButton} />

            <FlashMessages errorKeys={['bill', 'invoice']} />

            {company === null ? (
                <NoCompany icon={CylinderIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.gas.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={ReceiptTextIcon}
                            tone="gold"
                            label={t('finance.gas.stats.billed')}
                            value={formatCurrency(summary.billed.amount, company.currency)}
                            detail={t('finance.gas.stats.billedDetail', { count: summary.billed.count, period: range })}
                        />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('finance.gas.stats.collected')}
                            value={formatCurrency(summary.collected.amount, company.currency)}
                            detail={t('finance.gas.stats.collectedDetail', { count: summary.collected.count, period: range })}
                        />
                        <StatCard
                            icon={HandCoinsIcon}
                            tone={summary.outstanding.count > 0 ? 'warning' : 'success'}
                            label={t('finance.gas.stats.outstanding')}
                            value={formatCurrency(summary.outstanding.amount, company.currency)}
                            detail={
                                summary.outstanding.count > 0
                                    ? t('finance.gas.stats.outstandingDetail', { count: summary.outstanding.count, overdue: summary.outstanding.overdue })
                                    : t('finance.gas.stats.outstandingNone')
                            }
                            href={route('gas-bills.index', { status: ['issued', 'partially_paid'] })}
                        />
                        <StatCard
                            icon={FileSignatureIcon}
                            label={t('finance.gas.stats.contracts')}
                            value={formatNumber(summary.contracts)}
                            detail={t('finance.gas.stats.contractsDetail')}
                            href={route('contracts.index', { status: ['active'], gas: ['billed'] })}
                        />
                    </section>

                    <StillToBill toBill={toBill} hasGasContracts={summary.contracts > 0 || toBill.contracts.length > 0} />

                    <RecordList
                        routeName="gas-bills.index"
                        filters={filters}
                        period={period}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.invoice.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{ status: t('leasing.common.status'), properties: t('finance.rentals.filters.properties') }}
                        only={['bills', 'facets', 'summary', 'toBill']}
                        paginator={bills}
                        searchLabel={t('finance.gas.searchLabel')}
                        searchPlaceholder={t('finance.gas.searchPlaceholder')}
                        empty={<ListEmpty icon={CylinderIcon} title={t('finance.gas.empty.title')} description={t('finance.gas.empty.description')} action={addButton} />}
                    >
                        <GasBillTable bills={bills.data} currency={company.currency} />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
