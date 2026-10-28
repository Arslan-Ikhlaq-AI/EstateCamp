import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PropertyCover from '@/Components/PropertyCover';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    BedDoubleIcon,
    ExternalLinkIcon,
    FilePlusIcon,
    FileSignatureIcon,
    LayoutGridIcon,
    LayoutPanelLeftIcon,
    PencilIcon,
    UsersIcon,
    WalletIcon,
    WrenchIcon,
} from 'lucide-react';
import DocumentsOnFile from '../HeadLeases/Partials/DocumentsOnFile';
import { FacilityCounts } from './Partials/BuildingFacilities';
import ClientShares from './Partials/ClientShares';
import LandlordCard from './Partials/LandlordCard';
import OccupancyBreakdown from './Partials/OccupancyBreakdown';
import { ClientContracts, HeadLeases } from './Partials/PropertyContracts';
import { LeaseNote, OwnershipBadge, StatusBadge } from './Partials/PropertyBadges';

/**
 * One property: its photo and details, every room, bed, shop and apartment
 * by how full it is, which clients rent which units under which contracts,
 * its facilities, the landlord and head leases it is rented under, and its
 * documents.
 */
export default function Show({ property, landlord, leases, contracts, clients, documents, currency }) {
    const { t, tOr, formatNumber, formatPercent, formatCurrency, formatDate } = useTranslation();
    const { beds } = property;
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const activeContracts = contracts.filter((contract) => contract.status === 'active').length;
    const unitCounts = { rooms: property.rooms, shops: property.shops, apartments: property.apartments };
    const hasFacilities = Object.values(property.facilities).some((count) => count !== null);

    return (
        <DashboardLayout>
            <Head title={property.name} />

            <PageHeader
                breadcrumbs={[{ label: t('properties.title'), href: route('properties.index') }, { label: property.name }]}
                title={property.name}
                badge={<StatusBadge status={property.status} />}
                description={[property.code, type, place].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.edit', property.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('propertyShow.edit')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.allocation', property.id)} />}>
                            <LayoutPanelLeftIcon data-icon="inline-start" />
                            {t('properties.actions.allocation')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.tenant-contracts', property.id)} />}>
                            <FileSignatureIcon data-icon="inline-start" />
                            {t('properties.actions.tenantContracts')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.payments', property.id)} />}>
                            <WalletIcon data-icon="inline-start" />
                            {t('properties.actions.payments')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('maintenance.create', { property: property.id })} />}>
                            <WrenchIcon data-icon="inline-start" />
                            {t('maintenance.reportProblem')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                            <FilePlusIcon data-icon="inline-start" />
                            {t('propertyShow.newContract')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('propertyShow.stats')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BedDoubleIcon}
                    tone="success"
                    label={t('properties.stats.occupancy')}
                    value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                    meter={beds.occupancyRate ?? 0}
                    detail={t('properties.stats.occupancyDetail', { occupied: beds.occupied, total: beds.occupied + beds.available })}
                />
                <StatCard
                    icon={LayoutGridIcon}
                    tone="violet"
                    label={t('properties.stats.units')}
                    value={formatNumber(unitCounts.rooms + unitCounts.shops + unitCounts.apartments)}
                    detail={Object.entries(unitCounts)
                        .map(([kind, count]) => t(`properties.stats.${kind}`, { count }))
                        .join(' · ')}
                />
                <StatCard
                    icon={UsersIcon}
                    label={t('propertyShow.clientsStat')}
                    value={formatNumber(clients.length)}
                    detail={t('propertyShow.clientsDetail', { count: activeContracts })}
                />
                <StatCard
                    icon={BanknoteIcon}
                    tone="gold"
                    label={t('properties.stats.rentRoll')}
                    value={formatCurrency(property.rentRoll, currency)}
                    detail={t('propertyShow.rentRollDetail')}
                />
            </section>

            <SectionCard title={t('propertyShow.occupancy.title')} description={t('propertyShow.occupancy.description')}>
                <OccupancyBreakdown property={property} />
            </SectionCard>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('propertyShow.clients.title')} description={t('propertyShow.clients.description')}>
                        <ClientShares property={property} clients={clients} currency={currency} />
                    </SectionCard>

                    <SectionCard
                        title={t('propertyShow.documents.title')}
                        description={t('propertyShow.documents.description')}
                        action={
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`${route('properties.edit', property.id)}#step-documents`} />}>
                                {t('propertyShow.documents.manage')}
                            </Button>
                        }
                    >
                        {documents.length > 0 ? (
                            <DocumentsOnFile documents={documents} />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('propertyShow.documents.empty')}</p>
                        )}
                    </SectionCard>
                </div>

                <aside className="flex flex-col gap-6">
                    <Card className="gap-0 overflow-hidden py-0">
                        <div className="relative aspect-[16/10] bg-muted">
                            <PropertyCover src={property.coverImageUrl} />
                        </div>
                        <div className="flex flex-col gap-5 p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <OwnershipBadge ownership={property.ownership} />
                                <LeaseNote property={property} />
                            </div>
                            <DetailList
                                columns={1}
                                rows={[
                                    { label: t('propertyShow.details.address'), value: property.address || place },
                                    { label: t('propertyForm.fields.building'), value: property.buildingName },
                                    { label: t('propertyForm.fields.street'), value: property.street },
                                    { label: t('propertyForm.fields.plot'), value: property.plotNumber },
                                    { label: t('propertyForm.fields.makani'), value: property.makaniNumber },
                                    { label: t('propertyForm.fields.poBox'), value: property.poBox },
                                    {
                                        label: t('propertyForm.fields.mapUrl'),
                                        value: property.mapUrl && (
                                            <a href={property.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                                                {t('propertyShow.details.openMap')}
                                                <ExternalLinkIcon className="size-3.5" />
                                            </a>
                                        ),
                                    },
                                    property.ownership === 'leased' && {
                                        label: t('propertyShow.details.lease'),
                                        value: property.lease ? (
                                            <Link href={route('head-leases.show', property.lease.id)} className="text-brand-ink hover:underline">
                                                {property.lease.number} · {formatDate(property.leaseStartsOn)} – {formatDate(property.leaseEndsOn)}
                                            </Link>
                                        ) : null,
                                    },
                                    {
                                        label: t('propertyShow.details.size'),
                                        value: [
                                            property.totalFloors && t('propertyForm.size.floorsCount', { count: property.totalFloors }),
                                            property.totalUnits && t('propertyForm.size.unitsCount', { count: property.totalUnits }),
                                        ]
                                            .filter(Boolean)
                                            .join(' · '),
                                    },
                                    {
                                        label: t('propertyShow.details.contact'),
                                        value: [property.contactName, property.contactPhone].filter(Boolean).join(' · '),
                                    },
                                ].filter((row) => row && (row.value || row.label === t('propertyShow.details.address')))}
                            />
                        </div>
                    </Card>

                    {hasFacilities && (
                        <SectionCard title={t('propertyForm.facilities.title')} description={t('propertyShow.facilitiesDescription')}>
                            <FacilityCounts facilities={property.facilities} />
                        </SectionCard>
                    )}

                    {property.notes && (
                        <SectionCard title={t('propertyForm.fields.notes')}>
                            <p className="text-sm whitespace-pre-line" dir="auto">
                                {property.notes}
                            </p>
                        </SectionCard>
                    )}
                </aside>
            </div>

            <SectionCard title={t('propertyShow.contracts.title')} description={t('propertyShow.contracts.description')} flush>
                <ClientContracts contracts={contracts} currency={currency} />
            </SectionCard>

            {landlord && <LandlordCard landlord={landlord} />}

            {(property.ownership === 'leased' || leases.length > 0) && (
                <SectionCard title={t('propertyShow.leases.title')} description={t('propertyShow.leases.description')} flush>
                    <HeadLeases leases={leases} currency={currency} propertyId={property.id} />
                </SectionCard>
            )}
        </DashboardLayout>
    );
}
