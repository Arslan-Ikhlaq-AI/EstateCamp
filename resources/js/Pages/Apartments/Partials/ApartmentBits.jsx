import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { WrenchIcon } from 'lucide-react';
import { AMENITY_ICONS } from './apartmentOptions';

/**
 * Vacant apartments read as available (green), occupied ones as settled,
 * reserved ones as spoken for, and out-of-service ones as muted or amber.
 */
export function ApartmentStatusBadge({ status }) {
    const { t } = useTranslation();

    switch (status) {
        case 'under_maintenance':
            return (
                <Badge variant="warning">
                    <WrenchIcon data-icon="inline-start" />
                    {t('apartmentStatus.under_maintenance')}
                </Badge>
            );
        case 'inactive':
            return (
                <Badge variant="outline">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
                    {t('apartmentStatus.inactive')}
                </Badge>
            );
        case 'occupied':
            return (
                <Badge variant="secondary">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('apartmentStatus.occupied')}
                </Badge>
            );
        case 'reserved':
            return (
                <Badge variant="info">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('apartmentStatus.reserved')}
                </Badge>
            );
        default:
            return (
                <Badge variant="success">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('apartmentStatus.vacant')}
                </Badge>
            );
    }
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
                                        aria-label={t(`apartmentAmenities.${amenity}`)}
                                        className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    />
                                }
                            >
                                {Icon && <Icon className="size-3.5" />}
                            </TooltipTrigger>
                            <TooltipContent>{t(`apartmentAmenities.${amenity}`)}</TooltipContent>
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
                            {t('apartmentList.moreAmenities', { count: hidden.length })}
                        </TooltipTrigger>
                        <TooltipContent>{hidden.map((amenity) => t(`apartmentAmenities.${amenity}`)).join(', ')}</TooltipContent>
                    </Tooltip>
                </li>
            )}
        </ul>
    );
}

/**
 * "Block A · Floor 2" for an apartment, skipping whatever is not set.
 */
export function useApartmentPlacement() {
    const { t } = useTranslation();

    return (apartment) =>
        [
            apartment.block && t('apartmentList.block', { block: apartment.block }),
            apartment.floor !== null && apartment.floor !== undefined && apartment.floor !== ''
                ? Number(apartment.floor) === 0
                    ? t('apartmentList.ground')
                    : t('apartmentList.floor', { floor: Number(apartment.floor) })
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
}

/**
 * "Studio · 1 bath" or "2 bed · 2 bath" for an apartment's layout.
 */
export function useApartmentLayout() {
    const { t } = useTranslation();

    return (apartment) =>
        [
            Number(apartment.bedrooms) === 0
                ? t('apartmentList.studio')
                : t('apartmentList.bed', { count: Number(apartment.bedrooms) }),
            t('apartmentList.bath', { count: Number(apartment.bathrooms) }),
        ].join(' · ');
}
