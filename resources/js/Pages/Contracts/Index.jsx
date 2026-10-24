import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { ContractStatusBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
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
    BedDoubleIcon,
    Building2Icon,
    CalendarClockIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    CylinderIcon,
    EyeIcon,
    FileClockIcon,
    FileSignatureIcon,
    FileXIcon,
    HouseIcon,
    PencilIcon,
    PlusIcon,
    UserIcon,
} from 'lucide-react';

const STATUS_ICONS = { draft: FileClockIcon, active: CircleCheckIcon, ended: CirclePauseIcon, terminated: FileXIcon };
const TYPE_ICONS = { company: Building2Icon, individual: UserIcon };
const GAS_ICONS = { included: HouseIcon, billed: CylinderIcon };

export default function Index({ company, filters, facets, summary, contracts }) {
    const { t, formatNumber, formatCurrency, formatMoney } = useTranslation();
    const { period, unitsSummary } = useLeasingFormat();
    const title = t('leasing.contracts.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('contracts.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('leasing.contracts.add')}
        </Button>
    );

    const columns = [
        {
            id: 'contract',
            header: t('leasing.contracts.columns.contract'),
            cell: (contract) => (
                <div className="flex max-w-48 min-w-0 flex-col">
                    <Link href={route('contracts.show', contract.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {contract.number}
                    </Link>
                    <Link href={route('clients.show', contract.client.id)} dir="auto" className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                        {contract.client.name}
                    </Link>
                </div>
            ),
        },
        { id: 'type', header: t('leasing.clients.columns.type'), cell: (contract) => <PartyTypeBadge type={contract.client.type} /> },
        {
            id: 'term',
            header: t('leasing.contracts.columns.term'),
            cell: (contract) => (
                <div className="flex flex-col text-sm">
                    <span>{period(contract.startDate, contract.endDate)}</span>
                    {contract.status === 'active' && (
                        <span className={cn('text-xs', contract.daysLeft <= 60 ? 'text-warning' : 'text-muted-foreground')}>
                            {t('leasing.common.daysLeft', { count: contract.daysLeft })}
                        </span>
                    )}
                </div>
            ),
        },
        {
            id: 'units',
            header: t('leasing.contracts.columns.units'),
            className: 'min-w-28 whitespace-normal',
            cell: (contract) => (
                <div className="flex flex-col">
                    <span className="text-sm">{unitsSummary(contract.units) || '—'}</span>
                    {!contract.gasIncluded && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CylinderIcon className="size-3 text-(--cash-gas)" />
                            {t('leasing.contracts.form.gasOptions.billed')}
                        </span>
                    )}
                </div>
            ),
        },
        {
            id: 'value',
            header: t('leasing.contracts.columns.monthly'),
            align: 'end',
            cell: (contract) => <span className="font-medium tabular-nums">{formatCurrency(contract.monthlyValue, company.currency)}</span>,
        },
        { id: 'staying', header: t('leasing.contracts.columns.staying'), cell: (contract) => formatNumber(contract.staying ?? 0) },
        {
            id: 'balance',
            header: t('leasing.contracts.columns.balance'),
            align: 'end',
            cell: (contract) => (
                <span className={cn('tabular-nums', contract.balance > 0 && 'font-medium text-destructive')}>
                    {contract.balance > 0 ? formatMoney(contract.balance, company.currency) : '—'}
                </span>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (contract) => <ContractStatusBadge status={contract.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: title }]}
                title={title}
                count={contracts?.total}
                description={t('leasing.contracts.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={FileSignatureIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.contracts.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={FileSignatureIcon}
                            label={t('leasing.contracts.stats.active')}
                            value={formatNumber(summary.active)}
                            detail={t('leasing.contracts.stats.activeDetail', { count: summary.drafts })}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            label={t('leasing.contracts.stats.monthly')}
                            value={formatCurrency(summary.monthlyValue, company.currency)}
                            detail={t('leasing.contracts.stats.monthlyDetail')}
                        />
                        <StatCard
                            icon={BedDoubleIcon}
                            label={t('leasing.contracts.stats.beds')}
                            value={formatNumber(summary.contractedBeds)}
                            meter={summary.contractedBeds > 0 ? Math.min(100, (summary.staying / summary.contractedBeds) * 100) : 0}
                            detail={t('leasing.contracts.stats.bedsDetail', { count: summary.staying })}
                        />
                        <StatCard
                            icon={CalendarClockIcon}
                            tone={summary.expiringSoon > 0 ? 'warning' : 'primary'}
                            label={t('leasing.contracts.stats.expiring')}
                            value={formatNumber(summary.expiringSoon)}
                            detail={t('leasing.contracts.stats.expiringDetail')}
                        />
                    </section>

                    <RecordList
                        routeName="contracts.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.contract.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            types: facets.types.map((option) => ({ ...option, label: t(`leasing.partyTypes.${option.value}`), icon: TYPE_ICONS[option.value] })),
                            gas: facets.gas.map((option) => ({ ...option, label: t(`leasing.contracts.form.gasOptions.${option.value}`), icon: GAS_ICONS[option.value] })),
                        }}
                        labels={{ status: t('leasing.common.status'), types: t('leasing.contracts.filters.clientType'), gas: t('leasing.contracts.form.fields.gas') }}
                        only={['contracts', 'facets']}
                        paginator={contracts}
                        searchLabel={t('leasing.contracts.searchLabel')}
                        searchPlaceholder={t('leasing.contracts.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={FileSignatureIcon}
                                title={t('leasing.contracts.empty.title')}
                                description={t('leasing.contracts.empty.description')}
                                action={addButton}
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={contracts.data}
                            actions={(contract) => (
                                <RowActions
                                    label={contract.number}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('contracts.show', contract.id), icon: EyeIcon },
                                        ...(['draft', 'active'].includes(contract.status)
                                            ? [{ label: t('leasing.common.edit'), href: route('contracts.edit', contract.id), icon: PencilIcon }]
                                            : []),
                                        { label: t('leasing.contracts.viewClient'), href: route('clients.show', contract.client.id), icon: UserIcon },
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
