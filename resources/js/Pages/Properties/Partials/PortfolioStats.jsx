import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import {
    BanknoteIcon,
    BedDoubleIcon,
    Building2Icon,
    ShieldAlertIcon,
    ShieldCheckIcon,
} from 'lucide-react';

/**
 * Headline figures for the whole portfolio, unaffected by the list filters.
 */
export default function PortfolioStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds } = summary;
    const attentionCount = summary.documentsNeedingAttention + summary.leasesEndingSoon;

    const attentionDetail =
        attentionCount === 0
            ? t('properties.stats.allClear')
            : [
                  summary.documentsNeedingAttention > 0 &&
                      t('properties.stats.documents', { count: summary.documentsNeedingAttention }),
                  summary.leasesEndingSoon > 0 &&
                      t('properties.stats.leases', { count: summary.leasesEndingSoon }),
              ]
                  .filter(Boolean)
                  .join(' · ');

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
                icon={BedDoubleIcon}
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
                label={t('properties.stats.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                detail={t('properties.stats.rentRollDetail', { count: summary.rooms })}
            />
            <StatCard
                icon={attentionCount > 0 ? ShieldAlertIcon : ShieldCheckIcon}
                tone={attentionCount > 0 ? 'warning' : 'success'}
                label={t('properties.stats.attention')}
                value={formatNumber(attentionCount)}
                detail={attentionDetail}
            />
        </section>
    );
}
