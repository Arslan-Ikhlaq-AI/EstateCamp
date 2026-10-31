import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { ClientStatusBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    Building2Icon,
    CircleCheckIcon,
    CirclePauseIcon,
    EyeIcon,
    FileSignatureIcon,
    PencilIcon,
    PlusIcon,
    ReceiptIcon,
    UserCheckIcon,
    UserIcon,
    UsersIcon,
} from 'lucide-react';

const TYPE_ICONS = { company: Building2Icon, individual: UserIcon };
const STATUS_ICONS = { active: CircleCheckIcon, inactive: CirclePauseIcon };

export default function Index({ company, filters, facets, summary, clients }) {
    const { t, formatNumber, formatCurrency, formatMoney } = useTranslation();
    const title = t('leasing.clients.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('clients.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('leasing.clients.add')}
        </Button>
    );

    const columns = [
        {
            id: 'name',
            header: t('leasing.clients.columns.client'),
            cell: (client) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('clients.show', client.id)} dir="auto" className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {client.name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">{client.contactPerson || '—'}</span>
                </div>
            ),
        },
        {
            id: 'type',
            header: t('leasing.clients.columns.type'),
            cell: (client) => (
                <div className="flex flex-wrap gap-1">
                    <PartyTypeBadge type={client.type} />
                    {client.status !== 'active' && <ClientStatusBadge status={client.status} />}
                </div>
            ),
        },
        {
            id: 'contact',
            header: t('leasing.clients.columns.contact'),
            cell: (client) => (
                <div className="flex flex-col text-sm">
                    <span className="tabular-nums">{client.phone || '—'}</span>
                    <span className="text-xs text-muted-foreground">{client.email}</span>
                </div>
            ),
        },
        { id: 'contracts', header: t('leasing.clients.columns.contracts'), cell: (client) => formatNumber(client.activeContracts) },
        { id: 'staying', header: t('leasing.clients.columns.staying'), cell: (client) => formatNumber(client.staying) },
        {
            id: 'balance',
            header: t('leasing.clients.columns.balance'),
            align: 'end',
            cell: (client) => (
                <span className={cn('font-medium tabular-nums', client.balance > 0 && 'text-destructive')}>
                    {client.balance > 0 ? formatMoney(client.balance, company.currency) : '—'}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: title }]}
                title={title}
                count={summary?.clients}
                description={t('leasing.clients.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={UsersIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.clients.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={UsersIcon}
                            label={t('leasing.clients.stats.clients')}
                            value={formatNumber(summary.clients)}
                            detail={t('leasing.clients.stats.clientsDetail', { companies: summary.companies, individuals: summary.individuals })}
                        />
                        <StatCard
                            icon={FileSignatureIcon}
                            label={t('leasing.clients.stats.contracts')}
                            value={formatNumber(summary.activeContracts)}
                            detail={t('leasing.clients.stats.contractsDetail')}
                        />
                        <StatCard
                            icon={UserCheckIcon}
                            label={t('leasing.clients.stats.staying')}
                            value={formatNumber(summary.staying)}
                            detail={t('leasing.clients.stats.stayingDetail')}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            tone={summary.overdue > 0 ? 'warning' : 'primary'}
                            label={t('leasing.clients.stats.receivable')}
                            value={formatCurrency(summary.receivable, company.currency)}
                            detail={t('leasing.clients.stats.receivableDetail', { amount: formatCurrency(summary.overdue, company.currency) })}
                        />
                    </section>

                    <RecordList
                        routeName="clients.index"
                        filters={filters}
                        facets={{
                            types: facets.types.map((option) => ({ ...option, label: t(`leasing.partyTypes.${option.value}`), icon: TYPE_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.client.${option.value}`), icon: STATUS_ICONS[option.value] })),
                        }}
                        labels={{ types: t('leasing.clients.columns.type'), status: t('leasing.common.status') }}
                        only={['clients', 'facets']}
                        paginator={clients}
                        searchLabel={t('leasing.clients.searchLabel')}
                        searchPlaceholder={t('leasing.clients.searchPlaceholder')}
                        empty={<ListEmpty icon={UsersIcon} title={t('leasing.clients.empty.title')} description={t('leasing.clients.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={clients.data}
                            actions={(client) => (
                                <RowActions
                                    label={client.name}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('clients.show', client.id), icon: EyeIcon },
                                        { label: t('leasing.common.edit'), href: route('clients.edit', client.id), icon: PencilIcon },
                                        { label: t('leasing.contracts.add'), href: route('contracts.create', { client: client.id }), icon: FileSignatureIcon },
                                        { label: t('leasing.payments.add'), href: route('payments.create', { client: client.id }), icon: ReceiptIcon },
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
