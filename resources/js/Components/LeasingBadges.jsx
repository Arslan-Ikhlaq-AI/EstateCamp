import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { Building2Icon, CircleAlertIcon, CircleCheckIcon, LandmarkIcon, Undo2Icon, UserIcon } from 'lucide-react';

/**
 * Badge colours by meaning, so every leasing status reads the same way:
 * green is settled or running, amber needs attention, red has gone wrong,
 * grey is finished or not started.
 */
const VARIANTS = {
    success: 'success',
    warning: 'warning',
    danger: 'destructive',
    info: 'secondary',
    muted: 'outline',
    primary: 'info',
};

export function ToneBadge({ tone = 'muted', icon: Icon, children }) {
    return (
        <Badge variant={VARIANTS[tone]}>
            {Icon ? (
                <Icon data-icon="inline-start" />
            ) : (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            )}
            {children}
        </Badge>
    );
}

const LEASE_TONES = { draft: 'muted', active: 'success', expired: 'info', terminated: 'danger' };
const CONTRACT_TONES = { draft: 'muted', active: 'success', ended: 'info', terminated: 'danger' };
const INVOICE_TONES = { issued: 'primary', partially_paid: 'warning', paid: 'success', void: 'muted' };
const PAYMENT_TONES = { pending: 'warning', cleared: 'success', bounced: 'danger' };
const CHEQUE_TONES = { pending: 'muted', received: 'primary', issued: 'primary', deposited: 'info', cleared: 'success', bounced: 'danger', returned: 'muted', cancelled: 'muted' };
const CHEQUE_ICONS = { deposited: LandmarkIcon, cleared: CircleCheckIcon, bounced: Undo2Icon };

export function LeaseStatusBadge({ status }) {
    const { t } = useTranslation();

    return <ToneBadge tone={LEASE_TONES[status]}>{t(`leasing.status.lease.${status}`)}</ToneBadge>;
}

export function ContractStatusBadge({ status }) {
    const { t } = useTranslation();

    return <ToneBadge tone={CONTRACT_TONES[status]}>{t(`leasing.status.contract.${status}`)}</ToneBadge>;
}

/**
 * An unpaid invoice past its due date shows as overdue.
 */
export function InvoiceStatusBadge({ status, isOverdue = false }) {
    const { t } = useTranslation();

    if (isOverdue && status !== 'paid' && status !== 'void') {
        return (
            <ToneBadge tone="danger" icon={CircleAlertIcon}>
                {t('leasing.status.invoice.overdue')}
            </ToneBadge>
        );
    }

    return <ToneBadge tone={INVOICE_TONES[status]}>{t(`leasing.status.invoice.${status}`)}</ToneBadge>;
}

export function PaymentStatusBadge({ status }) {
    const { t } = useTranslation();

    return <ToneBadge tone={PAYMENT_TONES[status]}>{t(`leasing.status.payment.${status}`)}</ToneBadge>;
}

/**
 * A cheque, worded for its direction: a pending one is still to collect
 * (from a client) or to write (to a landlord). One past its date shows as
 * overdue, or "deposit now" when it is in hand.
 */
export function ChequeStatusBadge({ status, direction, isOverdue = false }) {
    const { t } = useTranslation();
    const key = status === 'pending' ? `pending_${direction}` : status;

    if (isOverdue && (status === 'pending' || status === 'received')) {
        return (
            <ToneBadge tone={status === 'received' ? 'warning' : 'danger'} icon={CircleAlertIcon}>
                {t(`leasing.cheques.status.overdue_${key}`)}
            </ToneBadge>
        );
    }

    return (
        <ToneBadge tone={CHEQUE_TONES[status]} icon={CHEQUE_ICONS[status]}>
            {t(`leasing.cheques.status.${key}`)}
        </ToneBadge>
    );
}

export function ClientStatusBadge({ status }) {
    const { t } = useTranslation();

    return <ToneBadge tone={status === 'active' ? 'success' : 'muted'}>{t(`leasing.status.client.${status}`)}</ToneBadge>;
}

/**
 * Company or individual, for clients and landlords.
 */
export function PartyTypeBadge({ type }) {
    const { t } = useTranslation();
    const Icon = type === 'individual' ? UserIcon : Building2Icon;

    return (
        <Badge variant="secondary">
            <Icon data-icon="inline-start" />
            {t(`leasing.partyTypes.${type}`)}
        </Badge>
    );
}
