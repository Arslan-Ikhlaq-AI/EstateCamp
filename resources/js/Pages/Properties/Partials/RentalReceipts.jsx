import { METHOD_ICONS } from '@/Components/FinanceBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { HandoverBadge } from './CashHandover';

/**
 * Each way of paying in its own colour: cash in green, bank transfers and
 * cards on the violet of the short-term rentals.
 */
const METHOD_TILES = {
    cash: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    bank_transfer: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    card: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
};

/**
 * Money short-term tenants paid, latest first: who paid, the receipt,
 * when, how and what for, and who took it. Cash receipts also say whether
 * the money has reached the company. `empty` is what to say when there
 * are none.
 */
export default function RentalReceipts({ receipts, currency, showHandover = false, empty }) {
    const { t, formatCurrency, formatDate } = useTranslation();

    if (receipts.length === 0) {
        return <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">{empty}</p>;
    }

    return (
        <ul className="flex flex-col divide-y border-t">
            {receipts.map((receipt) => {
                const Icon = METHOD_ICONS[receipt.method];
                const detail = [
                    formatDate(receipt.paidOn),
                    t(`leasing.methods.${receipt.method}`),
                    t(`finance.receipts.purposes.${receipt.purpose}`),
                    receipt.rental?.number,
                    receipt.receivedBy && t('propertyPayments.receipts.takenBy', { name: receipt.receivedBy }),
                    showHandover &&
                        receipt.handedOverOn &&
                        t('propertyPayments.receipts.confirmedBy', { name: receipt.handedOverTo ?? '—', date: formatDate(receipt.handedOverOn) }),
                ]
                    .filter(Boolean)
                    .join(' · ');

                return (
                    <li key={receipt.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', METHOD_TILES[receipt.method])}>
                            <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span dir="auto" className="min-w-0 truncate text-[0.9375rem] font-semibold">
                                    {receipt.rental?.tenant?.name}
                                </span>
                                <Link
                                    href={route('rental-payments.show', receipt.id)}
                                    className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink underline-offset-4 hover:underline"
                                >
                                    {receipt.number}
                                </Link>
                                {showHandover && <HandoverBadge item={receipt} />}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground sm:truncate">{detail}</span>
                        </div>
                        <span className="shrink-0 font-heading text-[0.9375rem] font-bold whitespace-nowrap text-success tabular-nums">
                            {formatCurrency(receipt.amount, currency)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
