import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { ArrowDownIcon, ArrowUpIcon, CircleCheckIcon, CircleDotIcon, CircleSlashIcon, SirenIcon, WrenchIcon } from 'lucide-react';

/**
 * The badge variant for each colour a status can be given on the configuration page.
 */
export const STATUS_COLOR_VARIANTS = { cyan: 'info', navy: 'default', amber: 'warning', green: 'success', red: 'destructive', grey: 'secondary' };

export const STAGE_ICONS = { open: CircleDotIcon, in_progress: WrenchIcon, completed: CircleCheckIcon, cancelled: CircleSlashIcon };

const PRIORITIES = {
    low: { variant: 'outline', icon: ArrowDownIcon },
    normal: { variant: 'secondary', icon: null },
    high: { variant: 'warning', icon: ArrowUpIcon },
    urgent: { variant: 'destructive', icon: SirenIcon },
};

/**
 * Names of statuses and categories as the company typed them, translated
 * when they are one of the starter entries.
 */
export function useLookupNames() {
    const { tOr } = useTranslation();

    return {
        statusName: (status) => tOr(`maintenance.statusNames.${status.slug}`, status.name),
        categoryName: (category) => tOr(`maintenance.categoryNames.${category.slug}`, category.name),
    };
}

/**
 * "Room 101", "Apartment 3B", or "Whole property", with the exact spot after it when given.
 */
export function useUnitLabel() {
    const { t } = useTranslation();

    return (job, { withLocation = true } = {}) =>
        [job.unit ? t(`maintenance.unit.${job.unit.type}`, { number: job.unit.number ?? '?' }) : t('maintenance.unitTypes.property'), withLocation ? job.location : null]
            .filter(Boolean)
            .join(' · ');
}

/**
 * A status in the colour chosen for it, with its stage's icon.
 */
export function MaintenanceStatusBadge({ status }) {
    const { statusName } = useLookupNames();
    const Icon = STAGE_ICONS[status.stage] ?? CircleDotIcon;

    return (
        <Badge variant={STATUS_COLOR_VARIANTS[status.color] ?? 'secondary'}>
            <Icon data-icon="inline-start" />
            {statusName(status)}
        </Badge>
    );
}

export function PriorityBadge({ priority }) {
    const { t } = useTranslation();
    const { variant, icon: Icon } = PRIORITIES[priority] ?? PRIORITIES.normal;

    return (
        <Badge variant={variant}>
            {Icon ? <Icon data-icon="inline-start" /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
            {t(`maintenance.priorities.${priority}`)}
        </Badge>
    );
}
