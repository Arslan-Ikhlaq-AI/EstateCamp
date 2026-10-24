import { amcNavTitle } from '@/Components/AmcBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import {
    BadgeAlertIcon,
    CalendarClockIcon,
    CalendarX2Icon,
    FileClockIcon,
    FileWarningIcon,
    HandCoinsIcon,
    IdCardIcon,
    LandmarkIcon,
    PenLineIcon,
    SirenIcon,
    TicketXIcon,
    WalletCardsIcon,
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
    cheque_bounced: TicketXIcon,
    cheque_deposit_due: LandmarkIcon,
    cheque_to_collect: HandCoinsIcon,
    cheque_to_write: PenLineIcon,
    cheque_clearing: WalletCardsIcon,
    staff_document_expiring: IdCardIcon,
    staff_document_expired: IdCardIcon,
    visit_due: SirenIcon,
    visit_overdue: SirenIcon,
};

const CHEQUE_HEADINGS = {
    cheque_bounced: 'alerts.chequeBounced',
    cheque_deposit_due: 'alerts.chequeDeposit',
    cheque_to_collect: 'alerts.chequeToCollect',
    cheque_to_write: 'alerts.chequeToWrite',
    cheque_clearing: 'alerts.chequeClearing',
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
function describe({ type, title, subject, service, days }, t) {
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
        case 'staff_document_expiring':
        case 'staff_document_expired':
            return {
                heading: t('alerts.staffDocument', { document: t(`staff.documents.${subject}`), name: title }),
                details: [timing('alerts.expiredAgo', 'alerts.expiresIn')],
            };
        case 'cheque_bounced':
            return {
                heading: t(CHEQUE_HEADINGS[type], { title }),
                details: [days === 0 ? t('alerts.bouncedToday') : t('alerts.bouncedAgo', { count: Math.abs(days) }), subject],
            };
        case 'cheque_deposit_due':
        case 'cheque_to_collect':
        case 'cheque_to_write':
        case 'cheque_clearing':
            return {
                heading: t(CHEQUE_HEADINGS[type], { title }),
                details: [days === 0 ? t('alerts.dueToday') : days < 0 ? t('alerts.dueAgo', { count: Math.abs(days) }) : t('alerts.dueIn', { count: days }), subject],
            };
        case 'visit_due':
        case 'visit_overdue':
            return {
                heading: t('alerts.visit', { service: t(amcNavTitle(service)), title }),
                details: [
                    days === 0 ? t('alerts.visitToday') : days < 0 ? t('alerts.visitOverdue', { count: Math.abs(days) }) : t('alerts.visitIn', { count: days }),
                    subject,
                ],
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
