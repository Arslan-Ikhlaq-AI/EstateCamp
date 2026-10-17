import StatCard from '@/Components/StatCard';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import {
    BanknoteIcon,
    BedDoubleIcon,
    FileClockIcon,
    PercentIcon,
} from 'lucide-react';

/**
 * The dashboard's headline figures: occupancy, free beds, the rent roll
 * against its potential, and documents about to expire.
 */
export default function KpiCards({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds, documents } = summary;

    const rentShare = summary.potentialRent > 0 ? (summary.rentRoll / summary.potentialRent) * 100 : 0;

    return (
        <section aria-label={t('dashboard.title')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={PercentIcon}
                label={t('dashboard.kpi.occupancy')}
                value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                meter={beds.occupancyRate ?? 0}
                detail={t('dashboard.kpi.occupancyDetail', {
                    occupied: beds.occupied,
                    total: beds.occupied + beds.available,
                })}
            />
            <StatCard
                icon={BedDoubleIcon}
                tone={beds.available > 0 ? 'success' : 'primary'}
                label={t('dashboard.kpi.availableBeds')}
                value={formatNumber(beds.available)}
                detail={t('dashboard.kpi.availableDetail')}
                badge={
                    beds.outOfService > 0 && (
                        <Badge variant="secondary">{t('dashboard.kpi.outOfService', { count: beds.outOfService })}</Badge>
                    )
                }
            />
            <StatCard
                icon={BanknoteIcon}
                label={t('dashboard.kpi.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                meter={rentShare}
                detail={t('dashboard.kpi.rentRollDetail', {
                    percent: formatPercent(rentShare),
                    potential: formatCurrency(summary.potentialRent, currency),
                })}
            />
            <StatCard
                icon={FileClockIcon}
                tone={documents.expired > 0 || documents.expiring > 0 ? 'warning' : 'primary'}
                label={t('dashboard.kpi.expiringDocuments')}
                value={formatNumber(documents.expiring)}
                detail={t('dashboard.kpi.expiringDetail', { total: documents.total })}
                badge={
                    documents.expired > 0 && (
                        <Badge variant="destructive">
                            {documents.expired} {t('status.expired')}
                        </Badge>
                    )
                }
            />
        </section>
    );
}
