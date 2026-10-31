import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { WrenchIcon } from 'lucide-react';
import { AMENITY_ICONS } from './roomOptions';

/**
 * "Vacant" or "Occupied", or nothing when the room is out of service.
 */
export function AvailabilityBadge({ room }) {
    const { t } = useTranslation();

    if (room.status !== 'active') {
        return null;
    }

    return room.occupied ? <Badge variant="secondary">{t('roomList.occupied')}</Badge> : <Badge variant="success">{t('roomList.vacant')}</Badge>;
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
