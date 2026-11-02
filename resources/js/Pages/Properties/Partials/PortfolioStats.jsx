import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BanknoteIcon, Building2Icon, DoorOpenIcon, LayoutGridIcon } from 'lucide-react';
import { UnitOccupancyBar, UnitOccupancyLegend } from './UnitOccupancy';

const OWNERSHIP_SEGMENTS = [
    { key: 'owned', swatch: 'bg-chart-1' },
    { key: 'leased', swatch: 'bg-gold' },
    { key: 'unknown', swatch: 'bg-chart-3' },
];

/**
 * How many properties are owned and how many leased, as a split bar with
 * its legend. Properties with no ownership set show only when there are any.
 */
function OwnershipSplit({ summary }) {
    const { t, formatNumber } = useTranslation();
    const counts = {
        owned: summary.owned,
        leased: summary.leased,
        unknown: summary.properties - summary.owned - summary.leased,
    };
    const segments = OWNERSHIP_SEGMENTS.filter(({ key }) => counts[key] > 0);

    if (segments.length === 0) {
        return <div className="h-2.5 rounded-full bg-muted" />;
    }

    return (
        <>
            <div aria-hidden="true" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
                {segments.map(({ key, swatch }) => (
                    <span key={key} className={cn('h-full min-w-1', swatch)} style={{ width: `${(counts[key] / summary.properties) * 100}%` }} />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                {segments.map(({ key, swatch }) => (
                    <li key={key} className="flex items-center gap-1.5 text-[0.875rem]">
                        <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', swatch)} />
                        <span className="text-muted-foreground">{t(`properties.ownership.${key}`)}</span>
                        <span className="font-semibold tabular-nums">{formatNumber(counts[key])}</span>
                    </li>
                ))}
            </ul>
        </>
    );
}

/**
 * Headline figures for the whole portfolio, unaffected by the list filters.
 */
export default function PortfolioStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const occupancy = summary.roomOccupancy;

    return (
        <section
            aria-label={t('properties.stats.label')}
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        >
            <StatCard
                icon={Building2Icon}
                label={t('properties.stats.properties')}
                value={formatNumber(summary.properties)}
                detail={t('properties.stats.propertiesDetail', { active: summary.active })}
            >
                <OwnershipSplit summary={summary} />
            </StatCard>
            <StatCard
                icon={LayoutGridIcon}
                tone="violet"
                label={t('properties.stats.units')}
                value={formatNumber(summary.rooms + summary.shops + summary.apartments)}
                detail={['rooms', 'shops', 'apartments']
                    .map((kind) => t(`properties.stats.${kind}`, { count: summary[kind] }))
                    .join(' · ')}
            >
                <UnitOccupancyBar units={summary.unitOccupancy} />
                <UnitOccupancyLegend units={summary.unitOccupancy} />
            </StatCard>
            <StatCard
                icon={DoorOpenIcon}
                tone="success"
                label={t('properties.stats.occupancy')}
                value={occupancy.occupancyRate === null ? '—' : formatPercent(occupancy.occupancyRate)}
                meter={occupancy.occupancyRate ?? 0}
                detail={t('properties.stats.occupancyDetail', {
                    occupied: occupancy.occupied,
                    total: occupancy.occupied + occupancy.available,
                })}
            />
            <StatCard
                icon={BanknoteIcon}
                tone="gold"
                label={t('properties.stats.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                detail={t('properties.stats.rentRollDetail', { count: summary.rooms })}
            />
        </section>
    );
}
