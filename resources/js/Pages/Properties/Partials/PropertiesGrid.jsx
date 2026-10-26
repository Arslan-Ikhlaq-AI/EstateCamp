import BedBar from '@/Components/BedBar';
import PropertyCover from '@/Components/PropertyCover';
import RadialGauge from '@/Components/RadialGauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { BanknoteIcon, BedDoubleIcon, DoorOpenIcon, LayoutPanelLeftIcon, MapPinIcon } from 'lucide-react';
import { ComplianceBadge, LeaseNote, OwnershipBadge, StatusBadge } from './PropertyBadges';
import PropertyActions from './PropertyActions';
import UnitOccupancyCounts from './UnitOccupancy';

const STAT_TONES = {
    brand: 'bg-brand-cyan/10 text-brand-ink',
    gold: 'bg-gold/20 text-gold-ink',
    green: 'bg-success/12 text-success',
};

function Stat({ icon: Icon, label, value, tone }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-muted/50 p-2.5">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', STAT_TONES[tone])}>
                <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
                <dt className="truncate text-[0.6875rem] text-muted-foreground">{label}</dt>
                <dd className="truncate text-sm font-bold tabular-nums">{value}</dd>
            </div>
        </div>
    );
}

function PropertyGridCard({ property, currency }) {
    const { t, tOr, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds } = property;
    const rate = beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate);

    return (
        <article className="group/property flex flex-col overflow-hidden rounded-2xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-1 hover:shadow-(--overlay-shadow) hover:ring-brand-cyan/30 motion-reduce:hover:translate-y-0">
            <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                <PropertyCover src={property.coverImageUrl} className="transition-transform duration-700 group-hover/property:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-brand-navy/85 via-brand-navy/15 to-black/20" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {property.type ? (
                        <Badge className="border-white/25 bg-black/35 text-white backdrop-blur-md">
                            {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                        </Badge>
                    ) : (
                        <span />
                    )}
                    <PropertyActions property={property} onImage />
                </div>
                <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="w-fit rounded bg-white/15 px-1.5 py-0.5 font-mono text-[0.6875rem] tracking-tight backdrop-blur">{property.code}</span>
                        <h3 dir="auto" className="truncate font-heading text-lg font-bold" title={property.name}>
                            <Link href={route('properties.show', property.id)} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                                {property.name}
                            </Link>
                        </h3>
                        <p className="flex items-center gap-1.5 text-[0.8125rem] text-white/80">
                            <MapPinIcon className="size-3.5 shrink-0" />
                            <span dir="auto" className="truncate">{[property.area, property.city].filter(Boolean).join(', ') || '—'}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-center gap-4">
                    <RadialGauge value={beds.occupancyRate} size={76} thickness={8} label={`${t('properties.columns.occupancy')}: ${rate}`}>
                        <span className="text-sm font-bold tracking-tight">{rate}</span>
                    </RadialGauge>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[0.8125rem] font-medium text-muted-foreground">{t('properties.columns.occupancy')}</span>
                            <StatusBadge status={property.status} />
                        </div>
                        <BedBar beds={beds} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {t('properties.occupancy.beds', { occupied: beds.occupied, total: beds.total })}
                        </span>
                    </div>
                </div>

                <dl className="grid grid-cols-3 gap-2">
                    <Stat icon={DoorOpenIcon} tone="brand" label={t('properties.card.rooms')} value={formatNumber(property.rooms)} />
                    <Stat icon={BedDoubleIcon} tone="green" label={t('properties.card.beds')} value={formatNumber(beds.total)} />
                    <Stat icon={BanknoteIcon} tone="gold" label={t('properties.card.rentRoll')} value={formatCurrency(property.rentRoll, currency)} />
                </dl>

                <UnitOccupancyCounts units={property.unitOccupancy} />

                <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={route('properties.allocation', property.id)} />}
                    aria-label={`${t('properties.actions.allocation')}: ${property.name}`}
                    className="relative z-10 w-full"
                >
                    <LayoutPanelLeftIcon data-icon="inline-start" className="text-brand-ink" />
                    {t('properties.actions.allocation')}
                </Button>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <OwnershipBadge ownership={property.ownership} />
                        <LeaseNote property={property} />
                    </div>
                    <ComplianceBadge documents={property.documents} />
                </div>
            </div>
        </article>
    );
}

/**
 * The property list as picture cards, each with an occupancy ring, its
 * rooms, beds and rent roll, and its ownership and compliance.
 */
export default function PropertiesGrid({ properties, currency }) {
    return (
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5 lg:p-6 2xl:grid-cols-3">
            {properties.map((property) => (
                <PropertyGridCard key={property.id} property={property} currency={currency} />
            ))}
        </div>
    );
}
