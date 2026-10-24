import ChequeSchedule from '@/Components/ChequeSchedule';
import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import { METHOD_ICONS, ReceiptStatusBadge, RentalStatusBadge, RentStandingBadge, StandingDetail, useRentalPlace } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
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
import { Head, Link } from '@inertiajs/react';
import { BanIcon, CalendarCheckIcon, CalendarClockIcon, CircleAlertIcon, DoorOpenIcon, MoreHorizontalIcon, PencilIcon, PrinterIcon, ReceiptIcon, ShieldCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { EndRentalDialog, RecordPaymentDialog, VoidReceiptDialog } from './Partials/RentalDialogs';

const STATEMENT_TONES = { paid: 'success', partial: 'warning', unpaid: 'danger', upcoming: 'muted' };

function ReceiptActions({ payment, onVoid }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('finance.receipts.actions.menu', { number: payment.number })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{payment.number}</DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('rental-payments.show', payment.id)} />}>
                        <PrinterIcon />
                        {t('finance.receipts.actions.open')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                {payment.status !== 'void' && !payment.fromCheque && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={onVoid}>
                            <BanIcon />
                            {t('finance.receipts.actions.void')}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * One individual rental: where the tenant's rent stands, each month of
 * rent and what was paid towards it, their receipts and cheques, and
 * recording a payment or moving them out.
 */
export default function Show({ rental, statement, payments, cheques, pendingCheques, banks, chequeStatuses, methods, refundMethods, currency }) {
    const { t, formatMoney, formatDate, formatCurrency } = useTranslation();
    const { period } = useLeasingFormat();
    const place = useRentalPlace();
    const [dialog, setDialog] = useState(null);
    const close = (open) => !open && setDialog(null);
    const { standing, deposit } = rental;
    const isActive = rental.status === 'active';

    const receiptColumns = [
        {
            id: 'receipt',
            header: t('finance.receipts.columns.receipt'),
            cell: (payment) => (
                <div className="flex flex-col">
                    <Link
                        href={route('rental-payments.show', payment.id)}
                        className={cn('font-medium underline-offset-4 hover:text-brand-ink hover:underline', payment.status === 'void' && 'text-muted-foreground line-through')}
                    >
                        {payment.number}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatDate(payment.paidOn)}</span>
                </div>
            ),
        },
        {
            id: 'for',
            header: t('finance.receipts.columns.for'),
            cell: (payment) => (
                <div className="flex flex-col text-sm">
                    <span>{t(`finance.receipts.purposes.${payment.purpose}`)}</span>
                    {payment.periodStart && <span className="text-xs text-muted-foreground">{period(payment.periodStart, payment.periodEnd)}</span>}
                    {payment.status === 'void' && payment.voidReason && <span className="max-w-48 truncate text-xs text-muted-foreground">{payment.voidReason}</span>}
                </div>
            ),
        },
        {
            id: 'method',
            header: t('leasing.payments.columns.method'),
            cell: (payment) => {
                const Icon = METHOD_ICONS[payment.method];

                return (
                    <div className="flex flex-col text-sm">
                        <span className="flex items-center gap-1.5">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {t(`leasing.methods.${payment.method}`)}
                        </span>
                        {payment.reference && <span className="max-w-40 truncate font-mono text-xs text-muted-foreground">{payment.reference}</span>}
                    </div>
                );
            },
        },
        {
            id: 'amount',
            header: t('leasing.common.amount'),
            align: 'end',
            cell: (payment) => <span className={cn('font-semibold tabular-nums', payment.status === 'void' && 'text-muted-foreground line-through')}>{formatMoney(payment.amount, currency)}</span>,
        },
        { id: 'status', header: t('leasing.common.status'), cell: (payment) => <ReceiptStatusBadge status={payment.status} /> },
    ];

    const statementColumns = [
        { id: 'month', header: t('finance.rentals.statement.month'), cell: (line) => <span className="tabular-nums">{period(line.start, line.end)}</span> },
        { id: 'amount', header: t('finance.rentals.statement.rent'), align: 'end', cell: (line) => <span className="tabular-nums">{formatMoney(line.amount, currency)}</span> },
        { id: 'paid', header: t('finance.rentals.statement.paid'), align: 'end', cell: (line) => <span className="tabular-nums">{line.paid > 0 ? formatMoney(line.paid, currency) : '—'}</span> },
        {
            id: 'status',
            header: t('leasing.common.status'),
            cell: (line) => <ToneBadge tone={STATEMENT_TONES[line.status]}>{t(`finance.rentals.statement.status.${line.status}`)}</ToneBadge>,
        },
    ];

    return (
        <DashboardLayout>
            <Head title={rental.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('finance.rentals.title'), href: route('rentals.index') }, { label: rental.number }]}
                title={rental.number}
                badge={
                    <>
                        <RentalStatusBadge status={rental.status} />
                        <RentStandingBadge standing={standing.standing} />
                    </>
                }
                description={
                    <span>
                        <Link href={route('clients.show', rental.client.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {rental.client.name}
                        </Link>{' '}
                        · {place(rental)} · {rental.property?.name}
                    </span>
                }
                actions={
                    <>
                        {isActive && (
                            <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.edit', rental.id)} />}>
                                <PencilIcon data-icon="inline-start" />
                                {t('finance.rentals.edit')}
                            </Button>
                        )}
                        {isActive && (
                            <Button variant="outline" onClick={() => setDialog({ type: 'end' })}>
                                <DoorOpenIcon data-icon="inline-start" />
                                {t('finance.rentals.end.button')}
                            </Button>
                        )}
                        <Button onClick={() => setDialog({ type: 'pay' })}>
                            <ReceiptIcon data-icon="inline-start" />
                            {t('finance.rentals.payment.button')}
                        </Button>
                    </>
                }
            />

            <FlashMessages errorKeys={['moved_out_on', 'deposit_refunded', 'reason', 'monthly_rent']} />

            <section aria-label={t('finance.rentals.show.figures')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={CircleAlertIcon}
                    tone={standing.standing === 'overdue' ? 'warning' : standing.arrears > 0 ? 'gold' : 'success'}
                    label={t('finance.rentals.show.owed')}
                    value={formatCurrency(Math.max(0, standing.arrears), currency)}
                    detail={<StandingDetail standing={standing} currency={currency} className="text-[0.875rem]" />}
                />
                <StatCard
                    icon={CalendarCheckIcon}
                    label={t('finance.rentals.show.paidThrough')}
                    value={standing.paidThrough ? formatDate(standing.paidThrough) : '—'}
                    detail={t('finance.rentals.show.paidTotal', { amount: formatMoney(standing.paid, currency), due: formatMoney(standing.due, currency) })}
                />
                <StatCard
                    icon={CalendarClockIcon}
                    tone="gold"
                    label={t('finance.rentals.show.nextDue')}
                    value={standing.nextDue && isActive ? formatDate(standing.nextDue) : '—'}
                    detail={
                        standing.nextDue && isActive
                            ? t('finance.rentals.show.nextDueDetail', { amount: formatMoney(standing.nextDueAmount, currency) })
                            : pendingCheques.count > 0
                              ? t('finance.rentals.show.chequesWaiting', { count: pendingCheques.count, amount: formatMoney(pendingCheques.amount, currency) })
                              : t('finance.rentals.show.nothingDue')
                    }
                />
                <StatCard
                    icon={ShieldCheckIcon}
                    label={t('finance.rentals.show.deposit')}
                    value={formatCurrency(deposit.held, currency)}
                    detail={
                        deposit.toCollect > 0
                            ? t('finance.rentals.show.depositToCollect', { amount: formatMoney(deposit.toCollect, currency) })
                            : deposit.refunded > 0
                              ? t('finance.rentals.show.depositRefunded', { amount: formatMoney(deposit.refunded, currency) })
                              : t('finance.rentals.show.depositAgreed', { amount: formatMoney(deposit.agreed, currency) })
                    }
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
                    <SectionCard
                        title={t('finance.rentals.statement.title')}
                        description={t('finance.rentals.statement.description')}
                        flush
                    >
                        {statement.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-muted-foreground">{t('finance.rentals.statement.empty')}</p>
                        ) : (
                            <DataTable columns={statementColumns} rows={statement} rowKey="start" />
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('finance.rentals.show.receipts')}
                        description={t('finance.rentals.show.receiptsDescription')}
                        action={
                            <Button variant="outline" size="sm" onClick={() => setDialog({ type: 'pay' })}>
                                <ReceiptIcon data-icon="inline-start" />
                                {t('finance.rentals.payment.button')}
                            </Button>
                        }
                        flush
                    >
                        {payments.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-muted-foreground">{t('finance.rentals.show.noReceipts')}</p>
                        ) : (
                            <DataTable columns={receiptColumns} rows={payments} actions={(payment) => <ReceiptActions payment={payment} onVoid={() => setDialog({ type: 'void', payment })} />} />
                        )}
                    </SectionCard>

                    <SectionCard title={t('finance.rentals.show.cheques')} description={t('finance.rentals.show.chequesDescription')} flush>
                        {cheques.length === 0 ? (
                            <p className="px-6 py-8 text-sm text-muted-foreground">{t('finance.rentals.show.noCheques')}</p>
                        ) : (
                            <ChequeSchedule cheques={cheques} currency={currency} statuses={chequeStatuses} banks={banks} />
                        )}
                    </SectionCard>
                </div>

                <aside className="flex flex-col gap-6">
                    <SectionCard title={t('finance.rentals.show.tenant')}>
                        <DetailList
                            columns={1}
                            rows={[
                                {
                                    label: t('finance.rentals.form.name'),
                                    value: (
                                        <Link href={route('clients.show', rental.client.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                                            {rental.client.name}
                                        </Link>
                                    ),
                                },
                                { label: t('finance.rentals.form.phone'), value: rental.client.phone },
                                { label: t('finance.rentals.form.email'), value: rental.client.email },
                                { label: t('finance.rentals.form.nationality'), value: rental.client.nationality },
                                { label: t('finance.rentals.form.idNumber'), value: rental.client.id_number ? `${t(`leasing.idTypes.${rental.client.id_type}`)} · ${rental.client.id_number}` : null },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title={t('finance.rentals.show.terms')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('finance.rentals.columns.place'), value: `${place(rental)} · ${rental.property?.name ?? ''}` },
                                { label: t('finance.rentals.form.monthlyRent'), value: formatMoney(rental.monthlyRent, currency) },
                                { label: t('finance.rentals.form.deposit'), value: rental.securityDeposit > 0 ? formatMoney(rental.securityDeposit, currency) : null },
                                { label: t('finance.rentals.form.startDate'), value: formatDate(rental.startDate) },
                                { label: t('finance.rentals.form.endDate'), value: rental.endDate ? formatDate(rental.endDate) : t('finance.rentals.openEnded') },
                                ...(rental.movedOutOn ? [{ label: t('finance.rentals.show.movedOut'), value: formatDate(rental.movedOutOn) }] : []),
                                ...(rental.depositRefund
                                    ? [{ label: t('finance.rentals.show.refund'), value: `${formatMoney(rental.depositRefund.amount, currency)} · ${t(`leasing.methods.${rental.depositRefund.method}`)}` }]
                                    : []),
                                ...(rental.otherPaid > 0 ? [{ label: t('finance.rentals.show.otherPaid'), value: formatMoney(rental.otherPaid, currency) }] : []),
                                { label: t('finance.rentals.show.createdBy'), value: [rental.createdBy, rental.createdAt && formatDate(rental.createdAt)].filter(Boolean).join(' · ') },
                            ]}
                        />
                    </SectionCard>

                    {rental.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                {rental.notes}
                            </p>
                        </SectionCard>
                    )}
                </aside>
            </div>

            {dialog?.type === 'pay' && <RecordPaymentDialog rental={rental} currency={currency} banks={banks} methods={methods} open onOpenChange={close} />}
            {dialog?.type === 'end' && <EndRentalDialog rental={rental} currency={currency} refundMethods={refundMethods} open onOpenChange={close} />}
            {dialog?.type === 'void' && <VoidReceiptDialog key={dialog.payment.id} payment={dialog.payment} currency={currency} open onOpenChange={close} />}
        </DashboardLayout>
    );
}
