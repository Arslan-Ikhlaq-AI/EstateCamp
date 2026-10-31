import ActionDialog from '@/Components/ActionDialog';
import ChequeSchedule from '@/Components/ChequeSchedule';
import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { TextareaField, TextField } from '@/Components/FormFields';
import { ContractStatusBadge, InvoiceStatusBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import PostButton from '@/Components/PostButton';
import PropertyHoldings from '@/Components/PropertyHoldings';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { todayIso, useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    BanknoteIcon,
    CalendarClockIcon,
    CircleCheckIcon,
    FilePlusIcon,
    LogInIcon,
    LogOutIcon,
    PencilIcon,
    RefreshCwIcon,
    UsersIcon,
    WalletCardsIcon,
    WalletIcon,
    XCircleIcon,
} from 'lucide-react';
import { useState } from 'react';
import DocumentsOnFile from '../HeadLeases/Partials/DocumentsOnFile';
import CheckOutDialog from '../Occupants/Partials/CheckOutDialog';

function TerminateDialog({ contract, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({ terminated_on: todayIso(), termination_reason: '' });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.contracts.terminate.title', { number: contract.number })}
            description={t('leasing.contracts.terminate.description')}
            submitLabel={t('leasing.contracts.terminate.submit')}
            destructive
            processing={form.processing}
            onSubmit={() =>
                form.post(route('contracts.terminate', contract.id), {
                    preserveScroll: true,
                    onSuccess: () => onOpenChange(false),
                })
            }
        >
            <FieldGroup className="grid gap-4">
                <TextField
                    id="terminated_on"
                    type="date"
                    label={t('leasing.contracts.terminate.date')}
                    value={form.data.terminated_on}
                    onChange={(value) => form.setData('terminated_on', value)}
                    error={form.errors.terminated_on}
                    max={todayIso()}
                />
                <TextareaField
                    id="termination_reason"
                    label={t('leasing.contracts.terminate.reason')}
                    value={form.data.termination_reason}
                    onChange={(value) => form.setData('termination_reason', value)}
                    error={form.errors.termination_reason}
                    optional
                    rows={2}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * A count at the top of the cheques section, such as "4 / 9 in hand".
 */
function ChequeFigure({ label, value, tone = 'muted' }) {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-0.5 rounded-xl px-3.5 py-2.5 ring-1',
                tone === 'warning' && 'bg-warning/[0.07] ring-warning/25',
                tone === 'danger' && 'bg-destructive/[0.06] ring-destructive/25',
                tone === 'success' && 'bg-success/[0.06] ring-success/20',
                tone === 'muted' && 'bg-muted/50 ring-foreground/[0.06]',
            )}
        >
            <span className="truncate text-xs text-muted-foreground">{label}</span>
            <span className="font-heading text-lg font-bold tabular-nums">{value}</span>
        </div>
    );
}

