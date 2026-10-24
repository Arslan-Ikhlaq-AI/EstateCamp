import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import { BanknoteIcon, BedDoubleIcon, Building2Icon, DoorOpenIcon } from 'lucide-react';
import { RoomOccupancyBar, RoomOccupancyLegend } from './RoomOccupancy';

/**
 * Headline figures for the whole portfolio, unaffected by the list filters.
 */
export default function PortfolioStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds } = summary;

    return (
        <section
            aria-label={t('properties.stats.label')}
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        >
            <StatCard
                icon={Building2Icon}
                label={t('properties.stats.properties')}
                value={formatNumber(summary.properties)}
                detail={t('properties.stats.propertiesDetail', {
                    active: summary.active,
                    owned: summary.owned,
                    leased: summary.leased,
                })}
            />
            <StatCard icon={DoorOpenIcon} tone="violet" label={t('properties.stats.rooms')} value={formatNumber(summary.rooms)}>
                <RoomOccupancyBar rooms={summary.roomOccupancy} />
                <RoomOccupancyLegend rooms={summary.roomOccupancy} />
            </StatCard>
            <StatCard
                icon={BedDoubleIcon}
                tone="success"
                label={t('properties.stats.occupancy')}
                value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                meter={beds.occupancyRate ?? 0}
                detail={t('properties.stats.occupancyDetail', {
                    occupied: beds.occupied,
                    total: beds.occupied + beds.available,
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
