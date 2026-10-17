import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import {
    BadgeAlertIcon,
    CalendarClockIcon,
    CalendarX2Icon,
    FileClockIcon,
    FileWarningIcon,
    WrenchIcon,
} from 'lucide-react';

const ICONS = {
    document_expiring: FileClockIcon,
    document_expired: FileWarningIcon,
    lease_ending: CalendarClockIcon,
    lease_ended: CalendarX2Icon,
    room_maintenance: WrenchIcon,
    license_expiring: BadgeAlertIcon,
    license_expired: BadgeAlertIcon,
};

const TONES = {
    critical: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-primary/10 text-primary',
};

/**
 * Words a notification from the server for the active language.
 *
 * @return {{heading: string, details: string[]}}
 */
function describe({ type, title, subject, days }, t) {
    const timing = (pastKey, futureKey) => {
        if (days === 0) {
            return t('alerts.expiresToday');
        }

        return days < 0
            ? t(pastKey, { count: Math.abs(days) })
            : t(futureKey, { count: days });
    };

    switch (type) {
        case 'document_expiring':
        case 'document_expired':
            return {
                heading: title,
                details: [timing('alerts.expiredAgo', 'alerts.expiresIn'), subject],
            };
        case 'lease_ending':
        case 'lease_ended':
            return {
                heading: t('alerts.leaseEnding', { title }),
                details: [timing('alerts.endedAgo', 'alerts.endsIn'), subject],
            };
        case 'license_expiring':
        case 'license_expired':
            return {
                heading: t('alerts.license', { title }),
                details: [timing('alerts.expiredAgo', 'alerts.expiresIn'), subject],
            };
        default:
            return {
                heading: t('alerts.roomMaintenance', { title }),
                details: [subject],
            };
    }
}

export default function NotificationItem({ notification, className }) {
    const { t } = useTranslation();
    const Icon = ICONS[notification.type] ?? WrenchIcon;
    const { heading, details } = describe(notification, t);

    return (
        <div className={cn('flex min-w-0 items-start gap-3', className)}>
            <span
                className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                    TONES[notification.severity],
                )}
            >
                <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                    {heading}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {details.filter(Boolean).join(' · ')}
                </span>
            </span>
        </div>
    );
}
