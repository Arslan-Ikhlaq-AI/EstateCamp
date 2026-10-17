import { useTranslation } from '@/hooks/use-translation';
import {
    AirVentIcon,
    BanIcon,
    BathIcon,
    BedDoubleIcon,
    Building2Icon,
    CircleCheckIcon,
    CirclePauseIcon,
    CookingPotIcon,
    DoorOpenIcon,
    FenceIcon,
    LockIcon,
    MarsIcon,
    ShirtIcon,
    ShowerHeadIcon,
    TvIcon,
    UserIcon,
    UsersIcon,
    VenusAndMarsIcon,
    VenusIcon,
    WifiIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The room filters in toolbar order, keyed as in the query string.
 */
export const ROOM_FACET_KEYS = ['properties', 'types', 'status', 'gender', 'availability'];

export const AMENITY_ICONS = {
    air_conditioning: AirVentIcon,
    wifi: WifiIcon,
    attached_bathroom: ShowerHeadIcon,
    shared_bathroom: BathIcon,
    bunk_beds: BedDoubleIcon,
    lockers: LockIcon,
    wardrobe: ShirtIcon,
    kitchenette: CookingPotIcon,
    balcony: FenceIcon,
    tv: TvIcon,
};

export const ROOM_TYPE_ICONS = {
    dormitory: BedDoubleIcon,
    shared_room: UsersIcon,
    private_room: UserIcon,
};

export const GENDER_ICONS = {
    male: MarsIcon,
    female: VenusIcon,
    mixed: VenusAndMarsIcon,
};

const STATUS_ICONS = {
    active: CircleCheckIcon,
    under_maintenance: WrenchIcon,
    inactive: CirclePauseIcon,
};

/**
 * Each room filter's options with a translated label, an icon and the number
 * of rooms it would show.
 */
export function useRoomFacetOptions(facets) {
    const { t, tOr } = useTranslation();

    return {
        properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
        types: facets.types.map((option) => ({
            ...option,
            label: tOr(`roomTypes.${option.value}`, option.label),
            icon: ROOM_TYPE_ICONS[option.value] ?? DoorOpenIcon,
        })),
        status: facets.status.map((option) => ({
            ...option,
            label: t(`status.${option.value}`),
            icon: STATUS_ICONS[option.value],
        })),
        gender: facets.gender.map((option) => ({
            ...option,
            label: t(`gender.${option.value}`),
            icon: GENDER_ICONS[option.value],
        })),
        availability: facets.availability.map((option) => ({
            ...option,
            label: t(`roomList.availability.${option.value}`),
            icon: option.value === 'full' ? BanIcon : DoorOpenIcon,
        })),
    };
}
