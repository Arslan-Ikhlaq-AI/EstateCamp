import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * Room states in stacking order. The colours come from the validated chart
 * ramp: occupied is the accent, vacant a lighter step of the same hue, out
 * of service a neutral grey.
 */
export const ROOM_SEGMENTS = [
    { key: 'occupied', swatch: 'bg-chart-1' },
    { key: 'available', swatch: 'bg-chart-2' },
    { key: 'outOfService', swatch: 'bg-chart-3' },
];

/**
 * A stacked bar of occupied, vacant and out-of-service rooms. Segments are
 * separated by a 2px surface gap and reveal their count on hover; the counts
 * are always shown as text nearby too, so colour never carries them alone.
 */
export default function RoomBar({ rooms, className }) {
    const { t } = useTranslation();

    const label = ROOM_SEGMENTS.map(({ key }) =>
        t('dashboard.roomStates.segment', {
            label: t(`dashboard.roomStates.${key}`),
            count: rooms[key],
        }),
    ).join(', ');

    if (rooms.total === 0) {
        return <div className={cn('h-2.5 rounded-e-[4px] bg-muted', className)} />;
    }

    return (
        <div role="img" aria-label={label} className={cn('flex w-full gap-0.5', className)}>
            {ROOM_SEGMENTS.filter(({ key }) => rooms[key] > 0).map(({ key, swatch }) => (
                <Tooltip key={key}>
                    <TooltipTrigger
                        render={
                            <span
                                className="group/segment flex h-5 min-w-1 items-center"
                                style={{ width: `${(rooms[key] / rooms.total) * 100}%` }}
                            />
                        }
                    >
                        <span
                            className={cn(
                                'h-2.5 w-full transition-opacity group-last/segment:rounded-e-[4px] group-hover/segment:opacity-80',
                                swatch,
                            )}
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        {t('dashboard.roomStates.segment', {
                            label: t(`dashboard.roomStates.${key}`),
                            count: rooms[key],
                        })}
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}

/**
 * The legend for room bars, with each state's count beside its swatch.
 */
export function RoomLegend({ rooms, className }) {
    const { t, formatNumber } = useTranslation();

    return (
        <ul className={cn('flex flex-wrap gap-x-5 gap-y-2', className)}>
            {ROOM_SEGMENTS.map(({ key, swatch }) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', swatch)} />
                    <span className="text-muted-foreground">
                        {t(`dashboard.roomStates.${key}`)}
                    </span>
                    <span className="font-medium tabular-nums">
                        {formatNumber(rooms[key])}
                    </span>
                </li>
            ))}
        </ul>
    );
}
