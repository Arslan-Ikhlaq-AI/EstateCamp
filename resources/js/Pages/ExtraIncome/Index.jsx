import DataTable from '@/Components/DataTable';
import { ExtraIncomeStatusBadge, METHOD_ICONS } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { BadgePercentIcon, BanIcon, BanknoteIcon, CircleCheckIcon, LandmarkIcon, PlusIcon, ScrollTextIcon } from 'lucide-react';
import ExtraIncomeActions from './Partials/ExtraIncomeActions';

const STATUS_ICONS = { received: CircleCheckIcon, cancelled: BanIcon };

/**
 * Extra income: what the properties earn besides rent, such as a
 * provider's share for internet, gas or washing machines, with the period
 * filter and what came in by each way of paying.
 */
export default function Index({ company, filters, period, facets, summary, incomes }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { full } = usePeriodLabel();
    const title = t('finance.extraIncome.title');
    const range = summary ? (summary.inPeriod ? full(period) : t('finance.lists.thisMonth')) : '';

    const addButton = (
        <Button variant="brand" nativeButton={false} render={<Link href={route('extra-incomes.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('finance.extraIncome.add')}
        </Button>
    );

    const columns = [
        {
            id: 'income',
            header: t('finance.extraIncome.columns.income'),
            cell: (income) => (
                <div className="flex max-w-64 flex-col">
                    <span dir="auto" className={cn('truncate font-medium', income.status === 'cancelled' && 'text-muted-foreground line-through')}>
                        {income.title}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{[income.number, formatDate(income.date)].join(' · ')}</span>
                </div>
            ),
        },
        {
            id: 'from',
            header: t('finance.extraIncome.columns.from'),
            cell: (income) => (
                <div className="flex max-w-56 flex-col">
                    <span dir="auto" className="truncate">
                        {income.receivedFrom}
                    </span>
                    {income.invoiceNumber && <span className="truncate text-xs text-muted-foreground">{t('finance.extraIncome.invoice', { number: income.invoiceNumber })}</span>}
                </div>
            ),
        },
        {
            id: 'property',
            header: t('finance.extraIncome.columns.property'),
            cell: (income) =>
                income.property ? (
                    <Link href={route('properties.payments', income.property.id)} className="flex max-w-48 flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                        <span className="truncate font-medium">{income.property.name}</span>
                        <span className="text-xs text-muted-foreground">{income.property.code}</span>
                    </Link>
                ) : (
                    '—'
                ),
        },
        {
            id: 'method',
            header: t('leasing.payments.columns.method'),
            cell: (income) => {
                const Icon = METHOD_ICONS[income.method];

                return (
                    <span className="flex items-center gap-1.5 text-sm">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {t(`leasing.methods.${income.method}`)}
                    </span>
                );
            },
        },
        {
            id: 'amount',
            header: t('leasing.common.amount'),
            align: 'end',
            cell: (income) => (
                <span className={cn('font-semibold tabular-nums', income.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-success')}>
                    {formatMoney(income.amount, company.currency)}
                </span>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (income) => <ExtraIncomeStatusBadge status={income.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={incomes?.total} description={t('finance.extraIncome.description')} actions={company && addButton} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={BadgePercentIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.extraIncome.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={BadgePercentIcon}
                            tone="success"
                            label={t('finance.extraIncome.stats.received')}
                            value={formatCurrency(summary.received.amount, company.currency)}
                            detail={t('finance.extraIncome.stats.receivedDetail', { count: summary.received.count, period: range })}
                        />
                        <StatCard
                            icon={LandmarkIcon}
                            tone="violet"
                            label={t('finance.extraIncome.stats.bank')}
                            value={formatCurrency(summary.byMethod.bank_transfer + summary.byMethod.card, company.currency)}
                            detail={range}
                        />
                        <StatCard icon={ScrollTextIcon} label={t('finance.extraIncome.stats.cheque')} value={formatCurrency(summary.byMethod.cheque, company.currency)} detail={range} />
                        <StatCard icon={BanknoteIcon} tone="gold" label={t('finance.extraIncome.stats.cash')} value={formatCurrency(summary.byMethod.cash, company.currency)} detail={range} />
                    </section>

                    <RecordList
                        routeName="extra-incomes.index"
                        filters={filters}
                        period={period}
                        facets={{
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`finance.extraIncome.status.${option.value}`), icon: STATUS_ICONS[option.value] })),
                        }}
                        labels={{ method: t('leasing.payments.columns.method'), status: t('leasing.common.status') }}
                        only={['incomes', 'facets', 'summary']}
                        paginator={incomes}
                        searchLabel={t('finance.extraIncome.searchLabel')}
                        searchPlaceholder={t('finance.extraIncome.searchPlaceholder')}
                        empty={<ListEmpty icon={BadgePercentIcon} title={t('finance.extraIncome.empty.title')} description={t('finance.extraIncome.empty.description')} action={addButton} />}
                    >
                        <DataTable columns={columns} rows={incomes.data} actions={(income) => <ExtraIncomeActions income={income} />} />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
