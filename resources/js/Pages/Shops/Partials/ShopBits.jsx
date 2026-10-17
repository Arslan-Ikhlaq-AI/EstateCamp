import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { WrenchIcon } from 'lucide-react';
import { AMENITY_ICONS } from './shopOptions';

/**
 * Vacant shops read as available (green), occupied ones as settled,
 * reserved ones as spoken for, and out-of-service ones as muted or amber.
 */
export function ShopStatusBadge({ status }) {
    const { t } = useTranslation();

    switch (status) {
        case 'under_maintenance':
            return (
                <Badge variant="warning">
                    <WrenchIcon data-icon="inline-start" />
                    {t('shopStatus.under_maintenance')}
                </Badge>
            );
        case 'inactive':
            return (
                <Badge variant="outline">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
                    {t('shopStatus.inactive')}
                </Badge>
            );
        case 'occupied':
            return (
                <Badge variant="secondary">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('shopStatus.occupied')}
                </Badge>
            );
        case 'reserved':
            return (
                <Badge variant="info">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('shopStatus.reserved')}
                </Badge>
            );
        default:
            return (
                <Badge variant="success">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t('shopStatus.vacant')}
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
                                        aria-label={t(`shopAmenities.${amenity}`)}
                                        className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                    />
                                }
                            >
                                {Icon && <Icon className="size-3.5" />}
                            </TooltipTrigger>
                            <TooltipContent>{t(`shopAmenities.${amenity}`)}</TooltipContent>
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
                            {t('shopList.moreAmenities', { count: hidden.length })}
                        </TooltipTrigger>
                        <TooltipContent>{hidden.map((amenity) => t(`shopAmenities.${amenity}`)).join(', ')}</TooltipContent>
                    </Tooltip>
                </li>
            )}
        </ul>
    );
}

/**
 * "Block A · Ground floor" for a shop, skipping whatever is not set.
 */
export function useShopPlacement() {
    const { t } = useTranslation();

    return (shop) =>
        [
            shop.block && t('shopList.block', { block: shop.block }),
            shop.floor !== null && shop.floor !== undefined && shop.floor !== ''
                ? Number(shop.floor) === 0
                    ? t('shopList.ground')
                    : t('shopList.floor', { floor: Number(shop.floor) })
                : null,
        ]
            .filter(Boolean)
            .join(' · ');
}
