import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';

/**
 * How a figure moved against the previous period, as a small badge. A rise
 * reads as good unless `isGoodWhenUp` is false (such as money out).
 * `compact` leaves out the period's name, for a column already headed by it.
 */
export default function ChangeBadge({ current, previous, isGoodWhenUp = true, previousLabel, compact = false }) {
    const { t, formatPercent } = useTranslation();

    if (previous === null || previous === undefined) {
        return null;
    }

    if (previous === 0) {
        return current === 0 ? null : <span className="text-xs text-muted-foreground">{compact ? t('reports.common.new') : t('finance.overview.stats.newVs', { period: previousLabel })}</span>;
    }

    const change = ((current - previous) / Math.abs(previous)) * 100;
    const isUp = change >= 0;
    const Icon = isUp ? ArrowUpRightIcon : ArrowDownRightIcon;
    const isGood = isUp === isGoodWhenUp;

    return (
        <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', Math.abs(change) < 0.5 ? 'text-muted-foreground' : isGood ? 'text-success' : 'text-warning')}>
            <Icon className="size-3.5 rtl:-scale-x-100" />
            {formatPercent(Math.abs(change))}
            {!compact && <span className="font-normal text-muted-foreground">{t('finance.overview.stats.vs', { period: previousLabel })}</span>}
        </span>
    );
}
