import ActionDialog from '@/Components/ActionDialog';
import DataTable from '@/Components/DataTable';
import { BillStatusBadge, METHOD_ICONS } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import { SelectField, TextField } from '@/Components/FormFields';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Head, Link, useForm } from '@inertiajs/react';
import {
    Building2Icon,
    CircleAlertIcon,
    CircleCheckIcon,
    ExternalLinkIcon,
    EyeIcon,
    FileTextIcon,
    HandCoinsIcon,
    MoreHorizontalIcon,
    ReceiptTextIcon,
    StampIcon,
    TruckIcon,
    Undo2Icon,
    WrenchIcon,
} from 'lucide-react';
import { useState } from 'react';

const STATUS_ICONS = { unpaid: HandCoinsIcon, paid: CircleCheckIcon };

/**
 * Pay a maintenance bill: the day, how, and a reference. A voucher is issued.
 */
function PayBillDialog({ bill, currency, paymentMethods, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ paid_on: todayIso(), payment_method: bill.paymentMethod ?? paymentMethods[0], reference: '' });
    const { data, setData, errors, processing } = form;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.bills.pay.title', { number: bill.number })}
            description={t('finance.bills.pay.description', { amount: formatMoney(bill.amount, currency), vendor: bill.vendor ?? t('finance.bills.noVendor') })}
            submitLabel={t('finance.bills.pay.submit')}
            processing={processing}
            onSubmit={() => form.post(route('maintenance-bills.pay', bill.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            {errors.bill && (
                <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{errors.bill}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField id="bill-paid-on" type="date" label={t('finance.bills.pay.paidOn')} value={data.paid_on} max={todayIso()} onChange={(value) => setData('paid_on', value)} error={errors.paid_on} />
                <SelectField
                    id="bill-method"
                    label={t('finance.bills.pay.method')}
                    value={data.payment_method}
                    onChange={(value) => setData('payment_method', value)}
                    items={paymentMethods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                    error={errors.payment_method}
                />
                <TextField
                    id="bill-reference"
                    label={t('finance.bills.pay.reference')}
                    placeholder={t('finance.bills.pay.referencePlaceholder')}
                    value={data.reference}
                    onChange={(value) => setData('reference', value)}
                    error={errors.reference}
                    optional
                    className="sm:col-span-2"
                />
            </FieldGroup>
        </ActionDialog>
    );
}

function UnpayDialog({ bill, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({});

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.bills.unpay.title', { number: bill.number })}
            description={t('finance.bills.unpay.description', { voucher: bill.voucherNumber ?? '—' })}
            submitLabel={t('finance.bills.unpay.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('maintenance-bills.unpay', bill.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        />
    );
}

function BillActions({ bill, onPay, onUnpay }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('finance.bills.actions.menu', { number: bill.number })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{bill.number}</DropdownMenuLabel>
                    {bill.isPaid ? (
                        <DropdownMenuItem render={<Link href={route('maintenance-bills.voucher', bill.id)} />}>
                            <StampIcon />
                            {t('finance.bills.actions.voucher')}
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem onClick={onPay}>
                            <HandCoinsIcon />
                            {t('finance.bills.actions.pay')}
                        </DropdownMenuItem>
                    )}
                    {bill.invoiceUrl && (
                        <DropdownMenuItem render={<a href={bill.invoiceUrl} target="_blank" rel="noreferrer" />}>
                            <ExternalLinkIcon />
                            {t('finance.bills.actions.invoice')}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem render={<Link href={route('maintenance.show', bill.id)} />}>
                        <EyeIcon />
                        {t('finance.bills.actions.job')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                {bill.isPaid && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={onUnpay}>
                            <Undo2Icon />
                            {t('finance.bills.actions.unpay')}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Maintenance bills: what finished work cost, paying the vendors, and the
 * voucher kept for each payment.
 */
export default function Index({ company, filters, period, facets, summary, bills, paymentMethods }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { full } = usePeriodLabel();
    const [dialog, setDialog] = useState(null);
    const close = (open) => !open && setDialog(null);
    const title = t('finance.bills.title');
    const range = summary ? (summary.inPeriod ? full(period) : t('finance.lists.thisMonth')) : '';

    const columns = [
        {
            id: 'bill',
            header: t('finance.bills.columns.bill'),
            cell: (bill) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('maintenance.show', bill.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {bill.number}
                    </Link>
                    <span dir="auto" className="max-w-56 truncate text-xs text-muted-foreground">
                        {bill.title}
                    </span>
                </div>
            ),
        },
        {
            id: 'where',
            header: t('finance.bills.columns.where'),
            cell: (bill) => (
                <div className="flex max-w-48 flex-col">
                    <span className="truncate">{bill.property?.name ?? '—'}</span>
                    {bill.unit && <span className="truncate text-xs text-muted-foreground">{t(`finance.bills.units.${bill.unit.type}`, { number: bill.unit.number ?? '—' })}</span>}
                </div>
            ),
        },
        {
            id: 'vendor',
            header: t('finance.bills.columns.vendor'),
            cell: (bill) => (
                <div className="flex max-w-48 flex-col">
                    <span dir="auto" className="truncate">
                        {bill.vendor ?? '—'}
                    </span>
                    {bill.invoiceNumber && (
                        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <FileTextIcon className="size-3" />
                            {bill.invoiceUrl ? (
                                <a href={bill.invoiceUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-brand-ink hover:underline">
                                    {bill.invoiceNumber}
                                </a>
                            ) : (
                                bill.invoiceNumber
                            )}
                        </span>
                    )}
                </div>
            ),
        },
        { id: 'amount', header: t('leasing.common.amount'), align: 'end', cell: (bill) => <span className="font-semibold tabular-nums">{formatMoney(bill.amount, company.currency)}</span> },
        {
            id: 'status',
            header: t('leasing.common.status'),
            cell: (bill) => (
                <div className="flex flex-col items-start gap-0.5">
                    <BillStatusBadge isPaid={bill.isPaid} />
                    {bill.isPaid ? (
                        <Link href={route('maintenance-bills.voucher', bill.id)} className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                            {(() => {
                                const Icon = METHOD_ICONS[bill.paymentMethod];

                                return Icon ? <Icon className="size-3" /> : null;
                            })()}
                            {[bill.voucherNumber, formatDate(bill.paidOn)].filter(Boolean).join(' · ')}
                        </Link>
                    ) : (
                        bill.completedOn && <span className="text-xs text-muted-foreground">{t('finance.bills.finishedOn', { date: formatDate(bill.completedOn) })}</span>
                    )}
                </div>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.payments') }, { label: title }]}
                title={title}
                count={bills?.total}
                description={t('finance.bills.description')}
                actions={
                    company && (
                        <Button variant="outline" nativeButton={false} render={<Link href={route('maintenance.index')} />}>
                            <WrenchIcon data-icon="inline-start" />
                            {t('finance.bills.openMaintenance')}
                        </Button>
                    )
                }
            />

            <FlashMessages errorKeys={['bill']} />

            {company === null ? (
                <NoCompany icon={ReceiptTextIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.bills.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={HandCoinsIcon}
                            tone={summary.unpaid.count > 0 ? 'warning' : 'success'}
                            label={t('finance.bills.stats.unpaid')}
                            value={formatCurrency(summary.unpaid.amount, company.currency)}
                            detail={summary.unpaid.count > 0 ? t('finance.bills.stats.unpaidDetail', { count: summary.unpaid.count }) : t('finance.bills.stats.unpaidNone')}
                            href={route('maintenance-bills.index', { status: ['unpaid'] })}
                        />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('finance.bills.stats.paid')}
                            value={formatCurrency(summary.paid.amount, company.currency)}
                            detail={t('finance.bills.stats.paidDetail', { count: summary.paid.count, period: range })}
                        />
                        <StatCard
                            icon={ReceiptTextIcon}
                            tone="gold"
                            label={t('finance.bills.stats.billed')}
                            value={formatCurrency(summary.billed.amount, company.currency)}
                            detail={t('finance.bills.stats.billedDetail', { count: summary.billed.count, period: range })}
                        />
                        <StatCard icon={TruckIcon} label={t('finance.bills.stats.vendors')} value={summary.vendors} detail={range} />
                    </section>

                    <RecordList
                        routeName="maintenance-bills.index"
                        filters={filters}
                        period={period}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`finance.bills.status.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{ status: t('leasing.common.status'), method: t('leasing.payments.columns.method'), properties: t('finance.rentals.filters.properties') }}
                        only={['bills', 'facets', 'summary']}
                        paginator={bills}
                        searchLabel={t('finance.bills.searchLabel')}
                        searchPlaceholder={t('finance.bills.searchPlaceholder')}
                        empty={<ListEmpty icon={ReceiptTextIcon} title={t('finance.bills.empty.title')} description={t('finance.bills.empty.description')} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={bills.data}
                            actions={(bill) => <BillActions bill={bill} onPay={() => setDialog({ type: 'pay', bill })} onUnpay={() => setDialog({ type: 'unpay', bill })} />}
                        />
                    </RecordList>
                </>
            )}

            {dialog?.type === 'pay' && <PayBillDialog key={dialog.bill.id} bill={dialog.bill} currency={company.currency} paymentMethods={paymentMethods} open onOpenChange={close} />}
            {dialog?.type === 'unpay' && <UnpayDialog key={dialog.bill.id} bill={dialog.bill} open onOpenChange={close} />}
        </DashboardLayout>
    );
}
