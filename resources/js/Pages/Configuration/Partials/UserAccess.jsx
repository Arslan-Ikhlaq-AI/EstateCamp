import { useTranslation } from '@/hooks/use-translation';
import { BriefcaseBusinessIcon, CrownIcon, MapIcon, ShieldCheckIcon, TentIcon } from 'lucide-react';

// Users whose access is everything, which no one can narrow.
export const FULL_ACCESS = ['platform_admin', 'super_admin'];

// Each role's icon, and the one for no role.
export const ROLE_ICONS = { super_admin: CrownIcon, office_admin: BriefcaseBusinessIcon, area_manager: MapIcon, camp_boss: TentIcon };
export const roleIcon = (role) => ROLE_ICONS[role] ?? ShieldCheckIcon;

/**
 * The name of a user's access: their role, their staff access level, or
 * what they are to the platform.
 */
export function useAccessName() {
    const { t, tOr } = useTranslation();

    return (user) => {
        if (user.kind === 'role' || user.kind === 'super_admin') {
            return tOr(`permissions.roles.${user.role.slug}.name`, user.role.name);
        }

        if (user.kind === 'staff') {
            return `${t('permissions.kinds.staff')} · ${t(`staff.access.levels.${user.staffAccess}`)}`;
        }

        return t(`permissions.kinds.${user.kind}`);
    };
}
