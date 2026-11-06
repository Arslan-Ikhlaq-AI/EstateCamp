import DataTable from '@/Components/DataTable';
import { METHOD_ICONS } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useTranslation } from '@/hooks/use-translation';
import { Head } from '@inertiajs/react';
import { BadgeDollarSignIcon, ShieldCheckIcon } from 'lucide-react';
import { agreementColumns } from './Partials/agreementColumns';
import ManageButton from './Partials/ManageDialog';
import MoneyStats from './Partials/MoneyStats';
import SettlementTable from './Partials/SettlementTable';
import { STANDING_ICONS } from './Partials/StandingBadge';

const ICONS = { commission: BadgeDollarSignIcon, deposit: ShieldCheckIcon };

/**
 * The commissions or the security deposits (`kind` says which) taken with
 * contracts and short-term rentals: what came in, what was settled, how, and
 * what is left, with a Manage button on each row to receive or settle it.
 */
export default function Records({ kind, company, filters, period, facets, properties, summary, settlements, records, settlementMethods }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const Icon = ICONS[kind];
    const title = t(`extraPayments.pages.${kind}.title`);
    const currency = company?.currency;

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('extraPayments.title'), href: route('extra-payments.index') }, { label: title }]}
                title={title}
                count={records?.total}
                description={t(`extraPayments.pages.${kind}.description`)}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={Icon} />
            ) : (
                <>
                    <MoneyStats figures={summary} currency={currency} />

                    <RecordList
                        routeName={`${kind === 'commission' ? 'commissions' : 'deposits'}.index`}
                        filters={filters}
                        period={period}
                        propertyFilter={properties}
                        facets={{
                            standing: facets.standing.map((option) => ({ ...option, label: t(`extraPayments.standing.${option.value}`), icon: STANDING_ICONS[option.value] })),
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                        }}
                        labels={{ standing: t('extraPayments.filters.standing'), method: t('extraPayments.filters.method') }}
                        only={['records', 'facets', 'summary', 'settlements']}
                        paginator={records}
                        searchLabel={t(`extraPayments.pages.${kind}.searchLabel`)}
                        searchPlaceholder={t(`extraPayments.pages.${kind}.searchPlaceholder`)}
                        empty={<ListEmpty icon={Icon} title={t(`extraPayments.pages.${kind}.empty.title`)} description={t(`extraPayments.pages.${kind}.empty.description`)} />}
                    >
                        <DataTable
                            columns={agreementColumns({ t, formatDate, formatMoney, currency })}
                            rows={records.data}
                            actions={(record) => (
                                <ManageButton
                                    record={record}
                                    description={[record.client?.name, record.property?.name].filter(Boolean).join(' · ')}
                                    currency={currency}
                                    methods={settlementMethods}
                                    paidTo={kind === 'deposit' ? record.client?.name : ''}
                                />
                            )}
                        />
                    </RecordList>

                    <SettlementTable settlements={settlements} currency={currency} />
                </>
            )}
        </DashboardLayout>
    );
}
