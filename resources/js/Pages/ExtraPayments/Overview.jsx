import ActiveFilters from '@/Components/ActiveFilters';
import DataTable from '@/Components/DataTable';
import FacetFilter from '@/Components/FacetFilter';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter from '@/Components/PeriodFilter';
import PropertyFilter from '@/Components/PropertyFilter';
import { NoCompany } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCan } from '@/hooks/use-can';
import { useListQuery } from '@/hooks/use-list-query';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { ArrowRightIcon, CoinsIcon, PlusIcon } from 'lucide-react';
import { agreementColumns, moneyColumns } from './Partials/agreementColumns';
import ManageButton from './Partials/ManageDialog';
import MoneyStats from './Partials/MoneyStats';
import SettlementTable from './Partials/SettlementTable';
import { STANDING_ICONS } from './Partials/StandingBadge';

const FIGURES = ['received', 'receivedCount', 'settled', 'settledCount', 'partCount', 'heldCount', 'remaining', 'toCollect', 'toCollectCount'];

const addUp = (sections) => Object.fromEntries(FIGURES.map((key) => [key, sections.reduce((total, section) => total + section.figures[key], 0)]));

/**
 * One kind of money: its own figures, its latest records and a link to all
 * of them, carrying the overview's filters.
 */
function Section({ title, section, columns, href, manage }) {
    const { t, formatNumber, formatMoney } = useTranslation();
    const { figures, rows } = section;
    const currency = manage.currency;

    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{title}</CardTitle>
                <CardDescription className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
                    <span>
                        {t('extraPayments.stats.received')}: <strong className="font-semibold text-foreground">{formatMoney(figures.received, currency)}</strong>
                    </span>
                    <span>
                        {t('extraPayments.stats.settled')}: <strong className="font-semibold text-foreground">{formatMoney(figures.settled, currency)}</strong>
                    </span>
                    <span>
                        {t('extraPayments.stats.remaining')}: <strong className="font-semibold text-foreground">{formatMoney(figures.remaining, currency)}</strong>
                    </span>
                    {figures.toCollectCount > 0 && (
                        <span>
                            {t('extraPayments.stats.toCollect')}: <strong className="font-semibold text-foreground">{formatMoney(figures.toCollect, currency)}</strong> ({formatNumber(figures.toCollectCount)})
                        </span>
                    )}
                </CardDescription>
                <CardAction>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
                        {t('extraPayments.viewAll')}
                        <ArrowRightIcon data-icon="inline-end" className="rtl:-scale-x-100" />
                    </Button>
                </CardAction>
            </CardHeader>
            {rows.length === 0 ? (
                <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('extraPayments.empty.noneInPeriod')}</CardContent>
            ) : (
                <DataTable columns={columns} rows={rows} actions={manage.actions} />
            )}
        </Card>
    );
}

/**
 * Extra payments at a glance, filtered by period, property and how the money
 * stands: commissions on top, then deposits, then extra income, then how it
 * was all settled. None of it is part of payments, revenue or the reports.
 */
