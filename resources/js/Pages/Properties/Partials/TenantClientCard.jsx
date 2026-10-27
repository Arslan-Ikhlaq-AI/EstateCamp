import ChequeSchedule from '@/Components/ChequeSchedule';
import { DetailList } from '@/Components/DetailCards';
import { ClientStatusBadge, ContractStatusBadge, PartyTypeBadge, ToneBadge } from '@/Components/LeasingBadges';
import { useHoldingSummary } from '@/Components/PropertyHoldings';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import {
    BedDoubleIcon,
    Building2Icon,
    CalendarClockIcon,
    ChevronDownIcon,
    CircleAlertIcon,
    DoorOpenIcon,
    FileSignatureIcon,
    FlagIcon,
    HouseIcon,
    IdCardIcon,
    InfoIcon,
    MailIcon,
    MapPinIcon,
    PhoneIcon,
    ReceiptTextIcon,
    StoreIcon,
    UserIcon,
    UserRoundIcon,
} from 'lucide-react';
import DocumentsOnFile from '../../HeadLeases/Partials/DocumentsOnFile';
import { CHEQUE_STAGES, stageLabel } from './TenantContractsSummary';

const UNIT_ICONS = { bed: BedDoubleIcon, room: DoorOpenIcon, apartment: HouseIcon, shop: StoreIcon };

/**
 * A running contract this close to its end is flagged, as on the contract page.
 */
const ENDING_SOON_DAYS = 60;

/**
 * One way to reach a client, as an icon and text; a link when it can be.
 */
function Contact({ icon: Icon, href, children }) {
    const content = (
        <>
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            <span dir="auto" className="truncate">
                {children}
            </span>
        </>
    );

    return (
        <li className="min-w-0">
            {href ? (
                <a href={href} className="inline-flex max-w-full items-center gap-1.5 underline-offset-4 hover:text-brand-ink hover:underline">
                    {content}
                </a>
            ) : (
                <span className="inline-flex max-w-full items-center gap-1.5">{content}</span>
            )}
        </li>
    );
}

/**
 * A figure in a client's header, such as their rent a month.
 */
function Figure({ label, value, tone = 'muted' }) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2 ring-1', tone === 'warning' ? 'bg-warning/[0.07] ring-warning/25' : 'bg-card ring-foreground/[0.08]')}>
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd title={value} className="truncate font-heading text-[0.9375rem] font-bold tabular-nums">
                {value}
            </dd>
        </div>
    );
}

/**
 * A titled part of an open contract, such as its terms.
 */
function PanelSection({ title, children }) {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
            {children}
        </section>
    );
}

/**
 * A contract's cheques as one thin bar split by stage (cancelled ones left
 * out), with how many have cleared.
 */
