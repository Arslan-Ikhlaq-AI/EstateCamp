import { useTranslation } from '@/hooks/use-translation';
import {
    AirVentIcon,
    ArmchairIcon,
    BedDoubleIcon,
    BedSingleIcon,
    BookmarkIcon,
    BriefcaseBusinessIcon,
    Building2Icon,
    CarIcon,
    CirclePauseIcon,
    CookingPotIcon,
    DoorOpenIcon,
    FenceIcon,
    HouseIcon,
    ShirtIcon,
    SofaIcon,
    SquareDashedIcon,
    WashingMachineIcon,
    WifiIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The apartment filters in toolbar order, keyed as in the query string.
 */
export const APARTMENT_FACET_KEYS = ['properties', 'clients', 'status', 'furnishing', 'bedrooms'];

export const AMENITY_ICONS = {
    air_conditioning: AirVentIcon,
    wifi: WifiIcon,
    kitchen: CookingPotIcon,
    balcony: FenceIcon,
    parking: CarIcon,
    built_in_wardrobes: ShirtIcon,
    laundry_area: WashingMachineIcon,
    maid_room: BedSingleIcon,
};

export const STATUS_ICONS = {
    vacant: DoorOpenIcon,
    occupied: HouseIcon,
    reserved: BookmarkIcon,
    under_maintenance: WrenchIcon,
    inactive: CirclePauseIcon,
};

export const FURNISHING_ICONS = {
    furnished: SofaIcon,
    semi_furnished: ArmchairIcon,
    unfurnished: SquareDashedIcon,
};

/**
 * Each apartment filter's options with a translated label, an icon and the
 * number of apartments it would show.
 */
export function useApartmentFacetOptions(facets) {
    const { t } = useTranslation();

    return {
        properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
        clients: facets.clients.map((option) => ({ ...option, icon: BriefcaseBusinessIcon })),
        status: facets.status.map((option) => ({
            ...option,
            label: t(`apartmentStatus.${option.value}`),
            icon: STATUS_ICONS[option.value],
        })),
        furnishing: facets.furnishing.map((option) => ({
            ...option,
            label: t(`furnishing.${option.value}`),
            icon: FURNISHING_ICONS[option.value],
        })),
        bedrooms: facets.bedrooms.map((option) => ({
            ...option,
            label: option.value === '0' ? t('apartmentList.studio') : t('apartmentList.bedroomCount', { count: Number(option.value) }),
            icon: BedDoubleIcon,
        })),
    };
}