export default function Overview({ company, filters, period, facets, properties, commissions, deposits, extraIncome, settlements, settlementMethods }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const can = useCan();
    const title = t('extraPayments.title');
    const currency = company?.currency;
    const facetKeys = ['standing'];
    const only = ['commissions', 'deposits', 'extraIncome', 'settlements', 'facets', 'period'];
    const { query, reset, visit, isLoading } = useListQuery({
        routeName: 'extra-payments.index',
        filters: filters ?? { search: '', perPage: 10, period: '', property: '', standing: [] },
        defaults: { search: '', perPage: 10, period: '', property: '', standing: [] },
        facetKeys,
        only,
        resetTo: { period: '', property: '' },
    });
    const carried = Object.fromEntries(Object.entries({ period: query.period, property: query.property }).filter(([, value]) => value));
    const standingOptions = (facets?.standing ?? []).map((option) => ({ ...option, label: t(`extraPayments.standing.${option.value}`), icon: STANDING_ICONS[option.value] }));
    const manageAgreementMoney = (record) => (
        <ManageButton
            record={record}
            description={[record.client?.name, record.property?.name].filter(Boolean).join(' · ')}
            currency={currency}
            methods={settlementMethods}
            paidTo={record.kind === 'deposit' ? record.client?.name : ''}
        />
    );
    const manageIncome = (income) => (
        <ManageButton record={income} description={[income.title, income.property?.name].filter(Boolean).join(' · ')} currency={currency} methods={settlementMethods} />
    );
    const incomeColumns = [
        {
            id: 'income',
            header: t('finance.extraIncome.columns.income'),
            cell: (income) => (
                <div className="flex max-w-64 flex-col">
                    <span dir="auto" className="truncate font-medium">
                        {income.title}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        <bdi>{income.number}</bdi> · <bdi>{formatDate(income.date)}</bdi>
                    </span>
                </div>
            ),
        },
        {
            id: 'from',
            header: t('finance.extraIncome.columns.from'),
            cell: (income) => (
                <span dir="auto" className="block max-w-52 truncate">
                    {income.receivedFrom}
                </span>
            ),
        },
        {
            id: 'property',
            header: t('extraPayments.columns.property'),
            cell: (income) =>
                income.property ? (
                    <Link href={route('properties.show', income.property.id)} className="flex max-w-48 flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                        <span className="truncate font-medium">{income.property.name}</span>
                        <span className="text-xs text-muted-foreground">{income.property.code}</span>
                    </Link>
                ) : (
                    '—'
                ),
        },
        {
            id: 'amount',
            header: t('extraPayments.columns.amount'),
            align: 'end',
            cell: (income) => <span className="font-semibold whitespace-nowrap tabular-nums">{formatMoney(income.amount, currency)}</span>,
        },
        ...moneyColumns({ t, formatMoney, currency }),
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: title }]}
                title={title}
                description={t('extraPayments.description')}
                actions={
                    company &&
                    can('extra_income.create') && (
                        <Button variant="brand" nativeButton={false} render={<Link href={route('extra-incomes.create')} />}>
                            <PlusIcon data-icon="inline-start" />
                            {t('finance.extraIncome.add')}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={CoinsIcon} />
            ) : (
                <div aria-busy={isLoading} className={cn('flex flex-col gap-4 transition-opacity sm:gap-6', isLoading && 'opacity-60')}>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <PeriodFilter period={period} onChange={(value) => visit({ period: value })} />
                            <PropertyFilter properties={properties} chosen={query.property} onChange={(value) => visit({ property: value })} />
                            <FacetFilter title={t('extraPayments.filters.standing')} options={standingOptions} selected={query.standing} onChange={(values) => visit({ standing: values })} />
                        </div>
                        <ActiveFilters
                            query={query}
                            facetKeys={facetKeys}
                            labels={{ standing: t('extraPayments.filters.standing') }}
                            facetOptions={{ standing: standingOptions }}
                            onFilterChange={(key, values) => visit({ [key]: values })}
                            onSearchClear={() => {}}
                            onReset={reset}
                        />
                    </div>

                    <MoneyStats figures={addUp([commissions, deposits, extraIncome])} currency={currency} />

                    <Section
                        title={t('extraPayments.pages.commission.section')}
                        section={commissions}
                        columns={agreementColumns({ t, formatDate, formatMoney, currency })}
                        href={route('commissions.index', carried)}
                        manage={{ currency, actions: manageAgreementMoney }}
                    />
                    <Section
                        title={t('extraPayments.pages.deposit.section')}
                        section={deposits}
                        columns={agreementColumns({ t, formatDate, formatMoney, currency })}
                        href={route('deposits.index', carried)}
                        manage={{ currency, actions: manageAgreementMoney }}
                    />
                    <Section
                        title={t('extraPayments.pages.extra_income.section')}
                        section={extraIncome}
                        columns={incomeColumns}
                        href={route('extra-incomes.index', carried)}
                        manage={{ currency, actions: manageIncome }}
                    />

                    <SettlementTable settlements={settlements} currency={currency} showKind />
                </div>
            )}
        </DashboardLayout>
    );
}
