import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BanknoteIcon, BanknoteXIcon, CalendarHeartIcon, CircleCheckIcon, CircleSlashIcon, CircleXIcon, HourglassIcon, PlaneIcon, SirenIcon, StethoscopeIcon } from 'lucide-react';

// The icon for each kind of leave.
export const LEAVE_TYPE_ICONS = { annual: PlaneIcon, sick: StethoscopeIcon, emergency: SirenIcon, other: CalendarHeartIcon };

const STATUSES = {
    pending: { icon: HourglassIcon, variant: 'warning' },
    approved: { icon: CircleCheckIcon, variant: 'success' },
    rejected: { icon: CircleXIcon, variant: 'destructive' },
    cancelled: { icon: CircleSlashIcon, variant: 'secondary' },
};

const toUtc = (day) => {
    const [year, month, date] = day.split('-').map(Number);

    return Date.UTC(year, month - 1, date);
};

/**
 * The days from `start` to `end` (YYYY-MM-DD), both included; every
 * calendar day counts, as the payroll pays by the calendar day.
 */
export const daysBetween = (start, end) => Math.round((toUtc(end) - toUtc(start)) / 86400000) + 1;

/**
 * `days` after a YYYY-MM-DD date.
 */
export const addDays = (day, days) => new Date(toUtc(day) + days * 86400000).toISOString().slice(0, 10);

/**
 * Each month the leave falls in, as `{ month: 'YYYY-MM', days, daysInMonth }`,
 * the same split the server makes.
 */
export function leaveMonths(start, end) {
    const months = [];
    let cursor = `${start.slice(0, 7)}-01`;

    while (cursor <= end) {
        const [year, month] = cursor.split('-').map(Number);
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const last = `${cursor.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`;

        months.push({ month: cursor.slice(0, 7), days: daysBetween(start > cursor ? start : cursor, end < last ? end : last), daysInMonth });
        cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    }

    return months;
}

/**
 * Leave's days as "3 Nov 2026 – 16 Nov 2026", or one date for a single day.
 */
export function useLeaveSpan() {
    const { formatDate } = useTranslation();

    return (leave) => (leave.startsOn === leave.endsOn ? formatDate(leave.startsOn) : `${formatDate(leave.startsOn)} – ${formatDate(leave.endsOn)}`);
}

export function LeaveStatusBadge({ status }) {
    const { t } = useTranslation();
    const { icon: Icon, variant } = STATUSES[status];

    return (
        <Badge variant={variant}>
            <Icon data-icon="inline-start" />
            {t(`staff.leave.statuses.${status}`)}
        </Badge>
    );
}

/**
 * Paid or unpaid, once decided; nothing before then.
 */
export function LeavePayBadge({ isPaid }) {
    const { t } = useTranslation();

    if (isPaid === null || isPaid === undefined) {
        return null;
    }

    const Icon = isPaid ? BanknoteIcon : BanknoteXIcon;

    return (
        <Badge variant={isPaid ? 'info' : 'destructive'}>
            <Icon data-icon="inline-start" />
            {t(isPaid ? 'staff.leave.pay.paid' : 'staff.leave.pay.unpaid')}
        </Badge>
    );
}

/**
 * A kind of leave with its icon.
 */
export function LeaveType({ type, className }) {
    const { t } = useTranslation();
    const Icon = LEAVE_TYPE_ICONS[type];

    return (
        <span className={cn('inline-flex items-center gap-1.5', className)}>
            <Icon className="size-4 shrink-0 text-brand-ink" />
            {t(`staff.leave.types.${type}`)}
        </span>
    );
}
