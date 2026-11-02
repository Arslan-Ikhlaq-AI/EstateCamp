import RoomBar from '@/Components/RoomBar';
import PropertyCover from '@/Components/PropertyCover';
import RadialGauge from '@/Components/RadialGauge';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { MapPinIcon } from 'lucide-react';
import { ComplianceBadge, LeaseNote, OwnershipBadge, StatusBadge } from './PropertyBadges';
import PropertyActions from './PropertyActions';
import PropertyQuickLinks from './PropertyQuickLinks';
import UnitOccupancyCounts from './UnitOccupancy';

/**
 * Columns for a strip of three figures; the last, a sum of money, gets
 * the most room.
 */
export const FIGURE_COLUMNS = 'grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.6fr)] divide-x divide-foreground/[0.08] rtl:divide-x-reverse';

/**
 * One labelled figure in a strip of figures split by dividers.
 */
export function PropertyFigure({ label, value, className }) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-0.5 px-3', className)}>
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate font-heading text-[0.9375rem] font-bold tabular-nums" title={String(value)}>
                {value}
            </dd>
        </div>
    );
}

function Detail({ label, children }) {
    return (
        <div className="flex min-h-10 items-center justify-between gap-3 py-1.5">
            <dt className="shrink-0 text-[0.8125rem] font-medium text-muted-foreground">{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">{children}</dd>
        </div>
    );
}

function PropertyGridCard({ property, currency }) {
    const { t, tOr, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const occupancy = property.roomOccupancy;
    const rate = occupancy.occupancyRate === null ? '—' : formatPercent(occupancy.occupancyRate);
    const location = [property.area, property.city].filter(Boolean).join(', ');

    return (
        <article className="group/property flex flex-col overflow-hidden rounded-2xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0">
            {/* The cover and the name open the property; the stretched link covers both. */}
            <div className="relative">
                <div className="relative aspect-[16/7] overflow-hidden bg-muted">
                    <PropertyCover src={property.coverImageUrl} className="transition-transform duration-700 group-hover/property:scale-105 motion-reduce:transform-none" />
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                        {property.type ? (
                            <Badge className="border-white/20 bg-black/40 text-white backdrop-blur-md">
                                {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                            </Badge>
                        ) : (
                            <span />
                        )}
                        <div className="relative z-10">
                            <PropertyActions property={property} onImage />
                        </div>
                    </div>
                </div>

                <header className="flex flex-col gap-1 px-4 pt-4 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold tracking-tight text-brand-ink">
                            {property.code}
                        </span>
                        <StatusBadge status={property.status} />
                    </div>
                    <h3 dir="auto" className="truncate font-heading text-[1.0625rem] leading-snug font-bold" title={property.name}>
                        <Link
                            href={route('properties.show', property.id)}
                            className="outline-none group-hover/property:text-brand-ink after:absolute after:inset-0 after:rounded-t-2xl focus-visible:underline"
                        >
                            {property.name}
                        </Link>
                    </h3>
                    <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                        <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0 text-gold" />
                        <span dir="auto" className="truncate" title={property.address ?? undefined}>
                            {location || '—'}
                        </span>
                    </p>
                </header>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4 sm:px-5">
                <div className="flex items-center gap-3.5">
                    <RadialGauge value={occupancy.occupancyRate} size={60} thickness={6} label={`${t('properties.columns.occupancy')}: ${rate}`}>
                        <span className="text-[0.8125rem] font-bold tracking-tight tabular-nums">{rate}</span>
                    </RadialGauge>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[0.8125rem] font-medium text-muted-foreground">{t('properties.columns.occupancy')}</span>
                            <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
                                {occupancy.total === 0
                                    ? t('properties.occupancy.noRooms')
                                    : t('properties.occupancy.rooms', { occupied: occupancy.occupied, total: occupancy.total })}
                            </span>
                        </div>
                        <RoomBar rooms={occupancy} />
                    </div>
                </div>

                <dl className={cn(FIGURE_COLUMNS, 'rounded-xl bg-muted/50 py-2.5')}>
                    <PropertyFigure label={t('properties.card.rooms')} value={formatNumber(property.rooms)} />
                    <PropertyFigure label={t('properties.card.vacant')} value={formatNumber(occupancy.available)} />
                    <PropertyFigure label={t('properties.card.rentRoll')} value={formatCurrency(property.rentRoll, currency)} />
                </dl>

                <dl className="mt-auto -mb-1.5 flex flex-col divide-y divide-foreground/[0.06]">
                    <Detail label={t('properties.columns.units')}>
                        <UnitOccupancyCounts units={property.unitOccupancy} className="justify-end" />
                    </Detail>
                    <Detail label={t('properties.columns.ownership')}>
                        <OwnershipBadge ownership={property.ownership} />
                        <LeaseNote property={property} />
                    </Detail>
                    <Detail label={t('properties.columns.compliance')}>
                        <ComplianceBadge documents={property.documents} />
                    </Detail>
                </dl>
            </div>

            <PropertyQuickLinks property={property} className="border-t bg-muted/30" />
        </article>
    );
}

/**
 * The property list as picture cards: occupancy as a ring and a room bar,
 * its rooms, vacant rooms and rent roll, its units, ownership and
 * compliance, and a bar of links to the pages it is run from.
 */
export default function PropertiesGrid({ properties, currency }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4 p-4 sm:gap-5 sm:p-5 lg:p-6">
            {properties.map((property) => (
                <PropertyGridCard key={property.id} property={property} currency={currency} />
            ))}
        </div>
    );
}
