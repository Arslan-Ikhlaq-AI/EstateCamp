import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import { BanknoteIcon, BedDoubleIcon, Building2Icon, LayoutGridIcon } from 'lucide-react';
import { UnitOccupancyBar, UnitOccupancyLegend } from './UnitOccupancy';

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
