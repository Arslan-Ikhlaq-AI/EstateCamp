import StatCard from '@/Components/StatCard';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ClockIcon, HandCoinsIcon, PiggyBankIcon, WalletIcon } from 'lucide-react';

/**
 * Received, settled, still in hand and still to collect. Received less
 * settled is what is in hand. Extra income is only saved once received, so
 * it leaves out what is still to collect.
 */
export default function MoneyStats({ figures, currency, withToCollect = true }) {
    const { t, formatCurrency } = useTranslation();

    return (
        <section aria-label={t('extraPayments.stats.label')} className={cn('grid grid-cols-2 gap-3 sm:gap-4', withToCollect ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
            <StatCard
                icon={WalletIcon}
                tone="success"
                label={t('extraPayments.stats.received')}
                value={formatCurrency(figures.received, currency)}
                detail={t('extraPayments.stats.receivedDetail', { count: figures.receivedCount })}
            />
            <StatCard
                icon={HandCoinsIcon}
                tone="violet"
                label={t('extraPayments.stats.settled')}
                value={formatCurrency(figures.settled, currency)}
                detail={t('extraPayments.stats.settledDetail', { count: figures.settledCount, part: figures.partCount })}
            />
            <StatCard
                icon={PiggyBankIcon}
                tone="gold"
                label={t('extraPayments.stats.remaining')}
                value={formatCurrency(figures.remaining, currency)}
                detail={t('extraPayments.stats.remainingDetail', { count: figures.heldCount + figures.partCount })}
            />
            {withToCollect && (
                <StatCard
                    icon={ClockIcon}
                    label={t('extraPayments.stats.toCollect')}
                    value={formatCurrency(figures.toCollect, currency)}
                    detail={t('extraPayments.stats.toCollectDetail', { count: figures.toCollectCount })}
                />
            )}
        </section>
    );
}
