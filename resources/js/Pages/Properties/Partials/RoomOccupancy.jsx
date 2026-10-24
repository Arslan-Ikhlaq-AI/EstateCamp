import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * Room fill levels in display order, read like a traffic light: full rooms
 * green, partly filled gold, empty red.
 */
export const ROOM_SEGMENTS = [
    { key: 'full', swatch: 'bg-success', chip: 'bg-success/12 text-success' },
    { key: 'partial', swatch: 'bg-gold', chip: 'bg-gold/20 text-gold-ink' },
    { key: 'empty', swatch: 'bg-destructive', chip: 'bg-destructive/10 text-destructive' },
];

const roomTotal = (rooms) => rooms.full + rooms.partial + rooms.empty;

/**
 * A stacked bar of full, partial and empty rooms. The counts are always
 * shown as text nearby too, so colour never carries them alone.
 */
export function RoomOccupancyBar({ rooms, className }) {
    const { t } = useTranslation();
    const total = roomTotal(rooms);

    if (total === 0) {
        return <div className={cn('h-2.5 rounded-full bg-muted', className)} />;
    }

    return (
        <div
            role="img"
            aria-label={t('properties.roomOccupancy.summary', rooms)}
            className={cn('flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full', className)}
        >
            {ROOM_SEGMENTS.filter(({ key }) => rooms[key] > 0).map(({ key, swatch }) => (
                <span key={key} className={cn('h-full min-w-1', swatch)} style={{ width: `${(rooms[key] / total) * 100}%` }} />
            ))}
        </div>
    );
}

/**
 * The legend for room bars, with each fill level's count beside its swatch.
 */
export function RoomOccupancyLegend({ rooms, className }) {
    const { t, formatNumber } = useTranslation();

    return (
        <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
            {ROOM_SEGMENTS.map(({ key, swatch }) => (
                <li key={key} className="flex items-center gap-1.5 text-[0.875rem]">
                    <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', swatch)} />
                    <span className="text-muted-foreground">{t(`properties.roomOccupancy.${key}`)}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(rooms[key])}</span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A property's full, partial and empty room counts as coloured chips; a
 * level with no rooms is greyed out.
 */
export default function RoomOccupancyCounts({ rooms, className }) {
    const { t, formatNumber } = useTranslation();

    if (roomTotal(rooms) === 0) {
        return <span className="text-xs text-muted-foreground">{t('properties.roomOccupancy.none')}</span>;
    }

    return (
        <ul className={cn('flex flex-wrap gap-1.5', className)}>
            {ROOM_SEGMENTS.map(({ key, chip }) => (
                <li
                    key={key}
                    className={cn(
                        'inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap',
                        rooms[key] > 0 ? chip : 'bg-muted text-muted-foreground',
                    )}
                >
                    <span className="font-bold tabular-nums">{formatNumber(rooms[key])}</span>
                    {t(`properties.roomOccupancy.${key}`)}
                </li>
            ))}
        </ul>
    );
}
