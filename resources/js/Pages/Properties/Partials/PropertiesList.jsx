import RoomBar from '@/Components/RoomBar';
import PropertyCover from '@/Components/PropertyCover';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { MapPinIcon } from 'lucide-react';
import { FIGURE_COLUMNS, PropertyFigure } from './PropertiesGrid';
import { ComplianceBadge, OwnershipBadge, StatusBadge } from './PropertyBadges';
import PropertyActions from './PropertyActions';
import PropertyQuickLinks from './PropertyQuickLinks';
import UnitOccupancyCounts from './UnitOccupancy';

function PropertyRow({ property, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const occupancy = property.roomOccupancy;
    const location = [property.area, property.city].filter(Boolean).join(', ');

    return (
        <li className="flex flex-col gap-3.5 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                    <PropertyCover src={property.coverImageUrl} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                        <Link
                            href={route('properties.show', property.id)}
                            dir="auto"
                            className="min-w-0 truncate pt-0.5 text-[0.9375rem] leading-tight font-semibold outline-none hover:text-brand-ink focus-visible:underline"
                            title={property.name}
                        >
                            {property.name}
                        </Link>
                        <div className="-me-1 -mt-1">
                            <PropertyActions property={property} />
                        </div>
                    </div>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="shrink-0 rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold tracking-tight text-brand-ink">
                            {property.code}
                        </span>
                        <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0 text-gold" />
                        <span dir="auto" className="truncate">
                            {location || '—'}
                        </span>
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={property.status} />
                        <OwnershipBadge ownership={property.ownership} />
                        <ComplianceBadge documents={property.documents} />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl bg-muted/50 py-3">
                <dl className={FIGURE_COLUMNS}>
                    <PropertyFigure
                        label={t('properties.columns.occupancy')}
                        value={occupancy.occupancyRate === null ? '—' : formatPercent(occupancy.occupancyRate)}
                    />
                    <PropertyFigure label={t('properties.card.vacant')} value={formatNumber(occupancy.available)} />
                    <PropertyFigure label={t('properties.card.rentRoll')} value={formatCurrency(property.rentRoll, currency)} />
                </dl>
                <div className="flex flex-col gap-2 px-3">
                    <div className="flex items-center gap-2.5">
                        <RoomBar rooms={occupancy} className="flex-1" />
                        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                            {occupancy.total === 0
                                ? t('properties.occupancy.noRooms')
                                : t('properties.occupancy.rooms', { occupied: occupancy.occupied, total: occupancy.total })}
                        </span>
                    </div>
                    <UnitOccupancyCounts units={property.unitOccupancy} />
                </div>
            </div>

            <PropertyQuickLinks property={property} className="overflow-hidden rounded-lg bg-surface ring-1 ring-border" />
        </li>
    );
}

/**
 * The property list as simple rows for screens too narrow for the table:
 * picture, name, code and place, its badges, occupancy, vacant rooms and
 * rent roll, its units, and links to the pages it is run from.
 */
export default function PropertiesList({ properties, currency, className }) {
    return (
        <ul className={cn('divide-y', className)}>
            {properties.map((property) => (
                <PropertyRow key={property.id} property={property} currency={currency} />
            ))}
        </ul>
    );
}
