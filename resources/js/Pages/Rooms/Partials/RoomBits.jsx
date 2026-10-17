import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { WrenchIcon } from 'lucide-react';
import { AMENITY_ICONS } from './roomOptions';

const MAX_DOTS = 12;

/**
 * One square per bed: occupied beds in the accent, free beds in a lighter
 * step, and beds out of service in grey when the room is not active. Large
 * rooms show the first beds and a count of the rest; the exact numbers are
 * in the label and tooltip so colour never carries them alone.
 */
export function BedDots({ capacity, occupied, status, size = 'sm', className }) {
    const { t, formatNumber } = useTranslation();
    const isInService = status === 'active';
    const shown = Math.min(capacity, MAX_DOTS);
    const label = t('roomList.bedsLabel', { occupied, capacity });

    return (
        <Tooltip>
            <TooltipTrigger
                render={<div role="img" aria-label={label} className={cn('flex flex-wrap items-center gap-0.5', className)} />}
            >
                {Array.from({ length: shown }, (_, index) => (
                    <span
                        key={index}
                        className={cn(
                            'rounded-[3px] transition-transform hover:scale-125',
                            size === 'lg' ? 'size-3.5' : 'size-2.5',
                            index < occupied && 'bg-chart-1',
                            index >= occupied && (isInService ? 'bg-chart-2' : 'bg-chart-3/60'),
                        )}
                    />
                ))}
                {capacity > MAX_DOTS && (
                    <span className="ms-0.5 text-xs text-muted-foreground tabular-nums">
                        +{formatNumber(capacity - MAX_DOTS)}
                    </span>
                )}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Free beds, "Full", or nothing when the room is out of service.
 */
export function AvailabilityBadge({ room }) {
    const { t } = useTranslation();

    if (room.status !== 'active') {
        return null;
    }

    return room.occupied >= room.capacity ? (
        <Badge variant="secondary">{t('roomList.full')}</Badge>
    ) : (
        <Badge variant="success">{t('roomList.free', { count: room.capacity - room.occupied })}</Badge>
    );
}

export function RoomStatusBadge({ status }) {
    const { t } = useTranslation();

    if (status === 'under_maintenance') {
        return (
            <Badge variant="warning">
                <WrenchIcon data-icon="inline-start" />
                {t('properties.status.under_maintenance')}
            </Badge>
        );
    }

    if (status === 'inactive') {
        return (
            <Badge variant="outline">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
                {t('status.inactive')}
            </Badge>
        );
    }

    return (
        <Badge variant="success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t('status.active')}
        </Badge>
    );
}

/**
 * Amenity icons with their names in tooltips; anything past `max` folds
 * into a "+N" chip listing the rest.
 */
export function AmenityIcons({ amenities, max = 4 }) {
    const { t } = useTranslation();

    if (amenities.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    const shown = amenities.slice(0, max);
    const hidden = amenities.slice(max);

    return (
        <ul className="flex items-center gap-1">
            {shown.map((amenity) => {
                const Icon = AMENITY_ICONS[amenity];

                return (
                    <li key={amenity}>
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <span
                                        tabIndex={0}
                                        aria-label={t(`amenities.${amenity}`)}
                                        className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    />
                                }
                            >
                                {Icon && <Icon className="size-3.5" />}
                            </TooltipTrigger>
                            <TooltipContent>{t(`amenities.${amenity}`)}</TooltipContent>
                        </Tooltip>
                    </li>
                );
            })}
            {hidden.length > 0 && (
                <li>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <span
                                    tabIndex={0}
                                    className="flex h-6 items-center rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                />
                            }
                        >
                            {t('roomList.moreAmenities', { count: hidden.length })}
                        </TooltipTrigger>
                        <TooltipContent>{hidden.map((amenity) => t(`amenities.${amenity}`)).join(', ')}</TooltipContent>
                    </Tooltip>
                </li>
            )}
        </ul>
    );
}

/**
 * "Block A · Floor 2" for a room, skipping whatever is not set.
 */
export function useRoomPlacement() {
    const { t } = useTranslation();

    return (room) =>
        [
            room.block && t('roomList.block', { block: room.block }),
            room.floor !== null && room.floor !== undefined && room.floor !== ''
                ? Number(room.floor) === 0
                    ? t('roomList.ground')
                    : t('roomList.floor', { floor: Number(room.floor) })
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
}