function ChequeBar({ stages, total }) {
    const { t, formatNumber } = useTranslation();
    const shown = CHEQUE_STAGES.filter((stage) => stage.key !== 'cancelled' && stages[stage.key].count > 0);

    if (total === 0) {
        return <span className="w-36 text-xs text-muted-foreground">{t('propertyTenantContracts.contract.noChequesShort')}</span>;
    }

    return (
        <div className="flex w-36 flex-col gap-1.5">
            <div
                role="img"
                aria-label={shown.map((stage) => `${stageLabel(t, stage.key)} ${formatNumber(stages[stage.key].count)}`).join(', ')}
                className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted"
            >
                {shown.map((stage) => (
                    <span key={stage.key} className="h-full" style={{ width: `${(stages[stage.key].count / total) * 100}%`, backgroundColor: stage.color }} />
                ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
                {t('propertyTenantContracts.contract.chequeBar', { cleared: formatNumber(stages.cleared.count), total: formatNumber(total) })}
            </span>
        </div>
    );
}

/**
 * How many of a contract's cheques are at each stage, and how many are
 * past their date, as small labelled counts.
 */
function StageCounts({ summary }) {
    const { t, formatNumber } = useTranslation();

    return (
        <ul className="flex flex-wrap items-center gap-1.5">
            {CHEQUE_STAGES.filter((stage) => summary.stages[stage.key].count > 0).map((stage) => (
                <li key={stage.key} className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 text-xs font-medium">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stageLabel(t, stage.key)}
                    <span className="text-muted-foreground tabular-nums">{formatNumber(summary.stages[stage.key].count)}</span>
                </li>
            ))}
            {summary.overdue.count > 0 && (
                <li className="inline-flex h-6 items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 text-xs font-medium text-destructive">
                    <CircleAlertIcon aria-hidden="true" className="size-3.5" />
                    {t('propertyTenantContracts.stats.overdue', { count: formatNumber(summary.overdue.count) })}
                </li>
            )}
        </ul>
    );
}

/**
 * Each room, bed, apartment and shop a contract rents in this property:
 * the beds in a whole room, who is staying, its own dates when they differ
 * from the contract's, and its rent a month.
 */
function UnitsHere({ contract, currency }) {
    const { t, formatCurrency } = useTranslation();
    const { lineLabel, period } = useLeasingFormat();

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/[0.08]">
                {contract.lines.map((line) => {
                    const Icon = UNIT_ICONS[line.unitType];
                    const detail = [
                        line.unitType === 'room' && t('common.beds', { count: line.capacity }),
                        line.housesOccupants && t('leasing.holdings.staying', { count: line.staying }),
                        (line.startDate !== contract.startDate || line.endDate !== contract.endDate) && period(line.startDate, line.endDate),
                    ]
                        .filter(Boolean)
                        .join(' · ');

                    return (
                        <li key={line.id} className="flex items-center gap-3 px-3.5 py-2.5">
                            <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-[0.8125rem] font-medium">{lineLabel(line)}</span>
                                {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
                            </div>
                            <span className="text-[0.8125rem] tabular-nums">{formatCurrency(line.monthlyAmount, currency)}</span>
                        </li>
                    );
                })}
            </ul>
            {contract.otherProperties > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    {t('propertyTenantContracts.contract.otherProperties', { count: contract.otherProperties })}
                </p>
            )}
        </div>
    );
}

/**
 * One contract as a row that opens: its number, status, term and units
 * here, how far its cheques have got and its rent a month. Open, it shows
 * its terms, every unit it rents here, its documents and its cheques,
 * whose statuses can be updated from the list.
 */
function ContractPanel({ contract, currency, isOpen, onOpenChange, chequeStatuses, banks }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const holdingSummary = useHoldingSummary();
    const chequeTotal = contract.cheques.filter((cheque) => cheque.status !== 'cancelled').length;
    const endsSoon = contract.status === 'active' && contract.daysLeft >= 0 && contract.daysLeft <= ENDING_SOON_DAYS;
    const money = (value) => formatCurrency(value, currency);

    return (
        <Collapsible open={isOpen} onOpenChange={onOpenChange}>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-5 lg:px-6">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary dark:bg-primary/20 dark:text-brand-cyan">
                        <FileSignatureIcon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={route('contracts.show', contract.id)} className="font-semibold underline-offset-4 hover:text-brand-ink hover:underline">
                                {contract.number}
                            </Link>
                            <ContractStatusBadge status={contract.status} />
                            {endsSoon && (
                                <ToneBadge tone="warning" icon={CalendarClockIcon}>
                                    {t('leasing.common.daysLeft', { count: contract.daysLeft })}
                                </ToneBadge>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {[period(contract.startDate, contract.endDate), t(`leasing.billingCycles.${contract.billingCycle}`), holdingSummary(contract.holds)]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 ps-12 md:ps-0">
                    <ChequeBar stages={contract.chequeSummary.stages} total={chequeTotal} />
                    <div className="flex flex-col items-end">
                        <span className="font-bold tabular-nums">{money(contract.monthlyValue)}</span>
                        <span className="text-xs text-muted-foreground">{t('propertyShow.clients.perMonth')}</span>
                    </div>
                    <CollapsibleTrigger render={<Button variant="outline" size="sm" className="group" />}>
                        {isOpen ? t('propertyTenantContracts.contract.hide') : t('propertyTenantContracts.contract.details')}
                        <span className="sr-only"> {contract.number}</span>
                        <ChevronDownIcon data-icon="inline-end" className="transition-transform group-data-[panel-open]:rotate-180" />
                    </CollapsibleTrigger>
                </div>
            </div>

            <CollapsibleContent>
                <div className="grid gap-6 border-t bg-muted/25 px-4 py-5 sm:px-5 lg:grid-cols-3 lg:px-6">
                    <PanelSection title={t('propertyTenantContracts.contract.terms')}>
                        <DetailList
                            rows={[
                                { label: t('leasing.contracts.form.fields.billingCycle'), value: t(`leasing.billingCycles.${contract.billingCycle}`) },
                                { label: t('leasing.contracts.form.fields.paymentTerms'), value: t('leasing.common.days', { count: contract.paymentTermsDays }) },
                                { label: t('leasing.common.securityDeposit'), value: contract.securityDeposit === null ? null : money(contract.securityDeposit) },
                                { label: t('leasing.contracts.show.gas'), value: t(`leasing.contracts.form.gasOptions.${contract.gasIncluded ? 'included' : 'billed'}`) },
                                { label: t('leasing.common.ejariNumber'), value: contract.ejariNumber },
                                { label: t('leasing.contracts.form.fields.signedOn'), value: contract.signedOn && formatDate(contract.signedOn) },
                                { label: t('propertyTenantContracts.contract.invoiced'), value: money(contract.invoiced) },
                                { label: t('leasing.contracts.show.balance'), value: money(contract.balance ?? 0) },
                                ...(contract.terminatedOn
                                    ? [
                                          { label: t('leasing.contracts.show.terminatedOn'), value: formatDate(contract.terminatedOn) },
                                          { label: t('leasing.contracts.terminate.reason'), value: contract.terminationReason },
                                      ]
                                    : []),
                                ...(contract.renewedFrom
                                    ? [
                                          {
                                              label: t('leasing.contracts.show.renewedFrom'),
                                              value: (
                                                  <Link href={route('contracts.show', contract.renewedFrom.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                      {contract.renewedFrom.number}
                                                  </Link>
                                              ),
                                          },
                                      ]
                                    : []),
                            ]}
                        />
                        {contract.notes && (
                            <p dir="auto" className="text-[0.8125rem] leading-relaxed whitespace-pre-line text-muted-foreground">
                                {contract.notes}
                            </p>
                        )}
                    </PanelSection>

                    <PanelSection title={t('propertyTenantContracts.contract.unitsHere')}>
                        <UnitsHere contract={contract} currency={currency} />
                    </PanelSection>

                    <PanelSection title={t('propertyTenantContracts.contract.documents')}>
                        {contract.documents.length > 0 ? (
                            <DocumentsOnFile documents={contract.documents} />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('propertyTenantContracts.contract.noDocuments')}</p>
                        )}
                    </PanelSection>
                </div>

                <div className="border-t">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5 lg:px-6">
                        <h4 className="me-auto font-heading text-[0.9375rem] font-semibold">{t('propertyTenantContracts.contract.cheques')}</h4>
                        <StageCounts summary={contract.chequeSummary} />
                    </div>
                    {contract.cheques.length > 0 ? (
                        <div className="border-t">
                            <ChequeSchedule cheques={contract.cheques} currency={currency} statuses={chequeStatuses} banks={banks} />
                        </div>
                    ) : (
                        <p className="border-t px-4 py-4 text-sm text-muted-foreground sm:px-5 lg:px-6">
                            {t('propertyTenantContracts.contract.noCheques')}{' '}
                            <Link href={route('contracts.show', contract.id)} className="font-medium text-brand-ink underline-offset-4 hover:underline">
                                {t('propertyTenantContracts.contract.openContract')}
                            </Link>
                        </p>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * One client renting in the property: who they are and how to reach them,
 * what they hold here now, their rent and balance, then each of their
 * `contracts` (those the page's filter leaves) as a panel that opens.
 */
export default function TenantClientCard({ client, contracts, currency, openIds, onOpenChange, chequeStatuses, banks }) {
    const { t, formatNumber, formatCurrency } = useTranslation();
    const holdingSummary = useHoldingSummary();
    const isCompany = client.type === 'company';
    const contacts = [
        isCompany && client.contactPerson && { key: 'person', icon: UserRoundIcon, text: client.contactPerson },
        client.phone && { key: 'phone', icon: PhoneIcon, text: client.phone, href: `tel:${client.phone.replace(/\s+/g, '')}` },
        client.email && { key: 'email', icon: MailIcon, text: client.email, href: `mailto:${client.email}` },
        isCompany && client.tradeLicenseNumber && { key: 'licence', icon: IdCardIcon, text: t('propertyTenantContracts.client.licence', { number: client.tradeLicenseNumber }) },
        isCompany && client.taxRegistrationNumber && { key: 'trn', icon: ReceiptTextIcon, text: t('propertyTenantContracts.client.trn', { number: client.taxRegistrationNumber }) },
        !isCompany &&
            client.idNumber && {
                key: 'id',
                icon: IdCardIcon,
                text: `${client.idType ? t(`leasing.idTypes.${client.idType}`) : t('leasing.clients.form.fields.idNumber')} ${client.idNumber}`,
            },
        !isCompany && client.nationality && { key: 'nationality', icon: FlagIcon, text: client.nationality },
        client.address && { key: 'address', icon: MapPinIcon, text: client.address },
    ].filter(Boolean);

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <header className="flex flex-col gap-4 border-b bg-muted/40 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:px-6">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-md inset-ring inset-ring-white/25">
                        {isCompany ? <Building2Icon className="size-5" /> : <UserIcon className="size-5" />}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href={route('clients.show', client.id)}
                                dir="auto"
                                className="font-heading text-[1.0625rem] font-bold underline-offset-4 hover:text-brand-ink hover:underline"
                            >
                                {client.name}
                            </Link>
                            <PartyTypeBadge type={client.type} />
                            {client.status !== 'active' && <ClientStatusBadge status={client.status} />}
                        </div>
                        {contacts.length > 0 && (
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
                                {contacts.map(({ key, icon, href, text }) => (
                                    <Contact key={key} icon={icon} href={href}>
                                        {text}
                                    </Contact>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                <dl className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[34rem]">
                    <Figure label={t('propertyTenantContracts.client.contracts')} value={formatNumber(client.contracts.length)} />
                    <Figure label={t('propertyTenantContracts.client.holds')} value={holdingSummary(client.units) || t('propertyTenantContracts.client.nothing')} />
                    <Figure label={t('propertyTenantContracts.client.monthly')} value={formatCurrency(client.monthly, currency)} />
                    <Figure label={t('propertyTenantContracts.client.balance')} value={formatCurrency(client.balance, currency)} tone={client.balance > 0 ? 'warning' : 'muted'} />
                </dl>
            </header>

            <div className="flex flex-col divide-y">
                {contracts.map((contract) => (
                    <ContractPanel
                        key={contract.id}
                        contract={contract}
                        currency={currency}
                        isOpen={openIds.includes(contract.id)}
                        onOpenChange={(isOpen) => onOpenChange(contract.id, isOpen)}
                        chequeStatuses={chequeStatuses}
                        banks={banks}
                    />
                ))}
            </div>
        </Card>
    );
}
