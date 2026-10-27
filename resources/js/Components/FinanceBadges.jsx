import { ToneBadge } from '@/Components/LeasingBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import {
    BanknoteIcon,
    BanIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    ClockIcon,
    CreditCardIcon,
    CylinderIcon,
    FileSignatureIcon,
    FileStackIcon,
    HandCoinsIcon,
    KeyRoundIcon,
    LandmarkIcon,
    ScrollTextIcon,
    Undo2Icon,
    UsersRoundIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * Each kind of money movement in the payments overview: its icon, its
 * colour (fixed per kind, so a filter never repaints the others) and the
 * page that lists it. Short-term rentals share a colour in and out.
 */
export const CASH_CATEGORIES = {
    client_payment: { icon: FileSignatureIcon, color: 'var(--cash-clients)', routeName: 'payments.index' },
    gas_payment: { icon: CylinderIcon, color: 'var(--cash-gas)', routeName: 'gas-bills.index' },
    rental_payment: { icon: KeyRoundIcon, color: 'var(--cash-rentals)', routeName: 'rental-payments.index' },
    landlord_rent: { icon: LandmarkIcon, color: 'var(--cash-landlords)', routeName: 'cheques.index' },
    maintenance: { icon: WrenchIcon, color: 'var(--cash-maintenance)', routeName: 'maintenance-bills.index' },
    maintenance_contract: { icon: FileStackIcon, color: 'var(--cash-contracts)', routeName: 'cheques.index' },
    salary: { icon: UsersRoundIcon, color: 'var(--cash-salaries)', routeName: 'salaries.index' },
    deposit_refund: { icon: Undo2Icon, color: 'var(--cash-rentals)', routeName: 'rentals.index' },
};

export const METHOD_ICONS = { cash: BanknoteIcon, bank_transfer: LandmarkIcon, cheque: ScrollTextIcon, card: CreditCardIcon };

/**
 * Where a transaction in the ledger opens: the payment, receipt, voucher,
 * lease, maintenance contract, staff member or rental behind it.
 */
export function transactionHref(row) {
    switch (row.category) {
        case 'client_payment':
        case 'gas_payment':
            return route('payments.show', row.recordId);
        case 'rental_payment':
            return route('rental-payments.show', row.recordId);
        case 'landlord_rent':
            return route('head-leases.show', row.parentId);
        case 'maintenance':
            return route('maintenance-bills.voucher', row.recordId);
        case 'maintenance_contract':
            return route('amcs.contract', row.parentId);
        case 'salary':
            return route('staff.show', row.parentId);
        default:
            return route('rentals.show', row.recordId);
    }
}

const STANDING_TONES = { paid_up: 'success', due: 'warning', overdue: 'danger' };
const STANDING_ICONS = { paid_up: CircleCheckIcon, due: ClockIcon, overdue: CircleAlertIcon };

/**
 * Where a tenant's rent stands: paid up, due (within the grace days) or overdue.
 */
export function RentStandingBadge({ standing }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={STANDING_TONES[standing]} icon={STANDING_ICONS[standing]}>
            {t(`finance.rentals.standing.${standing}`)}
        </ToneBadge>
    );
}

/**
 * Active or ended; an active rental whose term has run out says so.
 */
export function RentalStatusBadge({ status, termOver = false }) {
    const { t } = useTranslation();

    if (status === 'active' && termOver) {
        return <ToneBadge tone="warning">{t('finance.rentals.termOver')}</ToneBadge>;
    }

    return <ToneBadge tone={status === 'active' ? 'success' : 'muted'}>{t(`finance.rentals.status.${status}`)}</ToneBadge>;
}

export function ReceiptStatusBadge({ status }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={status === 'void' ? 'muted' : 'success'} icon={status === 'void' ? BanIcon : CircleCheckIcon}>
            {t(`finance.receipts.status.${status}`)}
        </ToneBadge>
    );
}

export function BillStatusBadge({ isPaid }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={isPaid ? 'success' : 'warning'} icon={isPaid ? CircleCheckIcon : HandCoinsIcon}>
            {t(`finance.bills.status.${isPaid ? 'paid' : 'unpaid'}`)}
        </ToneBadge>
    );
}

/**
 * "Room 101", or "Rooms 101, 102" for a rental holding several.
 */
export function useRentalPlace() {
    const { t } = useTranslation();

    return (rental) => {
        const rooms = rental.rooms ?? [];

        return rooms.length > 0 ? t('finance.rentals.place', { count: rooms.length, rooms: rooms.map((room) => room.number).join(', ') }) : '—';
    };
}

/**
 * Under the standing badge: what is owed and for how long, or how far
 * the rent is paid.
 */
export function StandingDetail({ standing, currency, className }) {
    const { t, formatMoney, formatDate } = useTranslation();

    let text = t('finance.rentals.notPaidYet');

    if (standing.arrears > 0) {
        text = standing.overdueDays > 0 ? t('finance.rentals.owesFor', { amount: formatMoney(standing.arrears, currency), count: standing.overdueDays }) : t('finance.rentals.owes', { amount: formatMoney(standing.arrears, currency) });
    } else if (standing.paidThrough) {
        text = t('finance.rentals.paidThrough', { date: formatDate(standing.paidThrough) });
    }

    return <span className={cn('text-xs', standing.standing === 'overdue' ? 'text-destructive' : 'text-muted-foreground', className)}>{text}</span>;
}
