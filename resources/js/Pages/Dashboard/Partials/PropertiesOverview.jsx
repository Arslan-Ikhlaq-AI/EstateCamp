import BedBar from '@/Components/BedBar';
import PropertyCover from '@/Components/PropertyCover';
import RadialGauge from '@/Components/RadialGauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, CalendarClockIcon, MapPinIcon } from 'lucide-react';

function Stat({ label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-bold">{value}</dd>
        </div>
    );
}

function PropertyCard({ property, currency }) {
    const { t, tOr, formatNumber, formatPercent, formatCurrency, formatDate } = useTranslation();
    const { beds } = property;

    return (
        <article className="group/property flex flex-col overflow-hidden rounded-2xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0">
            <div className="relative aspect-[16/7] overflow-hidden bg-muted">
                <PropertyCover src={property.coverImageUrl} className="transition-transform duration-700 group-hover/property:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-brand-navy/75 via-brand-navy/10 to-transparent" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {property.type ? (
                        <Badge className="border-white/25 bg-black/35 text-white backdrop-blur-md">
                            {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                        </Badge>
                    ) : (
                        <span />
                    )}
                    <Badge className="border-white/25 bg-white/90 text-brand-navy">
                        {t(`dashboard.portfolioSection.${property.ownership === 'leased' ? 'leased' : 'owned'}`)}
                    </Badge>
                </div>
                <div className="absolute inset-x-4 bottom-3 flex flex-col gap-0.5 text-white">
                    <h3 dir="auto" className="truncate font-heading text-lg font-bold">{property.name}</h3>
                    <p className="flex items-center gap-1.5 text-[0.8125rem] text-white/80">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        <span dir="auto" className="truncate">{[property.area, property.city].filter(Boolean).join(', ')}</span>
                    </p>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center gap-4">
                    <RadialGauge
                        value={beds.occupancyRate}
                        size={88}
                        thickness={9}
                        label={`${t('dashboard.portfolioSection.occupancy')}: ${beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}`}
                    >
                        <span className="text-base font-bold tracking-tight">
                            {beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                        </span>
                    </RadialGauge>
                    <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
                        <Stat label={t('dashboard.beds.occupied')} value={`${formatNumber(beds.occupied)} / ${formatNumber(beds.total)}`} />
                        <Stat label={t('dashboard.beds.available')} value={formatNumber(beds.available)} />
                        <Stat label={t('nav.rooms')} value={formatNumber(property.rooms)} />
                        <Stat label={t('dashboard.portfolioSection.rentRoll')} value={formatCurrency(property.rentRoll, currency)} />
                    </dl>
                </div>

                <BedBar beds={beds} />

                {property.leaseEndsOn && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClockIcon className="size-3.5" />
                        {t('dashboard.portfolioSection.leaseUntil', { date: formatDate(property.leaseEndsOn) })}
                    </p>
                )}
            </div>
        </article>
    );
}

/**
 * Each property with its picture, an occupancy gauge, its beds and rent roll.
 */
export default function PropertiesOverview({ properties, currency, className }) {
    const { t } = useTranslation();

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>{t('dashboard.portfolioSection.title')}</CardTitle>
                <CardDescription>{t('dashboard.portfolioSection.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('properties.index')} />}>
                        {t('nav.allProperties')}
                        <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                {properties.map((property) => (
                    <PropertyCard key={property.id} property={property} currency={currency} />
                ))}
            </CardContent>
        </Card>
    );
}
