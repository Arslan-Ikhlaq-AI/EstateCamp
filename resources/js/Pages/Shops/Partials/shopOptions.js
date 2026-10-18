import { useTranslation } from '@/hooks/use-translation';
import {
    AirVentIcon,
    BookmarkIcon,
    BriefcaseBusinessIcon,
    Building2Icon,
    CctvIcon,
    CirclePauseIcon,
    CoffeeIcon,
    DoorOpenIcon,
    DropletsIcon,
    LandmarkIcon,
    PanelTopIcon,
    PhoneIcon,
    PillIcon,
    ScissorsIcon,
    ShieldIcon,
    ShoppingCartIcon,
    SignpostIcon,
    SmartphoneIcon,
    StoreIcon,
    TagIcon,
    TruckIcon,
    UtensilsIcon,
    WarehouseIcon,
    WashingMachineIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The shop filters in toolbar order, keyed as in the query string.
 */
export const SHOP_FACET_KEYS = ['properties', 'clients', 'status', 'types'];

export const AMENITY_ICONS = {
    air_conditioning: AirVentIcon,
    storage_room: WarehouseIcon,
    display_window: PanelTopIcon,
    signage: SignpostIcon,
    loading_access: TruckIcon,
    security_shutter: ShieldIcon,
    cctv: CctvIcon,
    water_connection: DropletsIcon,
};

export const TYPE_ICONS = {
    grocery: ShoppingCartIcon,
    restaurant: UtensilsIcon,
    cafe: CoffeeIcon,
    laundry: WashingMachineIcon,
    barber: ScissorsIcon,
    pharmacy: PillIcon,
    electronics: SmartphoneIcon,
    telecom: PhoneIcon,
    money_exchange: LandmarkIcon,
};

export const STATUS_ICONS = {
    vacant: DoorOpenIcon,
    occupied: StoreIcon,
    reserved: BookmarkIcon,
    under_maintenance: WrenchIcon,
    inactive: CirclePauseIcon,
};

/**
 * A shop type's display name: the translation for the suggested types, the
 * stored text for anything else.
 */
export function useShopTypeLabel() {
    const { tOr } = useTranslation();

    return (type) => tOr(`shopTypes.${type}`, type);
}

/**
 * Each shop filter's options with a translated label, an icon and the number
 * of shops it would show.
 */
export function useShopFacetOptions(facets) {
    const { t } = useTranslation();
    const typeLabel = useShopTypeLabel();

    return {
        properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
        clients: facets.clients.map((option) => ({ ...option, icon: BriefcaseBusinessIcon })),
        status: facets.status.map((option) => ({
            ...option,
            label: t(`shopStatus.${option.value}`),
            icon: STATUS_ICONS[option.value],
        })),
        types: facets.types.map((option) => ({
            ...option,
            label: typeLabel(option.value),
            icon: TYPE_ICONS[option.value] ?? TagIcon,
        })),
    };
}
