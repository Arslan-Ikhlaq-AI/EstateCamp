import BedBar from '@/Components/BedBar';
import PropertyCover from '@/Components/PropertyCover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { MapPinIcon } from 'lucide-react';
import {
    ComplianceBadge,
    LeaseNote,
    OwnershipBadge,
    StatusBadge,
} from './PropertyBadges';
import PropertyActions from './PropertyActions';

function Stat({ label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

function PropertyGridCard({ property, currency }) {
    const { t, tOr, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds } = property;

    return (
        <article className="group/property flex flex-col overflow-hidden rounded-xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0">
            <div className="relative aspect-[2/1] overflow-hidden bg-muted">
                <PropertyCover
                    src={property.coverImageUrl}
                    className="transition-transform duration-500 group-hover/property:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/0 to-black/25" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {property.type ? (
                        <Badge
                            variant="outline"
                            className="border-white/30 bg-black/40 text-white backdrop-blur"
                        >
                            {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                        </Badge>
                    ) : (
                        <span />
                    )}
                    <PropertyActions property={property} onImage />
                </div>
                <span className="absolute start-3 bottom-2.5 font-mono text-[0.6875rem] tracking-wide text-white/90">
                    {property.code}
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col items-start gap-1">
                        <h3 dir="auto" className="max-w-full truncate font-heading text-base leading-snug font-semibold">
                            {property.name}
                        </h3>
                        <p className="flex max-w-full items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPinIcon className="size-3.5 shrink-0" />
                            <span dir="auto" className="truncate">
                                {[property.area, property.city].filter(Boolean).join(', ')}
                            </span>
                        </p>
                    </div>
                    <StatusBadge status={property.status} />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{t('properties.columns.occupancy')}</span>
                        <span className="font-semibold tabular-nums">
                            {beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                        </span>
                    </div>
                    <BedBar beds={beds} />
                </div>

                <dl className="grid grid-cols-3 gap-3">
                    <Stat label={t('properties.card.rooms')} value={formatNumber(property.rooms)} />
                    <Stat
                        label={t('properties.card.beds')}
                        value={`${formatNumber(beds.occupied)} / ${formatNumber(beds.total)}`}
                    />
                    <Stat
                        label={t('properties.card.rentRoll')}
                        value={formatCurrency(property.rentRoll, currency)}
                    />
                </dl>

                <Separator className="mt-auto" />

                <div className="flex flex-wrap items-center justify-between gap-2">
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
 * The property list as picture cards.
 */
export default function PropertiesGrid({ properties, currency }) {
    return (
        <div className="grid gap-4 p-4 sm:grid-cols-2 2xl:grid-cols-3">
            {properties.map((property) => (
                <PropertyGridCard key={property.id} property={property} currency={currency} />
            ))}
        </div>
    );
}
