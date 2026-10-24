import { ChequeList } from '@/Components/ChequeSchedule';
import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import { RentalStatusBadge, RentStandingBadge, StandingDetail, useRentalPlace } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import { ClientStatusBadge, ContractStatusBadge, InvoiceKindBadge, InvoiceStatusBadge, PartyTypeBadge, PaymentStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import PropertyHoldings, { holdingTotals, useHoldingSummary } from '@/Components/PropertyHoldings';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { BanknoteIcon, BedDoubleIcon, Building2Icon, FileSignatureIcon, KeyRoundIcon, PencilIcon, ReceiptIcon, UserPlusIcon } from 'lucide-react';
import DocumentsOnFile from '../HeadLeases/Partials/DocumentsOnFile';

function EmptyLine({ children }) {
    return <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{children}</p>;
}

export default function Show({ client, contracts, stays, invoices, cheques, chequeTotals, payments, holdings, documents, rentals = [], currency }) {
    const { t, formatMoney, formatCurrency, formatDate, formatNumber } = useTranslation();
    const { period, unitsSummary } = useLeasingFormat();
    const isCompany = client.client_type === 'company';
    const activeContracts = contracts.filter((contract) => contract.status === 'active').length;
    const totals = holdingTotals(holdings);
    const holdingSummary = useHoldingSummary();
    const rentalPlace = useRentalPlace();

    return (
        <DashboardLayout>
            <Head title={client.name} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('leasing.clients.title'), href: route('clients.index') }, { label: client.name }]}
                title={client.name}
                badge={
                    <>
                        <PartyTypeBadge type={client.client_type} />
                        {client.status !== 'active' && <ClientStatusBadge status={client.status} />}
                    </>
                }
                description={isCompany ? client.contact_person_name : client.nationality}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('clients.edit', client.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('occupants.create', { client: client.id })} />}>
                            <UserPlusIcon data-icon="inline-start" />
                            {t('leasing.occupants.add')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('payments.create', { client: client.id })} />}>
                            <ReceiptIcon data-icon="inline-start" />
                            {t('leasing.payments.add')}
                        </Button>
                        {!isCompany && (
                            <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.create', { client: client.id })} />}>
                                <KeyRoundIcon data-icon="inline-start" />
                                {t('finance.rentals.add')}
                            </Button>
                        )}
                        <Button nativeButton={false} render={<Link href={route('contracts.create', { client: client.id })} />}>
                            <FileSignatureIcon data-icon="inline-start" />
                            {t('leasing.contracts.add')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('leasing.clients.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    tone={client.balance > 0 ? 'warning' : 'success'}
                    label={t('leasing.clients.show.balance')}
                    value={formatMoney(client.balance, currency)}
                    detail={client.balance > 0 ? t('leasing.clients.show.balanceDetail') : t('leasing.clients.show.settled')}
                />
                <StatCard icon={FileSignatureIcon} label={t('leasing.clients.stats.contracts')} value={formatNumber(activeContracts)} detail={t('leasing.clients.show.contractsDetail', { count: contracts.length })} />
                <StatCard
                    icon={Building2Icon}
                    tone="gold"
                    label={t('leasing.holdings.properties')}
                    value={formatNumber(totals.properties)}
                    detail={holdingSummary(totals) || t('leasing.holdings.empty')}
                />
                <StatCard
                    icon={BedDoubleIcon}
                    tone="success"
                    label={t('leasing.clients.stats.staying')}
                    value={formatNumber(stays.length)}
                    detail={t('leasing.holdings.stayingOf', { count: client.occupants })}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('leasing.holdings.clientTitle')} description={t('leasing.holdings.clientDescription')}>
                        <PropertyHoldings lines={holdings} currency={currency} showContract />
                    </SectionCard>

                    {rentals.length > 0 && (
                        <SectionCard title={t('finance.rentals.title')} description={t('finance.rentals.clientDescription')} flush>
                            <DataTable
                                rows={rentals}
                                columns={[
                                    {
                                        id: 'rental',
                                        header: t('finance.rentals.columns.rental'),
                                        cell: (rental) => (
                                            <div className="flex flex-col">
                                                <Link href={route('rentals.show', rental.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                    {rental.number}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">{[rentalPlace(rental), rental.property?.name].filter(Boolean).join(' · ')}</span>
                                            </div>
                                        ),
                                    },
                                    { id: 'rent', header: t('finance.rentals.columns.rent'), align: 'end', cell: (rental) => <span className="tabular-nums">{formatMoney(rental.monthlyRent, currency)}</span> },
                                    {
                                        id: 'standing',
                                        header: t('finance.rentals.columns.standing'),
                                        cell: (rental) => (
                                            <div className="flex flex-col items-start gap-0.5">
                                                <RentStandingBadge standing={rental.standing.standing} />
                                                <StandingDetail standing={rental.standing} currency={currency} />
                                            </div>
                                        ),
                                    },
                                    { id: 'status', header: t('leasing.common.status'), cell: (rental) => <RentalStatusBadge status={rental.status} /> },
                                ]}
                            />
                        </SectionCard>
                    )}

                    <SectionCard title={t('leasing.contracts.title')} flush>
                        {contracts.length === 0 ? (
                            <EmptyLine>{t('leasing.clients.show.noContracts')}</EmptyLine>
                        ) : (
                            <DataTable
                                rows={contracts}
                                columns={[
                                    {
                                        id: 'number',
                                        header: t('leasing.contracts.columns.contract'),
                                        cell: (contract) => (
                                            <Link href={route('contracts.show', contract.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                {contract.number}
                                            </Link>
                                        ),
                                    },
                                    { id: 'term', header: t('leasing.contracts.columns.term'), cell: (contract) => <span className="text-sm">{period(contract.startDate, contract.endDate)}</span> },
                                    { id: 'units', header: t('leasing.contracts.columns.units'), cell: (contract) => <span className="text-sm">{unitsSummary(contract.units) || '—'}</span> },
                                    {
                                        id: 'value',
                                        header: t('leasing.contracts.columns.monthly'),
                                        align: 'end',
                                        cell: (contract) => <span className="tabular-nums">{formatCurrency(contract.monthlyValue, currency)}</span>,
                                    },
                                    { id: 'status', header: t('leasing.common.status'), cell: (contract) => <ContractStatusBadge status={contract.status} /> },
                                ]}
                            />
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.clients.show.staying')} description={t('leasing.clients.show.stayingDescription')} flush>
                        {stays.length === 0 ? (
                            <EmptyLine>{t('leasing.clients.show.nobodyStaying')}</EmptyLine>
                        ) : (
                            <DataTable
                                rows={stays}
                                columns={[
                                    {
                                        id: 'name',
                                        header: t('leasing.occupants.columns.name'),
                                        cell: (stay) => (
                                            <div className="flex flex-col">
                                                <Link href={route('occupants.show', stay.occupant.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                                                    {stay.occupant.name}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">{stay.occupant.employeeNumber || '—'}</span>
                                            </div>
                                        ),
                                    },
                                    {
                                        id: 'bed',
                                        header: t('leasing.occupants.columns.bed'),
                                        cell: (stay) => (
                                            <div className="flex flex-col text-sm">
                                                <span>{t('leasing.common.roomBed', { room: stay.roomNumber, bed: stay.bedLabel })}</span>
                                                <span className="text-xs text-muted-foreground" dir="auto">{stay.property.name}</span>
                                            </div>
                                        ),
                                    },
                                    { id: 'contract', header: t('leasing.contracts.columns.contract'), cell: (stay) => stay.contractNumber },
                                    { id: 'since', header: t('leasing.occupants.columns.since'), cell: (stay) => <span className="tabular-nums">{formatDate(stay.checkInDate)}</span> },
                                ]}
                            />
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.invoices.title')} description={t('leasing.clients.show.invoicesDescription')} flush>
                        {invoices.length === 0 ? (
                            <EmptyLine>{t('leasing.clients.show.noInvoices')}</EmptyLine>
                        ) : (
                            <DataTable
                                rows={invoices}
                                columns={[
                                    {
                                        id: 'number',
                                        header: t('leasing.invoices.columns.invoice'),
                                        cell: (invoice) => (
                                            <span className="flex flex-wrap items-center gap-2">
                                                <Link href={route('invoices.show', invoice.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                    {invoice.number}
                                                </Link>
                                                <InvoiceKindBadge kind={invoice.kind} />
                                            </span>
                                        ),
                                    },
                                    { id: 'period', header: t('leasing.invoices.columns.period'), cell: (invoice) => <span className="text-sm">{period(invoice.periodStart, invoice.periodEnd)}</span> },
                                    {
                                        id: 'total',
                                        header: t('leasing.invoices.columns.total'),
                                        align: 'end',
                                        cell: (invoice) => <span className="tabular-nums">{formatMoney(invoice.total, currency)}</span>,
                                    },
                                    {
                                        id: 'balance',
                                        header: t('leasing.invoices.columns.balance'),
                                        align: 'end',
                                        cell: (invoice) => (
                                            <span className={cn('tabular-nums', invoice.balance > 0 && 'font-medium')}>{invoice.balance > 0 ? formatMoney(invoice.balance, currency) : '—'}</span>
                                        ),
                                    },
                                    {
                                        id: 'status',
                                        header: t('leasing.common.status'),
                                        cell: (invoice) => <InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} />,
                                    },
                                ]}
                            />
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.contracts.form.documents.title')} description={t('leasing.clients.show.documentsDescription')}>
                        {documents.length > 0 ? (
                            <DocumentsOnFile
                                documents={documents}
                                renderTag={(document) => (
                                    <Badge variant="secondary" render={<Link href={route('contracts.show', document.contract.id)} />}>
                                        {document.contract.number}
                                    </Badge>
                                )}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('leasing.clients.show.noDocuments')}</p>
                        )}
                    </SectionCard>
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.clients.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                ...(isCompany
                                    ? [
                                          { label: t('leasing.clients.form.fields.contactPerson'), value: client.contact_person_name },
                                          { label: t('leasing.clients.form.fields.tradeLicense'), value: client.trade_license_number },
                                          { label: t('leasing.clients.form.fields.trn'), value: client.tax_registration_number },
                                      ]
                                    : [
                                          {
                                              label: client.id_type ? t(`leasing.idTypes.${client.id_type}`) : t('leasing.clients.form.fields.idNumber'),
                                              value: client.id_number && <span className="font-mono">{client.id_number}</span>,
                                          },
                                          { label: t('leasing.clients.form.fields.nationality'), value: client.nationality },
                                      ]),
                                { label: t('leasing.clients.form.fields.phone'), value: client.phone },
                                { label: t('leasing.clients.form.fields.email'), value: client.email },
                                { label: t('leasing.clients.form.fields.address'), value: client.address },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard
                        title={t('leasing.cheques.title')}
                        description={t('leasing.cheques.upcoming.description')}
                        action={
                            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('cheques.index', { direction: ['received'], search: client.name })} />}>
                                {t('leasing.cheques.upcoming.viewAll')}
                            </Button>
                        }
                    >
                        <div className="flex flex-col gap-4">
                            <dl className="grid grid-cols-2 gap-2.5">
                                <div className="flex flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
                                    <dt className="text-xs text-muted-foreground">{t('leasing.cheques.party.inHand')}</dt>
                                    <dd className="font-heading text-base font-bold tabular-nums">{formatCurrency(chequeTotals.inHand, currency)}</dd>
                                </div>
                                <div className="flex flex-col gap-0.5 rounded-xl bg-success/[0.06] px-3 py-2.5 ring-1 ring-success/20">
                                    <dt className="text-xs text-muted-foreground">{t('leasing.cheques.party.clearedThisYear')}</dt>
                                    <dd className="font-heading text-base font-bold tabular-nums">{formatCurrency(chequeTotals.clearedThisYear, currency)}</dd>
                                </div>
                            </dl>
                            {(chequeTotals.toCollect > 0 || chequeTotals.bounced > 0) && (
                                <p className="text-[0.8125rem] font-medium text-warning">
                                    {[
                                        chequeTotals.toCollect > 0 && t('leasing.cheques.party.toCollect', { count: chequeTotals.toCollect }),
                                        chequeTotals.bounced > 0 && t('leasing.cheques.party.bounced', { count: chequeTotals.bounced }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            )}
                            <ChequeList cheques={cheques} currency={currency} empty={t('leasing.cheques.schedule.none')} />
                        </div>
                    </SectionCard>

                    <SectionCard title={t('leasing.payments.title')} description={t('leasing.clients.show.paymentsDescription')}>
                        {payments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('leasing.clients.show.noPayments')}</p>
                        ) : (
                            <ul className="flex flex-col divide-y">
                                {payments.map((payment) => (
                                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                        <div className="flex min-w-0 flex-col">
                                            <Link href={route('payments.show', payment.id)} className="text-sm font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                {payment.number}
                                            </Link>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDate(payment.receivedOn)} · {t(`leasing.methods.${payment.method}`)}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm tabular-nums">{formatMoney(payment.amount, currency)}</span>
                                            {payment.status !== 'cleared' && <PaymentStatusBadge status={payment.status} />}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    {client.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{client.notes}</p>
                        </SectionCard>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
