import ActionDialog from '@/Components/ActionDialog';
import { OtherPaymentStatusBadge } from '@/Components/FinanceBadges';
import { SelectField, TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { BanIcon, CircleCheckIcon, ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, ReceiptIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { HandoverBadge } from './CashHandover';

const TILE_TONES = { pending: 'bg-gold/20 text-gold-ink', paid: 'bg-success/12 text-success', cancelled: 'bg-muted text-muted-foreground' };

/**
 * Mark a payment paid: the day and how. It counts as money out from then.
 */
function PayDialog({ payment, currency, methods, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ status: 'paid', date: todayIso(), method: methods.includes(payment.method) ? payment.method : methods[0] });
    const { data, setData, errors, processing } = form;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.otherPayments.pay.title', { number: payment.number })}
            description={t('finance.otherPayments.pay.description', { amount: formatMoney(payment.amount, currency), name: payment.paidTo })}
            submitLabel={t('finance.otherPayments.pay.submit')}
            processing={processing}
            onSubmit={() => form.post(route('other-payments.status', payment.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                {errors.status && <p className="text-[0.8125rem] text-destructive sm:col-span-2">{errors.status}</p>}
                <TextField
                    id="other-payment-paid-on"
                    type="date"
                    label={t('finance.otherPayments.form.fields.paidOn')}
                    value={data.date}
                    max={todayIso()}
                    onChange={(value) => setData('date', value)}
                    error={errors.date}
                />
                <SelectField
                    id="other-payment-method"
                    label={t('finance.otherPayments.form.fields.method')}
                    value={data.method}
                    onChange={(value) => setData('method', value)}
                    items={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                    error={errors.method}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

function CancelDialog({ payment, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({ status: 'cancelled' });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.otherPayments.cancel.title', { number: payment.number })}
            description={t('finance.otherPayments.cancel.description')}
            submitLabel={t('finance.otherPayments.cancel.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('other-payments.status', payment.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        />
    );
}

function PaymentActions({ payment, onOpen }) {
    const { t } = useTranslation();
    const reopen = () => router.post(route('other-payments.status', payment.id), { status: 'pending' }, { preserveScroll: true });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('finance.otherPayments.actions.menu', { number: payment.number })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{payment.number}</DropdownMenuLabel>
                    {payment.status !== 'paid' && (
                        <DropdownMenuItem onClick={() => onOpen('pay')}>
                            <CircleCheckIcon />
                            {t('finance.otherPayments.actions.pay')}
                        </DropdownMenuItem>
                    )}
                    {payment.status !== 'pending' && (
                        <DropdownMenuItem onClick={reopen}>
                            <RotateCcwIcon />
                            {t('finance.otherPayments.actions.reopen')}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem render={<Link href={route('other-payments.edit', payment.id)} />}>
                        <PencilIcon />
                        {t('finance.otherPayments.actions.edit')}
                    </DropdownMenuItem>
                    {payment.receiptUrl && (
                        <DropdownMenuItem render={<a href={payment.receiptUrl} target="_blank" rel="noreferrer" />}>
                            <ExternalLinkIcon />
                            {t('finance.otherPayments.actions.receipt')}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                {payment.status !== 'cancelled' && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onOpen('cancel')}>
                            <BanIcon />
                            {t('finance.otherPayments.actions.cancel')}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * One-off payments for the property, such as a permit fee or a water
 * tanker. One still to pay is paid with its button; the menu puts a
 * payment back to pay, cancels it, or opens it to correct. Those the camp
 * boss paid in cash say whether they are settled with an admin when
 * `showHandover` is set. Nothing is shown when there are none.
 */
export default function OtherPaymentsPanel({ payments, currency, methods, showHandover = false }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const [dialog, setDialog] = useState(null);
    const close = (open) => !open && setDialog(null);

    if (payments.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col border-t">
            <ul className="flex flex-col divide-y">
                {payments.map((payment) => {
                    const detail = [
                        payment.paidTo,
                        t(`finance.otherPayments.${payment.status === 'paid' ? 'paidOn' : 'dateOn'}`, { date: formatDate(payment.date) }),
                        payment.method && t(`leasing.methods.${payment.method}`),
                        payment.reference,
                        showHandover &&
                            payment.handedOverOn &&
                            t('propertyPayments.receipts.confirmedBy', { name: payment.handedOverTo ?? '—', date: formatDate(payment.handedOverOn) }),
                    ]
                        .filter(Boolean)
                        .join(' · ');

                    return (
                        <li key={payment.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-4">
                            <div className={cn('flex min-w-0 flex-1 items-center gap-3', payment.status === 'cancelled' && 'opacity-60')}>
                                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TILE_TONES[payment.status])}>
                                    <ReceiptIcon aria-hidden="true" className="size-5" />
                                </span>
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                        <span dir="auto" className="min-w-0 truncate font-heading text-base font-bold">
                                            {payment.title}
                                        </span>
                                        <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                            {payment.number}
                                        </span>
                                        <OtherPaymentStatusBadge status={payment.status} isOverdue={payment.isOverdue} />
                                        {showHandover && payment.status === 'paid' && <HandoverBadge item={payment} spent />}
                                    </span>
                                    <span dir="auto" className="line-clamp-2 text-xs text-muted-foreground sm:truncate">
                                        {detail}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 md:shrink-0 md:justify-end">
                                <span
                                    className={cn(
                                        'font-heading text-[0.9375rem] font-bold tabular-nums',
                                        payment.status === 'paid' && 'text-success',
                                        payment.status === 'cancelled' && 'text-muted-foreground line-through',
                                    )}
                                >
                                    {formatCurrency(payment.amount, currency)}
                                </span>
                                <span className="flex items-center gap-1">
                                    {payment.status === 'pending' && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ type: 'pay', payment })} className="text-success">
                                            <CircleCheckIcon data-icon="inline-start" />
                                            {t('finance.otherPayments.actions.paid')}
                                        </Button>
                                    )}
                                    <PaymentActions payment={payment} onOpen={(type) => setDialog({ type, payment })} />
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {dialog?.type === 'pay' && <PayDialog key={dialog.payment.id} payment={dialog.payment} currency={currency} methods={methods} open onOpenChange={close} />}
            {dialog?.type === 'cancel' && <CancelDialog key={dialog.payment.id} payment={dialog.payment} open onOpenChange={close} />}
        </div>
    );
}
