import DataTable from '@/Components/DataTable';
import { METHOD_ICONS } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { BadgePercentIcon, PlusIcon } from 'lucide-react';
import { moneyColumns } from '../ExtraPayments/Partials/agreementColumns';
import ManageButton from '../ExtraPayments/Partials/ManageDialog';
import MoneyStats from '../ExtraPayments/Partials/MoneyStats';
import SettlementTable from '../ExtraPayments/Partials/SettlementTable';
import { STANDING_ICONS } from '../ExtraPayments/Partials/StandingBadge';
import ExtraIncomeActions from './Partials/ExtraIncomeActions';

/**
 * Extra income: what the properties earn besides rent, such as a
 * provider's share for internet, gas or washing machines. One of the extra
 * payments, so it shows what came in, what was settled, how, and what is
 * left, with a Manage button on each row to settle it.
 */
export default function Index({ company, filters, period, facets, properties, summary, settlements, incomes, settlementMethods }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const can = useCan();
    const title = t('finance.extraIncome.title');

    const addButton = can('extra_income.create') && (
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
                    <Link href={route('properties.show', income.property.id)} className="flex max-w-48 flex-col underline-offset-4 hover:text-brand-ink hover:underline">
                        <span className="truncate font-medium">{income.property.name}</span>
                        <span className="text-xs text-muted-foreground">{income.property.code}</span>
                    </Link>
                ) : (
                    '—'
                ),
        },
        {
            id: 'method',
            header: t('extraPayments.filters.method'),
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
                <span className={cn('font-semibold whitespace-nowrap tabular-nums', income.status === 'cancelled' ? 'text-muted-foreground line-through' : 'text-success')}>
                    {formatMoney(income.amount, company.currency)}
                </span>
            ),
        },
        ...moneyColumns({ t, formatMoney, currency: company?.currency }),
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('extraPayments.title'), href: route('extra-payments.index') }, { label: title }]}
                title={title}
                count={incomes?.total}
                description={t('finance.extraIncome.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={BadgePercentIcon} />
            ) : (
                <>
                    <MoneyStats figures={summary} currency={company.currency} withToCollect={false} />

                    <RecordList
                        routeName="extra-incomes.index"
                        filters={filters}
                        period={period}
                        propertyFilter={properties}
                        facets={{
                            standing: facets.standing.map((option) => ({ ...option, label: t(`extraPayments.standing.${option.value}`), icon: STANDING_ICONS[option.value] })),
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                        }}
                        labels={{ standing: t('extraPayments.filters.standing'), method: t('extraPayments.filters.method') }}
                        only={['incomes', 'facets', 'summary', 'settlements']}
                        paginator={incomes}
                        searchLabel={t('finance.extraIncome.searchLabel')}
                        searchPlaceholder={t('finance.extraIncome.searchPlaceholder')}
                        empty={<ListEmpty icon={BadgePercentIcon} title={t('finance.extraIncome.empty.title')} description={t('finance.extraIncome.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={incomes.data}
                            actions={(income) => (
                                <div className="flex items-center justify-end gap-1">
                                    <ManageButton
                                        record={income}
                                        description={[income.title, income.property?.name].filter(Boolean).join(' · ')}
                                        currency={company.currency}
                                        methods={settlementMethods}
                                    />
                                    <ExtraIncomeActions income={income} />
                                </div>
                            )}
                        />
                    </RecordList>

                    <SettlementTable settlements={settlements} currency={company.currency} />
                </>
            )}
        </DashboardLayout>
    );
}
