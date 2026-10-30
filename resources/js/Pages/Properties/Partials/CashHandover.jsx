import ActionDialog from '@/Components/ActionDialog';
import { ToneBadge } from '@/Components/LeasingBadges';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { CircleCheckIcon, HandCoinsIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Where a cash payment stands with the camp boss: cash collected is with
 * the camp boss until handed over; a bill paid in cash out of it is to
 * settle until an admin counts it off the handover.
 */
export function HandoverBadge({ item, spent = false }) {
    const { t } = useTranslation();
    const wording = spent ? 'spent' : 'receipts';

    return item.awaitsHandover ? (
        <ToneBadge tone="warning" icon={HandCoinsIcon}>
            {t(`propertyPayments.${wording}.${spent ? 'toSettle' : 'withCampBoss'}`)}
        </ToneBadge>
    ) : (
        <ToneBadge tone="success" icon={CircleCheckIcon}>
            {t(`propertyPayments.${wording}.${spent ? 'settled' : 'handedOver'}`)}
        </ToneBadge>
    );
}

const sumOf = (items) => items.reduce((sum, item) => sum + item.amount, 0);

/**
 * For an admin: settle the cash the camp boss handles here, everything on
 * screen at once, after a check of the sums: the cash collected, less the
 * bills paid out of it, is what is handed over (or, below nothing, what
 * the company owes back). Hidden when there is nothing to settle.
 */
export function CashHandoverButton({ receipts, bills, others, currency, propertyId, size }) {
    const { t, formatCurrency } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const form = useForm({});
    const waiting = {
        receipts: receipts.filter((receipt) => receipt.awaitsHandover),
        bills: bills.filter((bill) => bill.awaitsHandover),
        others: others.filter((payment) => payment.awaitsHandover),
    };
    const collected = sumOf(waiting.receipts);
    const spent = sumOf(waiting.bills) + sumOf(waiting.others);
    const net = collected - spent;
    const count = waiting.receipts.length + waiting.bills.length + waiting.others.length;

    if (count === 0) {
        return null;
    }

    const confirm = () => {
        form.transform(() => ({
            receipts: waiting.receipts.map((receipt) => receipt.id),
            bills: waiting.bills.map((bill) => bill.id),
            others: waiting.others.map((payment) => payment.id),
        }));
        form.post(route('properties.cash-handover.store', propertyId), {
            preserveScroll: true,
            onSuccess: () => setIsOpen(false),
        });
    };

    const lines = [
        { key: 'collected', amount: collected, detail: t('propertyPayments.handover.count', { count: waiting.receipts.length }) },
        { key: 'spent', amount: -spent, detail: t('propertyPayments.figures.bills', { count: waiting.bills.length + waiting.others.length }) },
    ];

    return (
        <>
            <Button variant="brand" size={size} onClick={() => setIsOpen(true)}>
                <CircleCheckIcon data-icon="inline-start" />
                {t('propertyPayments.handover.button')}
            </Button>
            <ActionDialog
                open={isOpen}
                onOpenChange={setIsOpen}
                title={t('propertyPayments.handover.title')}
                description={t('propertyPayments.handover.description')}
                submitLabel={t('propertyPayments.handover.submit', { amount: formatCurrency(Math.abs(net), currency) })}
                onSubmit={confirm}
                processing={form.processing}
            >
                <dl className="flex flex-col rounded-xl bg-emerald-500/[0.07] px-4 py-1.5 ring-1 ring-emerald-500/20 ring-inset">
                    {lines.map((line) => (
                        <div key={line.key} className="flex items-baseline justify-between gap-4 border-b border-emerald-500/15 py-2.5">
                            <dt className="flex flex-col">
                                <span className="text-sm font-medium">{t(`propertyPayments.handover.${line.key}`)}</span>
                                <span className="text-xs text-muted-foreground">{line.detail}</span>
                            </dt>
                            <dd className="font-heading text-[0.9375rem] font-bold tabular-nums">
                                {line.amount < 0 ? '−' : ''}
                                {formatCurrency(Math.abs(line.amount), currency)}
                            </dd>
                        </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-4 py-3">
                        <dt className="text-sm font-semibold">{t(`propertyPayments.handover.${net < 0 ? 'owed' : 'total'}`)}</dt>
                        <dd className={cn('font-heading text-2xl font-bold tracking-tight tabular-nums', net < 0 && 'text-destructive')}>
                            {formatCurrency(Math.abs(net), currency)}
                        </dd>
                    </div>
                </dl>
                {form.errors.receipts && <p className="text-sm text-destructive">{form.errors.receipts}</p>}
            </ActionDialog>
        </>
    );
}
