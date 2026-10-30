import { ContractStateBadge, amcNavTitle, amcRoute } from '@/Components/AmcBadges';
import ChequeSchedule from '@/Components/ChequeSchedule';
import { LeaseStatusBadge } from '@/Components/LeasingBadges';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import {
    AirVentIcon,
    ArrowUpDownIcon,
    BugIcon,
    ChevronDownIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    DropletsIcon,
    ExternalLinkIcon,
    FileStackIcon,
    FilterIcon,
    FlameIcon,
    InfoIcon,
    KeyRoundIcon,
    Trash2Icon,
    WavesIcon,
} from 'lucide-react';
import { useState } from 'react';

/**
 * The sidebar's icon for each kind of maintenance contract.
 */
const SERVICE_ICONS = {
    fire_safety: FlameIcon,
    lifts: ArrowUpDownIcon,
    garbage: Trash2Icon,
    grease_traps: FilterIcon,
    drainage: WavesIcon,
    pest_control: BugIcon,
    air_conditioning: AirVentIcon,
    water_tanks: DropletsIcon,
};

/**
 * The figures of an agreement, in the order they read.
 */
const FIGURES = ['due', 'paidInPeriod', 'paid', 'left'];

const isLease = (agreement) => agreement.kind === 'head_lease';

const openHref = (agreement) => (isLease(agreement) ? route('head-leases.show', agreement.id) : route(amcRoute(agreement.service, 'show'), agreement.id));

/**
 * What is due by the end of the period shows in gold until it is paid;
 * money paid shows in green.
 */
function figureTone(name, value) {
    if (value <= 0) {
        return 'text-muted-foreground';
    }

    return { due: 'text-gold-ink', paidInPeriod: 'text-success', paid: 'text-success' }[name] ?? 'text-foreground';
}

/**
 * An agreement's four figures side by side, ruled apart; on a phone, two
 * to a line.
 */
