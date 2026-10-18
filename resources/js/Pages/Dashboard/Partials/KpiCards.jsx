import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import {
    BanknoteIcon,
    HandCoinsIcon,
    PercentIcon,
    ReceiptTextIcon,
} from 'lucide-react';

/**
 * The dashboard's headline figures, each linking to the page behind it:
 * occupancy, the rent roll against its potential, this month's collections
 * and what clients still owe.
 */
export default function KpiCards({ summary, finance, currency }) {
    const { t, formatPercent, formatCurrency } = useTranslation();
    const { beds } = summary;
    const money = (value) => formatCurrency(value, currency);
    const rentShare = summary.potentialRent > 0 ? (summary.rentRoll / summary.potentialRent) * 100 : 0;
    const collectedShare = finance.invoicedThisMonth > 0 ? Math.min((finance.collectedThisMonth / finance.invoicedThisMonth) * 100, 100) : undefined;

    return (
        <section aria-label={t('dashboard.title')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                href={route('rooms.index')}
                icon={PercentIcon}
                label={t('dashboard.kpi.occupancy')}
                value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                meter={beds.occupancyRate ?? 0}
                detail={t('dashboard.kpi.occupancyDetail', { occupied: beds.occupied, total: beds.occupied + beds.available })}
            />
            <StatCard
                href={route('properties.index')}
                icon={BanknoteIcon}
                tone="gold"
                label={t('dashboard.kpi.rentRoll')}
                value={money(summary.rentRoll)}
                meter={rentShare}
                detail={t('dashboard.kpi.rentRollDetail', { percent: formatPercent(rentShare), potential: money(summary.potentialRent) })}
            />
            <StatCard
                href={route('payments.index')}
                icon={HandCoinsIcon}
                tone="success"
                label={t('dashboard.kpi.collected')}
                value={money(finance.collectedThisMonth)}
                meter={collectedShare}
                detail={t('dashboard.kpi.collectedDetail', { amount: money(finance.invoicedThisMonth) })}
            />
            <StatCard
                href={route('invoices.index')}
                icon={ReceiptTextIcon}
                tone={finance.overdue.count > 0 ? 'warning' : 'primary'}
                label={t('dashboard.kpi.outstanding')}
                value={money(finance.outstanding)}
                detail={
                    finance.overdue.count > 0
                        ? t('dashboard.kpi.overdueDetail', { amount: money(finance.overdue.amount), count: finance.overdue.count })
                        : t('dashboard.kpi.nothingOverdue')
                }
            />
        </section>
    );
}
