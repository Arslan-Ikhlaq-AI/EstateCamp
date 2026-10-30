import { BillStatusBadge, METHOD_ICONS } from '@/Components/FinanceBadges';
import { ToneBadge } from '@/Components/LeasingBadges';
import { useUnitLabel } from '@/Components/MaintenanceBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { CheckIcon, CircleDashedIcon, StampIcon, WrenchIcon } from 'lucide-react';
import { HandoverBadge } from './CashHandover';

/**
 * What a bill cost, how it is paid and a tick to pay it today. The amount
 * starts at the cost on file and can be changed, or typed in for work not
 * costed yet; paying records it as the cost and issues a voucher. Paid
 * other than in cash, it can carry the cheque or transfer reference.
 */
function PayBillForm({ bill, currency, methods }) {
    const { t } = useTranslation();
    const form = useForm({
        amount: bill.amount === null ? '' : String(bill.amount),
        payment_method: methods.includes(bill.paymentMethod) ? bill.paymentMethod : methods[0],
        reference: '',
    });
    const amount = Number(form.data.amount) || 0;
    const methodItems = methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`), icon: METHOD_ICONS[method] }));
    const error = Object.values(form.errors)[0];

    const submit = (event) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, paid_on: todayIso() }));
        form.post(route('maintenance-bills.pay', bill.id), { preserveScroll: true, preserveState: true });
    };

    return (
        <form onSubmit={submit} aria-label={t('propertyPayments.bills.payLabel', { number: bill.number })} className="flex flex-col gap-1.5 md:items-end">
            <div className="flex w-full items-center gap-2">
                <InputGroup className="min-w-0 flex-1 md:w-44 md:flex-none">
                    <InputGroupAddon>
                        <InputGroupText>{currency}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={form.data.amount}
                        onChange={(event) => form.setData('amount', event.target.value)}
                        placeholder={t('propertyPayments.bills.placeholder')}
                        aria-label={t('propertyPayments.bills.amount')}
                        aria-invalid={Boolean(error)}
                        className="tabular-nums"
                    />
                </InputGroup>
                <Select items={methodItems} value={form.data.payment_method} onValueChange={(value) => form.setData('payment_method', value)}>
                    <SelectTrigger aria-label={t('propertyPayments.bills.method')} className="w-30 shrink-0 md:w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {methodItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    <item.icon />
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="submit"
                                variant="brand"
                                size="icon"
                                className="shrink-0"
                                disabled={form.processing || amount <= 0}
                                aria-label={t('propertyPayments.bills.pay')}
                            />
                        }
                    >
                        {form.processing ? <Spinner /> : <CheckIcon />}
                    </TooltipTrigger>
                    <TooltipContent>{t('propertyPayments.bills.pay')}</TooltipContent>
                </Tooltip>
            </div>
            {form.data.payment_method !== 'cash' && (
                <Input
                    value={form.data.reference}
                    onChange={(event) => form.setData('reference', event.target.value)}
                    maxLength={100}
                    placeholder={t(`propertyPayments.bills.reference.${form.data.payment_method === 'cheque' ? 'cheque' : 'other'}`)}
                    aria-label={t(`propertyPayments.bills.reference.${form.data.payment_method === 'cheque' ? 'cheque' : 'other'}`)}
                    className="h-8 w-full font-mono text-sm md:w-[calc(11rem+9rem+0.5rem)]"
                />
            )}
            {error && <p className="text-xs text-destructive md:text-end">{error}</p>}
        </form>
    );
}

/**
 * A paid bill: what it cost, when and how it was paid, and its voucher.
 */
function PaidBill({ bill, currency }) {
    const { t, formatCurrency, formatDate } = useTranslation();

    return (
        <div className="flex flex-col gap-0.5 md:items-end">
            <span className="font-heading text-[0.9375rem] font-bold text-success tabular-nums">{formatCurrency(bill.amount, currency)}</span>
            <span className="text-xs text-muted-foreground">
                {[t('propertyPayments.bills.paidOn', { date: formatDate(bill.paidOn), method: t(`leasing.methods.${bill.paymentMethod}`) }), bill.paymentReference]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
            {bill.voucherNumber && (
                <Link
                    href={route('maintenance-bills.voucher', bill.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
                >
                    <StampIcon aria-hidden="true" className="size-3.5" />
                    {t('propertyPayments.bills.voucher', { number: bill.voucherNumber })}
                </Link>
            )}
        </div>
    );
}

/**
 * Maintenance work done here that the company pays for: bills still
 * unpaid or not costed yet, each paid in its row by typing the amount,
 * choosing how and ticking, and bills paid, with their voucher. Bills the
 * camp boss paid in cash say whether they are settled with an admin when
 * `showHandover` is set. Nothing is shown when there are no bills.
 */
export default function MaintenanceBillsPanel({ bills, currency, methods, showHandover = false }) {
    const { t, formatDate } = useTranslation();
    const unitLabel = useUnitLabel();

    if (bills.length === 0) {
        return null;
    }

    return (
        <ul className="flex flex-col divide-y border-t">
            {bills.map((bill) => {
                const detail = [
                    unitLabel(bill),
                    bill.vendor ?? t('finance.bills.noVendor'),
                    bill.completedOn ? t('finance.bills.finishedOn', { date: formatDate(bill.completedOn) }) : null,
                    showHandover && bill.handedOverOn && t('propertyPayments.receipts.confirmedBy', { name: bill.handedOverTo ?? '—', date: formatDate(bill.handedOverOn) }),
                ]
                    .filter(Boolean)
                    .join(' · ');

                return (
                    <li key={bill.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span
                                className={cn(
                                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                    bill.isPaid ? 'bg-success/12 text-success' : 'bg-gold/20 text-gold-ink',
                                )}
                            >
                                <WrenchIcon aria-hidden="true" className="size-5" />
                            </span>
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                    <Link
                                        href={route('maintenance.show', bill.id)}
                                        dir="auto"
                                        className="min-w-0 truncate font-heading text-base font-bold underline-offset-4 hover:text-brand-ink hover:underline"
                                    >
                                        {bill.title}
                                    </Link>
                                    <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                        {bill.number}
                                    </span>
                                    {bill.amount === null ? (
                                        <ToneBadge tone="muted" icon={CircleDashedIcon}>
                                            {t('propertyPayments.bills.noCost')}
                                        </ToneBadge>
                                    ) : (
                                        <BillStatusBadge isPaid={bill.isPaid} />
                                    )}
                                    {showHandover && bill.isPaid && <HandoverBadge item={bill} spent />}
                                </span>
                                <span dir="auto" className="line-clamp-2 text-xs text-muted-foreground sm:truncate">
                                    {detail}
                                </span>
                            </div>
                        </div>
                        <div className="md:shrink-0">
                            {bill.isPaid ? <PaidBill bill={bill} currency={currency} /> : <PayBillForm bill={bill} currency={currency} methods={methods} />}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
