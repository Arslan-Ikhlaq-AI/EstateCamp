import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import { ListSearch } from '@/Components/ListToolbar';
import PageHeader from '@/Components/PageHeader';
import { useHoldingSummary } from '@/Components/PropertyHoldings';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    DoorOpenIcon,
    EyeIcon,
    FilePlusIcon,
    FileSignatureIcon,
    LayoutPanelLeftIcon,
    Undo2Icon,
    UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import TenantClientCard from './Partials/TenantClientCard';
import TenantContractsSummary from './Partials/TenantContractsSummary';

const STATUS_FILTERS = ['all', 'active', 'draft', 'ended', 'terminated'];

const isLive = (contract) => contract.status === 'active' || contract.status === 'draft';

/**
 * What a search finds a client by, and a contract by: its number and
 * Ejari, the rooms, apartments and shops it rents here and its cheque numbers.
 */
const clientWords = (client) => [client.name, client.contactPerson, client.phone, client.email, client.tradeLicenseNumber, client.idNumber];

const contractWords = (contract) => [
    contract.number,
    contract.ejariNumber,
    ...contract.lines.flatMap((line) => [line.roomNumber, line.apartmentNumber, line.shopNumber]),
    ...contract.cheques.map((cheque) => cheque.chequeNumber),
];

/**
 * Everyone renting in a property under contract: figures for the property
 * and every cheque by where it stands, then each client with how to reach
 * them and each of their contracts — its terms, the rooms and units it
 * holds here, its documents and its cheques, whose statuses can be updated
 * in place. Running and draft contracts start open.
 */
