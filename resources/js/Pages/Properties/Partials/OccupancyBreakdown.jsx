import DonutChart, { DonutLegend } from '@/Components/DonutChart';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, BedDoubleIcon, DoorOpenIcon, HouseIcon, StoreIcon } from 'lucide-react';

/**
 * Rooms read like a traffic light, as on the property list: full green,
 * partly filled gold, empty red.
 */
const ROOM_SEGMENTS = [
    { key: 'full', color: 'var(--success)' },
    { key: 'partial', color: 'var(--gold)' },
    { key: 'empty', color: 'var(--destructive)' },
];

/**
 * Beds keep the colours of the bed bars on the dashboard.
 */
const BED_SEGMENTS = [
    { key: 'occupied', color: 'var(--chart-1)' },
    { key: 'available', color: 'var(--chart-2)' },
    { key: 'outOfService', color: 'var(--chart-3)' },
];

/**
 * Shop and apartment statuses: let green, held blue, vacant red like an
 * empty room, being repaired amber and out of use grey.
 */
const UNIT_STATUS_SEGMENTS = [
    { key: 'occupied', color: 'var(--success)' },
    { key: 'reserved', color: 'var(--chart-1)' },
    { key: 'vacant', color: 'var(--destructive)' },
    { key: 'under_maintenance', color: 'var(--warning)' },
    { key: 'inactive', color: 'var(--chart-3)' },
];

const DONUT_SIZE = 136;

/**
 * One kind of unit: a donut of its counts with the total in the middle, and
 * a legend naming every count, zeros included, so nothing rests on colour.
 * With no units of the kind, an empty ring stands in for the donut.
 */
function UnitPanel({ icon: Icon, title, total, segments, href, linkLabel }) {
    const { t, formatNumber, formatPercent } = useTranslation();
    const label = `${title}: ${segments.map((segment) => `${segment.label} ${formatNumber(segment.value)}`).join(', ')}`;
    const hole = (
        <>
            <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatNumber(total)}</span>
            <span className="text-xs text-muted-foreground">{t('propertyShow.occupancy.total')}</span>
        </>
    );

    return (
        <section aria-label={title} className="@container/panel flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/[0.08]">
            <header className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary dark:bg-primary/20 dark:text-brand-cyan">
                    <Icon className="size-4" />
                </span>
                <h3 className="min-w-0 flex-1 truncate font-heading text-[0.9375rem] font-semibold">{title}</h3>
                <Button variant="ghost" size="icon-sm" nativeButton={false} aria-label={linkLabel} render={<Link href={href} />}>
                    <ArrowRightIcon className="rtl:rotate-180" />
                </Button>
            </header>
            <div className="flex flex-col items-center gap-5 @sm/panel:flex-row">
                {total > 0 ? (
                    <DonutChart segments={segments} label={label} size={DONUT_SIZE} valueFormatter={formatNumber}>
                        {hole}
                    </DonutChart>
                ) : (
                    <div
                        role="img"
                        aria-label={label}
                        className="flex shrink-0 flex-col items-center justify-center rounded-full border-[22px] border-muted text-center"
                        style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
                    >
                        {hole}
                    </div>
                )}
                <DonutLegend segments={segments} total={total} valueFormatter={formatNumber} formatShare={formatPercent} />
            </div>
        </section>
    );
}

/**
 * Every room, bed, shop and apartment in the property, each kind counted
 * explicitly: rooms full, partial and empty; beds occupied, free and out of
 * service; shops and apartments by status. Each panel links to its list,
 * filtered to the property.
 */
export default function OccupancyBreakdown({ property }) {
    const { t } = useTranslation();
    const { rooms, shops, apartments } = property.occupancy;
    const { beds } = property;
    const filter = { properties: [property.code] };
    const unitSegments = (units, statusKey) =>
        UNIT_STATUS_SEGMENTS.map((segment) => ({ ...segment, label: t(`${statusKey}.${segment.key}`), value: units[segment.key] }));

    return (
        <div className="@container">
            <div className="grid gap-4 @3xl:grid-cols-2">
                <UnitPanel
                    icon={DoorOpenIcon}
                    title={t('propertyShow.occupancy.rooms.title')}
                    total={rooms.total}
                    segments={ROOM_SEGMENTS.map((segment) => ({ ...segment, label: t(`propertyShow.occupancy.rooms.${segment.key}`), value: rooms[segment.key] }))}
                    href={route('rooms.index', filter)}
                    linkLabel={t('propertyShow.occupancy.rooms.view')}
                />
                <UnitPanel
                    icon={BedDoubleIcon}
                    title={t('propertyShow.occupancy.beds.title')}
                    total={beds.total}
                    segments={BED_SEGMENTS.map((segment) => ({ ...segment, label: t(`dashboard.beds.${segment.key}`), value: beds[segment.key] }))}
                    href={route('rooms.index', filter)}
                    linkLabel={t('propertyShow.occupancy.rooms.view')}
                />
                <UnitPanel
                    icon={StoreIcon}
                    title={t('propertyShow.occupancy.shops.title')}
                    total={shops.total}
                    segments={unitSegments(shops, 'shopStatus')}
                    href={route('shops.index', filter)}
                    linkLabel={t('propertyShow.occupancy.shops.view')}
                />
                <UnitPanel
                    icon={HouseIcon}
                    title={t('propertyShow.occupancy.apartments.title')}
                    total={apartments.total}
                    segments={unitSegments(apartments, 'apartmentStatus')}
                    href={route('apartments.index', filter)}
                    linkLabel={t('propertyShow.occupancy.apartments.view')}
                />
            </div>
        </div>
    );
}
