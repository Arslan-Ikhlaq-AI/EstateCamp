import BedBar from '@/Components/BedBar';
import PropertyCover from '@/Components/PropertyCover';
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
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <span className="truncate text-sm font-semibold">{value}</span>
        </div>
    );
}

function PropertyCard({ property, currency }) {
    const { t, tOr, formatPercent, formatCurrency, formatDate } = useTranslation();
    const { beds } = property;

    return (
        <article className="group/property flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0">
            <div className="relative aspect-[16/8] overflow-hidden bg-muted">
                <PropertyCover
                    src={property.coverImageUrl}
                    className="transition-transform duration-500 group-hover/property:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/0 to-black/0" />
                {property.type && (
                    <Badge
                        variant="outline"
                        className="absolute start-3 top-3 border-white/30 bg-black/40 text-white backdrop-blur"
                    >
                        {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                    </Badge>
                )}
                <Badge
                    variant="outline"
                    className="absolute end-3 top-3 border-white/30 bg-black/40 text-white backdrop-blur"
                >
                    {t(`dashboard.portfolioSection.${property.ownership === 'leased' ? 'leased' : 'owned'}`)}
                </Badge>
                <span className="absolute start-3 bottom-2.5 font-mono text-[0.6875rem] tracking-wide text-white/85">
                    {property.code}
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-1">
                    <h3 className="font-heading text-base font-semibold leading-snug">
                        {property.name}
                    </h3>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {[property.area, property.city].filter(Boolean).join(', ')}
                        </span>
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                            {t('dashboard.portfolioSection.occupancy')}
                        </span>
                        <span className="font-semibold">
                            {beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                        </span>
                    </div>
                    <BedBar beds={beds} />
                </div>

                <div className="grid grid-cols-3 gap-3 border-t pt-3">
                    <Stat label={t('nav.rooms')} value={t('common.rooms', { count: property.rooms })} />
                    <Stat
                        label={t('dashboard.beds.occupied')}
                        value={`${beds.occupied} / ${beds.total}`}
                    />
                    <Stat
                        label={t('dashboard.portfolioSection.rentRoll')}
                        value={formatCurrency(property.rentRoll, currency)}
                    />
                </div>

                {property.leaseEndsOn && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClockIcon className="size-3.5" />
                        {t('dashboard.portfolioSection.leaseUntil', {
                            date: formatDate(property.leaseEndsOn),
                        })}
                    </p>
                )}
            </div>
        </article>
    );
}

export default function PropertiesOverview({ properties, currency, className }) {
    const { t } = useTranslation();

    return (
        <Card className={cn(className)}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.portfolioSection.title')}</CardTitle>
                <CardDescription>{t('dashboard.portfolioSection.description')}</CardDescription>
                <CardAction>
                    <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={route('properties.index')} />}
                    >
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