export default function TenantContracts({ property, clients, summary, chequeStatuses, banks, currency }) {
    const { t, tOr, formatNumber, formatCurrency } = useTranslation();
    const holdingSummary = useHoldingSummary();
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [openIds, setOpenIds] = useState(() => clients.flatMap((client) => client.contracts.filter(isLive).map((contract) => contract.id)));
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const { stages, overdue } = summary.cheques;
    const chequeTotal = Object.entries(stages).reduce((sum, [stage, figures]) => (stage === 'cancelled' ? sum : sum + figures.count), 0);
    const contractTotal = Object.values(summary.contracts).reduce((sum, count) => sum + count, 0);

    const needle = search.trim().toLowerCase();
    const matches = (words) => words.some((word) => word?.toLowerCase().includes(needle));
    const visible = clients
        .map((client) => {
            const clientMatches = needle === '' || matches(clientWords(client));

            return {
                client,
                contracts: client.contracts.filter((contract) => (status === 'all' || contract.status === status) && (clientMatches || matches(contractWords(contract)))),
            };
        })
        .filter(({ contracts }) => contracts.length > 0);
    const visibleIds = visible.flatMap(({ contracts }) => contracts.map((contract) => contract.id));
    const allOpen = visibleIds.length > 0 && visibleIds.every((id) => openIds.includes(id));
    const toggleAll = () => setOpenIds((ids) => (allOpen ? ids.filter((id) => !visibleIds.includes(id)) : [...new Set([...ids, ...visibleIds])]));
    const setOpen = (id, isOpen) => setOpenIds((ids) => (isOpen ? [...ids, id] : ids.filter((openId) => openId !== id)));

    return (
        <DashboardLayout>
            <Head title={`${t('propertyTenantContracts.title')} · ${property.name}`} />

            <PageHeader
                breadcrumbs={[
                    { label: t('properties.title'), href: route('properties.index') },
                    { label: property.name, href: route('properties.show', property.id) },
                    { label: t('propertyTenantContracts.title') },
                ]}
                title={t('propertyTenantContracts.title')}
                description={[property.name, property.code, type, place].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.show', property.id)} />}>
                            <EyeIcon data-icon="inline-start" />
                            {t('propertyAllocation.viewProperty')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.allocation', property.id)} />}>
                            <LayoutPanelLeftIcon data-icon="inline-start" />
                            {t('properties.actions.allocation')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                            <FilePlusIcon data-icon="inline-start" />
                            {t('propertyShow.newContract')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('propertyTenantContracts.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={UsersIcon}
                    label={t('propertyTenantContracts.stats.clients')}
                    value={formatNumber(summary.clients)}
                    detail={t('propertyTenantContracts.stats.clientsDetail', { active: formatNumber(summary.contracts.active), draft: formatNumber(summary.contracts.draft) })}
                />
                <StatCard
                    icon={DoorOpenIcon}
                    tone="violet"
                    label={t('propertyTenantContracts.stats.rooms')}
                    value={formatNumber(summary.units.rooms)}
                    detail={holdingSummary({ ...summary.units, rooms: 0 }) || t('propertyTenantContracts.stats.roomsDetailNone')}
                />
                <StatCard
                    icon={BanknoteIcon}
                    tone="gold"
                    label={t('propertyTenantContracts.stats.monthly')}
                    value={formatCurrency(summary.monthly, currency)}
                    detail={t('propertyTenantContracts.stats.monthlyDetail', { amount: formatCurrency(summary.deposits, currency) })}
                />
                <StatCard
                    icon={CircleCheckIcon}
                    tone="success"
                    label={t('propertyTenantContracts.stats.cleared')}
                    value={formatCurrency(stages.cleared.amount, currency)}
                    meter={chequeTotal > 0 ? (stages.cleared.count / chequeTotal) * 100 : undefined}
                    detail={t('propertyTenantContracts.stats.clearedDetail', { count: formatNumber(stages.cleared.count), total: formatNumber(chequeTotal) })}
                    badge={
                        (overdue.count > 0 || stages.bounced.count > 0) && (
                            <span className="flex flex-wrap gap-1">
                                {overdue.count > 0 && (
                                    <ToneBadge tone="danger" icon={CircleAlertIcon}>
                                        {t('propertyTenantContracts.stats.overdue', { count: formatNumber(overdue.count) })}
                                    </ToneBadge>
                                )}
                                {stages.bounced.count > 0 && (
                                    <ToneBadge tone="danger" icon={Undo2Icon}>
                                        {t('propertyTenantContracts.stats.bounced', { count: formatNumber(stages.bounced.count) })}
                                    </ToneBadge>
                                )}
                            </span>
                        )
                    }
                />
            </section>

            {clients.length === 0 ? (
                <Card>
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FileSignatureIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('propertyTenantContracts.empty.title')}</EmptyTitle>
                            <EmptyDescription>{t('propertyTenantContracts.empty.description')}</EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button variant="outline" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                                <FilePlusIcon data-icon="inline-start" />
                                {t('propertyShow.newContract')}
                            </Button>
                        </EmptyContent>
                    </Empty>
                </Card>
            ) : (
                <>
                    <TenantContractsSummary summary={summary} currency={currency} />

                    <section aria-label={t('propertyTenantContracts.listLabel')} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <ToggleGroup
                                variant="outline"
                                spacing={0}
                                value={[status]}
                                onValueChange={([value]) => value && setStatus(value)}
                                aria-label={t('propertyTenantContracts.filter')}
                                className="max-w-full overflow-x-auto"
                            >
                                {STATUS_FILTERS.map((key) => (
                                    <ToggleGroupItem key={key} value={key} className="gap-2 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                                        {key === 'all' ? t('propertyTenantContracts.all') : t(`leasing.status.contract.${key}`)}
                                        <span className="text-xs opacity-70 tabular-nums">{formatNumber(key === 'all' ? contractTotal : summary.contracts[key])}</span>
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <ListSearch
                                    id="tenant-contracts-search"
                                    value={search}
                                    onChange={setSearch}
                                    placeholder={t('propertyTenantContracts.search')}
                                    label={t('propertyTenantContracts.searchLabel')}
                                />
                                <Button variant="outline" onClick={toggleAll} disabled={visibleIds.length === 0} className="shrink-0">
                                    {allOpen ? <ChevronsDownUpIcon data-icon="inline-start" /> : <ChevronsUpDownIcon data-icon="inline-start" />}
                                    {allOpen ? t('propertyTenantContracts.collapseAll') : t('propertyTenantContracts.expandAll')}
                                </Button>
                            </div>
                        </div>

                        {visible.length === 0 ? (
                            <Card>
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('propertyTenantContracts.noMatches')}</p>
                            </Card>
                        ) : (
                            visible.map(({ client, contracts }) => (
                                <TenantClientCard
                                    key={client.id}
                                    client={client}
                                    contracts={contracts}
                                    currency={currency}
                                    openIds={openIds}
                                    onOpenChange={setOpen}
                                    chequeStatuses={chequeStatuses}
                                    banks={banks}
                                />
                            ))
                        )}
                    </section>
                </>
            )}
        </DashboardLayout>
    );
}
