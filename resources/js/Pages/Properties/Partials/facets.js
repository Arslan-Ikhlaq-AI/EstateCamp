import { useTranslation } from '@/hooks/use-translation';
import {
    BriefcaseBusinessIcon,
    Building2Icon,
    CircleCheckIcon,
    CirclePauseIcon,
    FileSignatureIcon,
    HardHatIcon,
    KeyRoundIcon,
    MapPinIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The filters in toolbar order, keyed as in the query string.
 */
export const FACET_KEYS = ['types', 'status', 'ownership', 'cities'];

const TYPE_ICONS = {
    worker_accommodation: HardHatIcon,
    staff_accommodation: BriefcaseBusinessIcon,
    residential_building: Building2Icon,
};

const STATUS_ICONS = {
    active: CircleCheckIcon,
    under_maintenance: WrenchIcon,
    inactive: CirclePauseIcon,
};

const OWNERSHIP_ICONS = {
    owned: KeyRoundIcon,
    leased: FileSignatureIcon,
};

/**
 * Each filter's options with a translated label, an icon and the number of
 * properties it would show.
 *
 * @returns {Record<string, Array<{ value: string, label: string, count: number, icon: import('react').ComponentType }>>}
 */
export function useFacetOptions(facets) {
    const { t, tOr } = useTranslation();

    return {
        types: facets.types.map((option) => ({
            ...option,
            label: tOr(`propertyTypes.${option.value}`, option.label),
            icon: TYPE_ICONS[option.value] ?? Building2Icon,
        })),
        status: facets.status.map((option) => ({
            ...option,
            label: t(`status.${option.value}`),
            icon: STATUS_ICONS[option.value],
        })),
        ownership: facets.ownership.map((option) => ({
            ...option,
            label: t(`properties.ownership.${option.value}`),
            icon: OWNERSHIP_ICONS[option.value],
        })),
        cities: facets.cities.map((option) => ({
            ...option,
            label: option.value,
            icon: MapPinIcon,
        })),
    };
}
