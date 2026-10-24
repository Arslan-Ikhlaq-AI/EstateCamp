import { ToneBadge } from '@/Components/LeasingBadges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import {
    BriefcaseBusinessIcon,
    Building2Icon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleDashedIcon,
    CircleSlashIcon,
    CircleXIcon,
    ClockFadingIcon,
    HourglassIcon,
    MapPinnedIcon,
    MoonIcon,
    TreePalmIcon,
    UserRoundXIcon,
} from 'lucide-react';
import { useMemo } from 'react';

/**
 * The icon for each level of the company: the head office, a regional
 * office, and a camp or building (the same icon as the properties).
 */
export const LEVEL_ICONS = { head_office: BriefcaseBusinessIcon, regional: MapPinnedIcon, site: Building2Icon };

/**
 * How each attendance mark looks: its icon, badge variant and the classes
 * of its cell in the monthly register.
 */
export const ATTENDANCE = {
    present: { icon: CircleCheckIcon, variant: 'success', cell: 'bg-success/15 text-success' },
    half_day: { icon: ClockFadingIcon, variant: 'info', cell: 'bg-brand-cyan/15 text-brand-ink' },
    absent: { icon: CircleXIcon, variant: 'destructive', cell: 'bg-destructive/12 text-destructive' },
    leave: { icon: TreePalmIcon, variant: 'warning', cell: 'bg-warning/15 text-warning' },
    day_off: { icon: MoonIcon, variant: 'secondary', cell: 'bg-muted text-muted-foreground' },
};

const STATUS_TONES = { active: 'success', on_leave: 'warning', resigned: 'muted', terminated: 'danger' };
const STATUS_ICONS = { active: CircleCheckIcon, on_leave: TreePalmIcon, resigned: UserRoundXIcon, terminated: CircleSlashIcon };

/**
 * Role names as the company typed them, translated when they are one of the
 * starter roles, and where someone works ("Head office", an office's name or
 * a property's name).
 */
export function useStaffNames() {
    const { t, tOr } = useTranslation();

    return {
        roleName: (role) => tOr(`staff.roleNames.${role.slug}`, role.name),
        workplaceName: (workplace) => (workplace.type === 'head_office' ? t('staff.levels.head_office') : (workplace.name ?? '—')),
    };
}

/**
 * The absences behind a month's salary, such as "2 absent · 1 half day",
 * from its attendance counts.
 */
export function useAbsences() {
    const { t } = useTranslation();

    return (attendance) => {
        const absent = attendance.absent ?? 0;
        const half = attendance.half_day ?? 0;

        return absent + half === 0
            ? t('staff.payroll.noAbsences')
            : [absent > 0 && t('staff.payroll.absentDays', { count: absent }), half > 0 && t('staff.payroll.halfDays', { count: half })].filter(Boolean).join(' · ');
    };
}

/**
 * `YYYY-MM-DD` for a day of a `YYYY-MM` month.
 */
export const dayOfMonth = (month, day) => `${month}-${String(day).padStart(2, '0')}`;

/**
 * Month and weekday names in the active language: "October 2026" for a
 * `YYYY-MM` month, a weekday's first letter, and a day written out in full.
 */
export function useCalendarFormat() {
    const { locale } = useTranslation();

    return useMemo(() => {
        const { intl } = LOCALES[locale];
        const month = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
        const weekday = new Intl.DateTimeFormat(intl, { weekday: 'narrow' });
        const fullDay = new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn' });
        const parse = (day) => new Date(`${day}T00:00:00`);

        return {
            formatMonth: (value) => month.format(parse(`${value}-01`)),
            weekdayLetter: (day) => weekday.format(parse(day)),
            formatFullDay: (day) => fullDay.format(parse(day)),
        };
    }, [locale]);
}

/**
 * Initials on the brand gradient, standing in for a photo.
 */
export function StaffAvatar({ name, className }) {
    return (
        <Avatar className={cn('size-9', className)}>
            <AvatarFallback className="bg-linear-to-br from-brand-cyan to-brand-navy text-xs font-bold text-white">{getInitials(name)}</AvatarFallback>
        </Avatar>
    );
}

export function StaffStatusBadge({ status }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={STATUS_TONES[status]} icon={STATUS_ICONS[status]}>
            {t(`staff.statuses.${status}`)}
        </ToneBadge>
    );
}

/**
 * A month's salary: still to pay, or paid.
 */
export function SalaryStatusBadge({ status }) {
    const { t } = useTranslation();

    return status === 'paid' ? (
        <ToneBadge tone="success" icon={CircleCheckIcon}>
            {t('staff.payroll.statuses.paid')}
        </ToneBadge>
    ) : (
        <ToneBadge tone="warning" icon={HourglassIcon}>
            {t('staff.payroll.statuses.pending')}
        </ToneBadge>
    );
}

export function AttendanceBadge({ status }) {
    const { t } = useTranslation();
    const { icon: Icon, variant } = ATTENDANCE[status] ?? { icon: CircleDashedIcon, variant: 'outline' };

    return (
        <Badge variant={variant}>
            <Icon data-icon="inline-start" />
            {t(`staff.attendance.statuses.${status}`)}
        </Badge>
    );
}

/**
 * Whether a document is in date, runs out within 60 days, has run out, or
 * has no expiry on file. `days` is the days left (negative once expired).
 */
export function DocumentStatusBadge({ days }) {
    const { t } = useTranslation();

    if (days === null || days === undefined) {
        return <ToneBadge tone="muted">{t('staff.documentState.missing')}</ToneBadge>;
    }

    if (days < 0) {
        return (
            <ToneBadge tone="danger" icon={CircleAlertIcon}>
                {t('staff.documentState.expired')}
            </ToneBadge>
        );
    }

    return days <= 60 ? (
        <ToneBadge tone="warning" icon={CircleAlertIcon}>
            {t('staff.documentState.expiring')}
        </ToneBadge>
    ) : (
        <ToneBadge tone="success">{t('staff.documentState.valid')}</ToneBadge>
    );
}

/**
 * Where someone works, with its level's icon; a property links to its page.
 */
export function Workplace({ workplace, link = false, className }) {
    const { workplaceName } = useStaffNames();
    const Icon = LEVEL_ICONS[workplace.type === 'office' ? 'regional' : workplace.type === 'property' ? 'site' : 'head_office'];
    const name = workplaceName(workplace);

    return (
        <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            {link && workplace.type === 'property' && workplace.id ? (
                <Link href={route('properties.show', workplace.id)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                    {name}
                </Link>
            ) : (
                <span dir="auto" className="truncate">
                    {name}
                </span>
            )}
        </span>
    );
}