function AgreementFigures({ agreement, currency, periodEnd }) {
    const { t, formatCurrency, formatDate } = useTranslation();

    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-foreground/[0.08]">
            {FIGURES.map((name) => {
                const value = formatCurrency(agreement[name], currency);

                return (
                    <div key={name} className="flex min-w-0 flex-col gap-0.5 sm:px-4 sm:first:ps-0 sm:last:pe-0">
                        <dt className="truncate text-xs text-muted-foreground">{t(`propertyPayments.out.figures.${name}`, { date: formatDate(periodEnd) })}</dt>
                        <dd
                            title={value}
                            className={cn('truncate font-heading text-[0.9375rem] tabular-nums', name === 'due' ? 'font-bold' : 'font-semibold', figureTone(name, agreement[name]))}
                        >
                            {value}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

/**
 * Under an agreement with no cheques listed: why, and when the next one falls.
 */
function NoChequesNote({ agreement, periodLabel }) {
    const { t, formatDate } = useTranslation();
    let text = t('propertyPayments.out.noSchedule');

    if (agreement.paidPerVisit) {
        text = t('propertyPayments.out.perVisit');
    } else if (agreement.nextChequeOn) {
        text = `${t('propertyPayments.out.noCheques', { period: periodLabel })} ${t('propertyPayments.out.nextCheque', { date: formatDate(agreement.nextChequeOn) })}`;
    } else if (agreement.paid > 0) {
        text = t('propertyPayments.out.allPaid');
    }

    return (
        <p className="flex items-start gap-1.5 rounded-xl bg-card px-3.5 py-3 text-sm text-muted-foreground ring-1 ring-foreground/[0.08]">
            <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {text}
        </p>
    );
}

/**
 * One agreement the company pays under, as a row that opens: the landlord
 * or contractor, what kind it is, its term and how it is paid, and its
 * figures. Open, it lists the period's cheques, whose status can be
 * changed in place.
 */
function AgreementRow({ agreement, currency, statuses, banks, period, periodLabel, isOpen, onOpenChange }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const Icon = isLease(agreement) ? KeyRoundIcon : SERVICE_ICONS[agreement.service];
    const terms = isLease(agreement)
        ? [t('propertyPayments.out.annualRent', { amount: formatCurrency(agreement.value, currency) }), t('propertyPayments.out.perYear', { count: agreement.paymentsPerYear })]
        : [t('propertyPayments.out.contractValue', { amount: formatCurrency(agreement.value, currency) }), t(`amcs.paymentTerms.${agreement.paymentTerms}`)];
    const summary = [`${formatDate(agreement.startsOn)} – ${formatDate(agreement.endsOn)}`, ...terms].join(' · ');

    return (
        <Collapsible open={isOpen} onOpenChange={onOpenChange}>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:px-6">
                <CollapsibleTrigger className="group flex min-w-0 items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                    <span
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-xl',
                            isLease(agreement) ? 'bg-gold/20 text-gold-ink' : 'bg-brand-cyan/10 text-brand-ink',
                        )}
                    >
                        <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span dir="auto" className="min-w-0 truncate font-heading text-base font-bold">
                                {agreement.party?.name ?? '—'}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-px text-[0.6875rem] font-semibold whitespace-nowrap text-muted-foreground">
                                {isLease(agreement) ? t('propertyPayments.out.kinds.head_lease') : t(amcNavTitle(agreement.service))}
                            </span>
                            <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                {agreement.number}
                            </span>
                            {agreement.state !== 'active' &&
                                (isLease(agreement) ? <LeaseStatusBadge status={agreement.state} /> : <ContractStateBadge state={agreement.state} />)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{summary}</span>
                    </span>
                </CollapsibleTrigger>
                <div className="md:ps-20">
                    <AgreementFigures agreement={agreement} currency={currency} periodEnd={period.to} />
                </div>
            </div>

            <CollapsibleContent>
                <div className="flex flex-col gap-3 border-t bg-muted/25 px-4 py-5 sm:px-5 lg:px-6">
                    {agreement.cheques.length === 0 ? (
                        <NoChequesNote agreement={agreement} periodLabel={periodLabel} />
                    ) : (
                        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/[0.08]">
                            <ChequeSchedule cheques={agreement.cheques} currency={currency} statuses={statuses} banks={banks} quickSettle />
                        </div>
                    )}
                    <Button variant="outline" size="sm" className="self-start" nativeButton={false} render={<Link href={openHref(agreement)} />}>
                        <ExternalLinkIcon data-icon="inline-start" />
                        {t(`propertyPayments.out.open.${agreement.kind}`, { number: agreement.number })}
                    </Button>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * What the company pays for the property under contract: the landlord's
 * head lease and the maintenance contracts (drainage, fire safety, lifts
 * and the rest), each with its cheques for the period and those still to
 * pay from before. Those with cheques listed start open.
 */
export default function OutgoingAgreements({ agreements, currency, statuses, banks, period, periodLabel }) {
    const { t } = useTranslation();
    const [openKeys, setOpenKeys] = useState(() => agreements.filter((agreement) => agreement.cheques.length > 0).map((agreement) => agreement.key));

    if (agreements.length === 0) {
        return (
            <Empty className="py-8 md:py-10">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FileStackIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('propertyPayments.out.empty.title')}</EmptyTitle>
                    <EmptyDescription>{t('propertyPayments.out.empty.description')}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const allOpen = agreements.every((agreement) => openKeys.includes(agreement.key));
    const setOpen = (key, isOpen) => setOpenKeys((keys) => (isOpen ? [...keys, key] : keys.filter((openKey) => openKey !== key)));

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <h3 className="text-[0.9375rem] font-semibold">{t('propertyPayments.out.listTitle', { count: agreements.length })}</h3>
                <Button variant="outline" size="sm" onClick={() => setOpenKeys(allOpen ? [] : agreements.map((agreement) => agreement.key))}>
                    {allOpen ? <ChevronsDownUpIcon data-icon="inline-start" /> : <ChevronsUpDownIcon data-icon="inline-start" />}
                    {t(`propertyPayments.out.${allOpen ? 'collapseAll' : 'expandAll'}`)}
                </Button>
            </div>
            <div className="flex flex-col divide-y border-t">
                {agreements.map((agreement) => (
                    <AgreementRow
                        key={agreement.key}
                        agreement={agreement}
                        currency={currency}
                        statuses={statuses}
                        banks={banks}
                        period={period}
                        periodLabel={periodLabel}
                        isOpen={openKeys.includes(agreement.key)}
                        onOpenChange={(isOpen) => setOpen(agreement.key, isOpen)}
                    />
                ))}
            </div>
        </div>
    );
}
