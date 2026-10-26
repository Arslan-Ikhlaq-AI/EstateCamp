import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * Unit fill levels in display order, read like a traffic light: full units
 * green, rooms with free beds gold, empty units red.
 */
export const UNIT_SEGMENTS = [
    { key: 'full', swatch: 'bg-success', chip: 'bg-success/12 text-success' },
    { key: 'free', swatch: 'bg-gold', chip: 'bg-gold/20 text-gold-ink' },
    { key: 'empty', swatch: 'bg-destructive', chip: 'bg-destructive/10 text-destructive' },
];

const unitTotal = (units) => units.full + units.free + units.empty;

/**
 * A stacked bar of full, free and empty units. The counts are always shown
 * as text nearby too, so colour never carries them alone.
 */
export function UnitOccupancyBar({ units, className }) {
    const { t } = useTranslation();
    const total = unitTotal(units);

    if (total === 0) {
        return <div className={cn('h-2.5 rounded-full bg-muted', className)} />;
    }

    return (
        <div
            role="img"
            aria-label={t('properties.unitOccupancy.summary', units)}
            className={cn('flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full', className)}
        >
            {UNIT_SEGMENTS.filter(({ key }) => units[key] > 0).map(({ key, swatch }) => (
                <span key={key} className={cn('h-full min-w-1', swatch)} style={{ width: `${(units[key] / total) * 100}%` }} />
            ))}
        </div>
    );
}

/**
 * The legend for unit bars, with each fill level's count beside its swatch.
 */
export function UnitOccupancyLegend({ units, className }) {
    const { t, formatNumber } = useTranslation();

    return (
        <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
            {UNIT_SEGMENTS.map(({ key, swatch }) => (
                <li key={key} className="flex items-center gap-1.5 text-[0.875rem]">
                    <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', swatch)} />
                    <span className="text-muted-foreground">{t(`properties.unitOccupancy.${key}`)}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(units[key])}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A property's full, free and empty unit counts as coloured chips; a level
 * with no units is greyed out.
 */
export default function UnitOccupancyCounts({ units, className }) {
    const { t, formatNumber } = useTranslation();

    if (unitTotal(units) === 0) {
        return <span className="text-xs text-muted-foreground">{t('properties.unitOccupancy.none')}</span>;
    }

    return (
        <ul className={cn('flex flex-wrap gap-1.5', className)}>
            {UNIT_SEGMENTS.map(({ key, chip }) => (
                <li
                    key={key}
                    className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap',
                        units[key] > 0 ? chip : 'bg-muted text-muted-foreground',
                    )}
                >
                    <span className="font-bold tabular-nums">{formatNumber(units[key])}</span>
                    {t(`properties.unitOccupancy.${key}`)}
                </li>
            ))}
        </ul>
    );
}
