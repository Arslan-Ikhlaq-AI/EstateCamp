import ActionDialog from '@/Components/ActionDialog';
import DataTable from '@/Components/DataTable';
import { InvoiceStatusBadge } from '@/Components/LeasingBadges';
import { usePeriodLabel } from '@/Components/PeriodFilter';
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
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import { BanIcon, EyeIcon, FileSignatureIcon, FileTextIcon, MoreHorizontalIcon, PencilIcon, ReceiptIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Whether `start`–`end` is a whole calendar month, rather than the part of
 * one a contract ran.
 */
export function isWholeMonth(start, end) {
    const [year, month] = start.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return start.endsWith('-01') && end === `${start.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
}

/**
 * What the gas came to: "150 units × AED 2.50" with the meter readings, or a fixed charge.
 */
function GasUsage({ bill, currency }) {
    const { t, formatNumber, formatMoney } = useTranslation();

    if (!bill.metered) {
        return <span className="text-sm text-muted-foreground">{t('finance.gas.fixed')}</span>;
    }

    return (
        <div className="flex flex-col">
            <span className="text-sm tabular-nums">{t('finance.gas.usage', { units: formatNumber(bill.units), rate: formatMoney(bill.unitRate, currency) })}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
                {t('finance.gas.readings', { from: formatNumber(bill.previousReading), to: formatNumber(bill.currentReading) })}
            </span>
        </div>
    );
}

/**
 * Where the bill's invoice stands, with what is paid or when it is due.
 */
function GasBillStatus({ bill, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const { invoice } = bill;

    return (
        <div className="flex flex-col items-start gap-0.5">
            <InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} />
            {invoice.status === 'partially_paid' && <span className="text-xs text-muted-foreground tabular-nums">{t('finance.gas.paid', { amount: formatMoney(invoice.amountPaid, currency) })}</span>}
            {invoice.status === 'issued' && (
                <span className={cn('text-xs tabular-nums', invoice.isOverdue ? 'text-destructive' : 'text-muted-foreground')}>{t('finance.gas.due', { date: formatDate(invoice.dueDate) })}</span>
            )}
        </div>
    );
}

/**
 * Void a bill nothing has been paid towards: its invoice is cancelled and
 * the month can be billed again.
 */
function VoidDialog({ bill, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({});

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.gas.void.title', { number: bill.invoice.number })}
            description={t('finance.gas.void.description')}
            submitLabel={t('finance.gas.void.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('invoices.void', bill.invoice.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        />
    );
}

/**
 * The row menu of a bill: its invoice, paying it, correcting or voiding it
 * while nothing is paid, the supplier's bill and the contract.
 */
function BillActions({ bill, showContract, onVoid }) {
    const { t } = useTranslation();
    const isOpen = bill.invoice.status !== 'void' && bill.invoice.balance > 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('finance.gas.actions.menu', { number: bill.invoice.number })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{bill.invoice.number}</DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('invoices.show', bill.invoice.id)} />}>
                        <EyeIcon />
                        {t('finance.gas.actions.invoice')}
                    </DropdownMenuItem>
                    {isOpen && (
                        <DropdownMenuItem render={<Link href={route('payments.create', { client: bill.client.id, invoice: bill.invoice.id })} />}>
                            <ReceiptIcon />
                            {t('finance.gas.actions.pay')}
                        </DropdownMenuItem>
                    )}
                    {bill.canEdit && (
                        <DropdownMenuItem render={<Link href={route('gas-bills.edit', bill.id)} />}>
                            <PencilIcon />
                            {t('finance.gas.actions.edit')}
                        </DropdownMenuItem>
                    )}
                    {bill.document && (
                        <DropdownMenuItem render={<a href={bill.document.url} target="_blank" rel="noreferrer" />}>
                            <FileTextIcon />
                            {t('finance.gas.actions.document')}
                        </DropdownMenuItem>
                    )}
                    {showContract && (
                        <DropdownMenuItem render={<Link href={route('contracts.show', bill.contract.id)} />}>
                            <FileSignatureIcon />
                            {t('finance.gas.actions.contract')}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                {bill.canEdit && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={onVoid}>
                            <BanIcon />
                            {t('finance.gas.actions.void')}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Gas bills in a table: the invoice and month, who was billed and where,
 * the gas used, the total and where the invoice stands, with each bill's
 * menu. On the contract's own page (`showClient` off) the client is left
 * out and the property goes under the month, to fit the narrower column.
 */
export default function GasBillTable({ bills, currency, showClient = true }) {
    const { t, formatMoney, formatNumber } = useTranslation();
    const { name } = usePeriodLabel();
    const { period } = useLeasingFormat();
    const [voiding, setVoiding] = useState(null);

    const columns = [
        {
            id: 'bill',
            header: t('finance.gas.columns.bill'),
            cell: (bill) => (
                <div className="flex flex-col">
                    <Link href={route('invoices.show', bill.invoice.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {bill.invoice.number}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {isWholeMonth(bill.periodStart, bill.periodEnd) ? name({ kind: 'month', from: bill.periodStart }) : period(bill.periodStart, bill.periodEnd)}
                    </span>
                    {!showClient && (
                        <span dir="auto" className="max-w-48 truncate text-xs text-muted-foreground">
                            {bill.property.name}
                        </span>
                    )}
                </div>
            ),
        },
        ...(showClient
            ? [
                  {
                      id: 'client',
                      header: t('finance.gas.columns.client'),
                      cell: (bill) => (
                          <div className="flex max-w-56 flex-col">
                              <Link href={route('clients.show', bill.client.id)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                                  {bill.client.name}
                              </Link>
                              <Link href={route('contracts.show', bill.contract.id)} className="text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                                  {bill.contract.number}
                              </Link>
                          </div>
                      ),
                  },
                  {
                      id: 'property',
                      header: t('finance.gas.columns.property'),
                      cell: (bill) => (
                          <div className="flex max-w-48 flex-col">
                              <span dir="auto" className="truncate">
                                  {bill.property.name}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">{bill.property.code}</span>
                          </div>
                      ),
                  },
              ]
            : []),
        { id: 'usage', header: t('finance.gas.columns.usage'), cell: (bill) => <GasUsage bill={bill} currency={currency} /> },
        {
            id: 'total',
            header: t('finance.gas.columns.total'),
            align: 'end',
            cell: (bill) => (
                <div className="flex flex-col items-end">
                    <span className={cn('font-semibold tabular-nums', bill.invoice.status === 'void' && 'text-muted-foreground line-through')}>{formatMoney(bill.invoice.total, currency)}</span>
                    {bill.vatRate > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">{t('finance.gas.plusVat', { amount: formatMoney(bill.amount, currency), rate: formatNumber(bill.vatRate) })}</span>
                    )}
                </div>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (bill) => <GasBillStatus bill={bill} currency={currency} /> },
    ];

    return (
        <>
            <DataTable columns={columns} rows={bills} actions={(bill) => <BillActions bill={bill} showContract={showClient} onVoid={() => setVoiding(bill)} />} />
            {voiding && <VoidDialog key={voiding.id} bill={voiding} open onOpenChange={(open) => !open && setVoiding(null)} />}
        </>
    );
}