export default function Show({ contract, lines, stays, invoices, documents, totals, nextPeriod, cheques, chequeStats, banks, chequeStatuses, can, currency }) {
    const { t, formatCurrency, formatMoney, formatDate, formatNumber } = useTranslation();
    const { period, lineLabel } = useLeasingFormat();
    const [isTerminating, setIsTerminating] = useState(false);
    const [checkingOut, setCheckingOut] = useState(null);
    const current = stays.filter((stay) => stay.checkOutDate === null);
    const past = stays.filter((stay) => stay.checkOutDate !== null);
    const capacity = lines.reduce((sum, line) => sum + line.capacity, 0);
    const firstHousingLine = lines.find((line) => line.housesOccupants);

    const stayColumns = (withCheckOut) => [
        {
            id: 'name',
            header: t('leasing.occupants.columns.name'),
            cell: (stay) => (
                <div className="flex flex-col">
                    <Link href={route('occupants.show', stay.occupant.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                        {stay.occupant.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{stay.occupant.employeeNumber || t(`gender.${stay.occupant.gender}`)}</span>
                </div>
            ),
        },
        {
            id: 'room',
            header: t('leasing.occupants.columns.room'),
            cell: (stay) => (
                <div className="flex flex-col text-sm">
                    <span>{t('leasing.lines.roomName', { room: stay.roomNumber })}</span>
                    <span className="text-xs text-muted-foreground" dir="auto">{stay.propertyName}</span>
                </div>
            ),
        },
        {
            id: 'dates',
            header: withCheckOut ? t('leasing.occupants.columns.since') : t('leasing.occupants.columns.stayed'),
            cell: (stay) => <span className="text-sm tabular-nums">{withCheckOut ? formatDate(stay.checkInDate) : period(stay.checkInDate, stay.checkOutDate)}</span>,
        },
    ];

    return (
        <DashboardLayout>
            <Head title={contract.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('leasing.contracts.title'), href: route('contracts.index') }, { label: contract.number }]}
                title={contract.number}
                badge={<ContractStatusBadge status={contract.status} />}
                description={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={route('clients.show', contract.client.id)} className="font-medium text-foreground underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {contract.client.name}
                        </Link>
                        <PartyTypeBadge type={contract.client.type} />
                        <span>· {period(contract.startDate, contract.endDate)}</span>
                    </span>
                }
                actions={
                    <>
                        {can.edit && (
                            <Button variant="outline" nativeButton={false} render={<Link href={route('contracts.edit', contract.id)} />}>
                                <PencilIcon data-icon="inline-start" />
                                {t('leasing.common.edit')}
                            </Button>
                        )}
                        {can.terminate && (
                            <Button variant="outline" onClick={() => setIsTerminating(true)}>
                                <XCircleIcon data-icon="inline-start" />
                                {contract.status === 'draft' ? t('leasing.contracts.cancelDraft') : t('leasing.contracts.terminate.button')}
                            </Button>
                        )}
                        {can.renew && (
                            <PostButton variant="outline" href={route('contracts.renew', contract.id)} icon={RefreshCwIcon}>
                                {t('leasing.contracts.renew')}
                            </PostButton>
                        )}
                        {can.checkIn && firstHousingLine && (
                            <Button variant="outline" nativeButton={false} render={<Link href={route('occupancies.create', { contract_line: firstHousingLine.id })} />}>
                                <LogInIcon data-icon="inline-start" />
                                {t('leasing.checkIn.button')}
                            </Button>
                        )}
                        {can.invoice && (
                            <PostButton href={route('contracts.invoices.store', contract.id)} icon={FilePlusIcon}>
                                {t('leasing.contracts.invoiceNext', { period: period(nextPeriod.start, nextPeriod.end) })}
                            </PostButton>
                        )}
                        {can.activate && (
                            <PostButton href={route('contracts.activate', contract.id)} icon={CircleCheckIcon}>
                                {t('leasing.contracts.activate')}
                            </PostButton>
                        )}
                    </>
                }
            />

            <FlashMessages errorKeys={['status', 'lines', 'invoice', 'cheques', 'action']} />

            <section aria-label={t('leasing.contracts.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    label={t('leasing.contracts.columns.monthly')}
                    value={formatCurrency(contract.monthlyValue, currency)}
                    detail={t('leasing.contracts.show.cycleDetail', { cycle: t(`leasing.billingCycles.${contract.billingCycle}`) })}
                />
                <StatCard
                    icon={WalletIcon}
                    tone={totals.invoiced - totals.paid > 0 ? 'warning' : 'success'}
                    label={t('leasing.contracts.show.balance')}
                    value={formatMoney(totals.invoiced - totals.paid, currency)}
                    detail={t('leasing.contracts.show.balanceDetail', { invoiced: formatCurrency(totals.invoiced, currency), paid: formatCurrency(totals.paid, currency) })}
                />
                <StatCard
                    icon={UsersIcon}
                    label={t('leasing.contracts.show.staying')}
                    value={capacity > 0 ? `${formatNumber(current.length)} / ${formatNumber(capacity)}` : '—'}
                    meter={capacity > 0 ? (current.length / capacity) * 100 : undefined}
                    detail={capacity > 0 ? t('leasing.contracts.show.stayingDetail') : t('leasing.contracts.show.noHousing')}
                />
                <StatCard
                    icon={CalendarClockIcon}
                    tone={contract.status === 'active' && contract.daysLeft <= 60 ? 'warning' : 'primary'}
                    label={t('leasing.contracts.show.term')}
                    value={contract.status === 'active' ? t('leasing.common.daysLeft', { count: contract.daysLeft }) : t(`leasing.status.contract.${contract.status}`)}
                    detail={t('leasing.contracts.show.endsOn', { date: formatDate(contract.endDate) })}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard
                        title={t('leasing.cheques.schedule.title')}
                        description={t('leasing.cheques.schedule.description.received')}
                        flush
                        action={
                            can.edit && cheques.length > 0 ? (
                                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('contracts.edit', contract.id)} />}>
                                    <PencilIcon data-icon="inline-start" />
                                    {t('leasing.cheques.actions.record')}
                                </Button>
                            ) : null
                        }
                    >
                        {cheques.length === 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 lg:px-6">
                                <p className="max-w-xl text-sm text-muted-foreground">{t('leasing.cheques.schedule.setUpDescription')}</p>
                                {can.scheduleCheques && (
                                    <PostButton href={route('contracts.cheques.store', contract.id)} icon={WalletCardsIcon}>
                                        {t('leasing.cheques.schedule.setUp')}
                                    </PostButton>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-2.5 border-b px-4 py-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-5 lg:px-6">
                                    <ChequeFigure
                                        label={t('leasing.cheques.schedule.collected')}
                                        value={`${formatNumber(chequeStats.inHand)} / ${formatNumber(chequeStats.expected)}`}
                                        tone={chequeStats.inHand === chequeStats.expected ? 'success' : 'muted'}
                                    />
                                    <ChequeFigure label={t('leasing.cheques.status.cleared')} value={formatCurrency(chequeStats.cleared, currency)} tone="success" />
                                    <ChequeFigure label={t('leasing.cheques.stats.toDeposit')} value={formatNumber(chequeStats.toDeposit)} tone={chequeStats.toDeposit > 0 ? 'warning' : 'muted'} />
                                    <ChequeFigure label={t('leasing.cheques.status.pending_received')} value={formatNumber(chequeStats.toCollect)} tone={chequeStats.toCollect > 0 ? 'warning' : 'muted'} />
                                    <ChequeFigure label={t('leasing.cheques.stats.bounced')} value={formatNumber(chequeStats.bounced)} tone={chequeStats.bounced > 0 ? 'danger' : 'muted'} />
                                </div>
                                <ChequeSchedule cheques={cheques} currency={currency} statuses={chequeStatuses} banks={banks} />
                            </>
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.holdings.title')} description={t('leasing.holdings.contractDescription')}>
                        <PropertyHoldings lines={lines} currency={currency} />
                    </SectionCard>

                    <SectionCard title={t('leasing.contracts.form.lines.title')} description={t('leasing.contracts.show.linesDescription')} flush>
                        <DataTable
                            rows={lines}
                            columns={[
                                {
                                    id: 'unit',
                                    header: t('leasing.contracts.show.columns.unit'),
                                    className: 'min-w-48 whitespace-normal',
                                    cell: (line) => (
                                        <div className="flex flex-col">
                                            <span className="font-medium">{lineLabel(line)}</span>
                                            <span className="text-xs text-muted-foreground" dir="auto">
                                                {line.property.name}
                                                {line.description && ` · ${line.description}`}
                                            </span>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'rate',
                                    header: t('leasing.contracts.show.columns.rate'),
                                    align: 'end',
                                    cell: (line) => (
                                        <div className="flex flex-col items-end">
                                            <span className="font-medium tabular-nums">{formatMoney(line.monthlyRate, currency)}</span>
                                            {line.vatRate > 0 && (
                                                <span className="text-xs text-muted-foreground tabular-nums">{t('leasing.contracts.show.plusVat', { rate: line.vatRate })}</span>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'occupancy',
                                    header: t('leasing.contracts.show.columns.occupancy'),
                                    cell: (line) =>
                                        line.housesOccupants ? (
                                            <span className={cn('text-sm tabular-nums', line.staying >= line.capacity && 'font-medium')}>
                                                {t('leasing.contracts.show.occupancy', { staying: line.staying, capacity: line.capacity })}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">—</span>
                                        ),
                                },
                            ]}
                            actions={
                                can.checkIn
                                    ? (line) =>
                                          line.housesOccupants && line.staying < line.capacity ? (
                                              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('occupancies.create', { contract_line: line.id })} />}>
                                                  <LogInIcon data-icon="inline-start" />
                                                  {t('leasing.checkIn.button')}
                                              </Button>
                                          ) : null
                                    : undefined
                            }
                        />
                    </SectionCard>

                    {capacity > 0 && (
                        <SectionCard
                            title={t('leasing.contracts.show.peopleStaying', { count: current.length })}
                            description={t('leasing.contracts.show.peopleStayingDescription')}
                            flush
                        >
                            {current.length === 0 ? (
                                <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{t('leasing.contracts.show.nobodyStaying')}</p>
                            ) : (
                                <DataTable
                                    rows={current}
                                    columns={stayColumns(true)}
                                    actions={(stay) => (
                                        <Button variant="outline" size="sm" onClick={() => setCheckingOut(stay)}>
                                            <LogOutIcon data-icon="inline-start" />
                                            {t('leasing.occupants.checkOut.button')}
                                        </Button>
                                    )}
                                />
                            )}
                        </SectionCard>
                    )}

                    {past.length > 0 && (
                        <SectionCard title={t('leasing.contracts.show.pastStays', { count: past.length })} flush>
                            <DataTable rows={past} columns={stayColumns(false)} />
                        </SectionCard>
                    )}

                    <SectionCard title={t('leasing.invoices.title')} description={t('leasing.contracts.show.invoicesDescription')} flush>
                        {invoices.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{t('leasing.contracts.show.noInvoices')}</p>
                        ) : (
                            <DataTable
                                rows={invoices}
                                columns={[
                                    {
                                        id: 'number',
                                        header: t('leasing.invoices.columns.invoice'),
                                        cell: (invoice) => (
                                            <Link href={route('invoices.show', invoice.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                {invoice.number}
                                            </Link>
                                        ),
                                    },
                                    { id: 'period', header: t('leasing.invoices.columns.period'), cell: (invoice) => <span className="text-sm">{period(invoice.periodStart, invoice.periodEnd)}</span> },
                                    { id: 'due', header: t('leasing.invoices.columns.due'), cell: (invoice) => <span className="text-sm tabular-nums">{formatDate(invoice.dueDate)}</span> },
                                    { id: 'total', header: t('leasing.invoices.columns.total'), align: 'end', cell: (invoice) => <span className="tabular-nums">{formatMoney(invoice.total, currency)}</span> },
                                    { id: 'status', header: t('leasing.common.status'), cell: (invoice) => <InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} /> },
                                ]}
                            />
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.contracts.form.documents.title')} description={t('leasing.contracts.show.documentsDescription')}>
                        {documents.length > 0 ? (
                            <DocumentsOnFile documents={documents} />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('leasing.contracts.form.documents.empty')}</p>
                        )}
                    </SectionCard>
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.contracts.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.contracts.form.fields.billingCycle'), value: t(`leasing.billingCycles.${contract.billingCycle}`) },
                                { label: t('leasing.contracts.form.fields.paymentTerms'), value: t('leasing.common.days', { count: contract.paymentTermsDays }) },
                                { label: t('leasing.common.securityDeposit'), value: contract.securityDeposit === null ? null : formatMoney(contract.securityDeposit, currency) },
                                { label: t('leasing.common.ejariNumber'), value: contract.ejariNumber },
                                { label: t('leasing.contracts.form.fields.signedOn'), value: contract.signedOn && formatDate(contract.signedOn) },
                                ...(contract.terminatedOn
                                    ? [
                                          { label: t('leasing.contracts.show.terminatedOn'), value: formatDate(contract.terminatedOn) },
                                          { label: t('leasing.contracts.terminate.reason'), value: contract.terminationReason },
                                      ]
                                    : []),
                                {
                                    label: t('leasing.contracts.show.renewedFrom'),
                                    value: contract.renewedFrom && (
                                        <Link href={route('contracts.show', contract.renewedFrom.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {contract.renewedFrom.number}
                                        </Link>
                                    ),
                                },
                                {
                                    label: t('leasing.contracts.show.renewedBy'),
                                    value: contract.renewal && (
                                        <Link href={route('contracts.show', contract.renewal.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {contract.renewal.number}
                                        </Link>
                                    ),
                                },
                            ]}
                        />
                    </SectionCard>

                    {contract.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{contract.notes}</p>
                        </SectionCard>
                    )}
                </div>
            </div>

            {isTerminating && <TerminateDialog contract={contract} open onOpenChange={(open) => !open && setIsTerminating(false)} />}

            {checkingOut && (
                <CheckOutDialog
                    key={checkingOut.id}
                    stay={{ ...checkingOut, occupantName: checkingOut.occupant.name }}
                    open
                    onOpenChange={(open) => !open && setCheckingOut(null)}
                />
            )}
        </DashboardLayout>
    );
}
