import { amcNavTitle, amcRoute, CertificateBadge, ContractStateBadge, COVERAGE_ICONS } from '@/Components/AmcBadges';
import ChequeSchedule from '@/Components/ChequeSchedule';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import PostButton from '@/Components/PostButton';
import StatCard from '@/Components/StatCard';
import VisitSchedule, { AddVisitsDialog, AlertPulse } from '@/Components/VisitSchedule';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { daysFromToday, useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    CalendarCheckIcon,
    CalendarPlusIcon,
    CalendarRangeIcon,
    ExternalLinkIcon,
    FileTextIcon,
    MailIcon,
    PencilIcon,
    PhoneIcon,
    RefreshCwIcon,
    ShieldCheckIcon,
    WalletCardsIcon,
} from 'lucide-react';
import { useState } from 'react';

const linkClass = 'underline-offset-4 hover:text-brand-ink hover:underline';

/**
 * The systems the contract covers, each with its icon.
 */
function Coverage({ systems }) {
    const { t } = useTranslation();

    return (
        <ul className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            {systems.map((system) => {
                const Icon = COVERAGE_ICONS[system];

                return (
                    <li key={system} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 ring-foreground/10">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan/15 to-brand-navy/10 text-brand-ink">
                            {Icon && <Icon className="size-4" />}
                        </span>
                        {t(`amcs.coverage.${system}`)}
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * The signed copy on file: a preview for a photo, an icon for a PDF.
 */
function SignedCopy({ document }) {
    const { t } = useTranslation();

    if (!document) {
        return <p className="text-sm text-muted-foreground">{t('amcs.document.missing')}</p>;
    }

    return (
        <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="group/document flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10 transition hover:ring-brand-cyan focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
            {document.isImage ? (
                <img src={document.url} alt={t('amcs.document.view')} className="max-h-72 w-full bg-muted object-contain" loading="lazy" />
            ) : (
                <span className="flex h-28 items-center justify-center bg-brand-cyan/[0.06] text-brand-ink">
                    <FileTextIcon className="size-8" />
                </span>
            )}
            <span className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[0.8125rem] font-medium">
                <span className="truncate">{document.name || (document.isImage ? t('amcs.document.view') : t('amcs.document.pdf'))}</span>
                <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground group-hover/document:text-brand-ink" />
            </span>
        </a>
    );
}

/**
 * A red strip over the page while visits on the schedule are close or
 * overdue, so they are not missed.
 */
function VisitAlert({ stats }) {
    const { t } = useTranslation();

    return (
        <section role="status" className="flex items-center gap-3 rounded-xl bg-destructive/[0.07] px-4 py-3 ring-1 ring-destructive/30 sm:px-5">
            <AlertPulse />
            <p className="text-sm font-semibold text-destructive">
                {[
                    stats.overdue > 0 && t('amcs.show.alert.overdue', { count: stats.overdue }),
                    stats.due > 0 && t('amcs.show.alert.due', { count: stats.due }),
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            <p className="hidden text-[0.8125rem] text-destructive/80 sm:block">{t('amcs.show.alert.hint')}</p>
        </section>
    );
}

/**
 * One maintenance contract: its value, term, next visit and certificate up
 * top, then the contractor's visit schedule and the cheques paying for it,
 * what it covers, its terms, the contractor and the signed copy.
 */
export default function Show({ service, contract, currency, visits, visitStats, cheques, chequeStats, banks, chequeStatuses }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const [isAddingVisits, setIsAddingVisits] = useState(false);
    const listTitle = t(`amcs.services.${service}.title`);
    const certificateLabel = t(`amcs.services.${service}.certificate`);
    const frequency = t(`amcs.visitFrequencies.${contract.visitFrequency}`);
    const isVisitOverdue = contract.nextVisitOn !== null && daysFromToday(contract.nextVisitOn) < 0;
    const isRunning = ['active', 'expiring'].includes(contract.state);
    const payments = contract.paymentTerms === 'upfront' ? t('amcs.show.upfront') : t('amcs.payments', { count: contract.paymentCount, amount: formatMoney(contract.installment, currency) });

    const termValue = {
        upcoming: () => t('amcs.startsIn', { count: daysFromToday(contract.startDate) }),
        active: () => t('amcs.daysLeft', { count: contract.daysLeft }),
        expiring: () => t('amcs.daysLeft', { count: contract.daysLeft }),
        expired: () => t('amcs.endedOn', { date: formatDate(contract.endDate) }),
        cancelled: () => t('amcs.states.cancelled'),
    }[contract.state]();

    const visitDetail = contract.hasSchedule
        ? t('amcs.show.scheduleProgress', { done: visitStats.done, total: visitStats.total })
        : contract.lastVisitOn
          ? t('amcs.show.lastVisitOn', { frequency, date: formatDate(contract.lastVisitOn) })
          : t('amcs.show.noVisitRecorded', { frequency });

    return (
        <DashboardLayout>
            <Head title={`${contract.number} · ${listTitle}`} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.contractsMenu') }, { label: t(amcNavTitle(service)), href: route(amcRoute(service)) }, { label: contract.number }]}
                title={contract.number}
                badge={<ContractStateBadge state={contract.state} />}
                description={
                    <span>
                        <span dir="auto">{contract.vendor}</span> · <span dir="auto">{contract.property?.name}</span> · {period(contract.startDate, contract.endDate)}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route(amcRoute(service, 'edit'), contract.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        {contract.canRenew && (
                            <Button nativeButton={false} render={<Link href={route(amcRoute(service, 'create'), { renew: contract.id })} />}>
                                <RefreshCwIcon data-icon="inline-start" />
                                {t('amcs.actions.renew')}
                            </Button>
                        )}
                    </>
                }
            />

            <FlashMessages errorKeys={['action', 'cheques']} />

            {visitStats.overdue + visitStats.due > 0 && <VisitAlert stats={visitStats} />}

            <section aria-label={t('amcs.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard icon={BanknoteIcon} label={t('amcs.show.value')} value={formatCurrency(contract.value, currency)} detail={payments} />
                <StatCard
                    icon={CalendarRangeIcon}
                    tone={contract.state === 'expiring' || contract.state === 'expired' ? 'warning' : 'primary'}
                    label={t('amcs.show.term')}
                    value={termValue}
                    meter={contract.state === 'upcoming' || contract.state === 'cancelled' ? undefined : contract.elapsedPercent}
                    detail={period(contract.startDate, contract.endDate)}
                />
                <StatCard
                    icon={CalendarCheckIcon}
                    tone={isVisitOverdue ? 'warning' : 'gold'}
                    label={t('amcs.show.nextVisit')}
                    value={contract.nextVisitOn ? formatDate(contract.nextVisitOn) : '—'}
                    detail={contract.nextVisitOn || !isRunning ? visitDetail : t('amcs.show.noNextVisit')}
                    badge={isVisitOverdue && <ToneBadge tone="danger">{t('amcs.overdue')}</ToneBadge>}
                />
                <StatCard
                    icon={ShieldCheckIcon}
                    tone={contract.certificate.state === 'expiring' || contract.certificate.state === 'expired' ? 'warning' : 'success'}
                    label={certificateLabel}
                    value={contract.certificate.expiresOn ? formatDate(contract.certificate.expiresOn) : t('amcs.show.noCertificate')}
                    detail={contract.certificate.number && t('amcs.show.certificateNumber', { number: contract.certificate.number })}
                    badge={contract.certificate.state && <CertificateBadge state={contract.certificate.state} />}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard
                        title={t('amcs.schedule.title')}
                        description={
                            visitStats.total > 0
                                ? `${t('amcs.schedule.description')} ${t('amcs.show.scheduleProgress', { done: visitStats.done, total: visitStats.total })}.`
                                : t('amcs.schedule.description')
                        }
                        flush
                        action={
                            contract.canSchedule && (
                                <Button variant="outline" size="sm" onClick={() => setIsAddingVisits(true)}>
                                    <CalendarPlusIcon data-icon="inline-start" />
                                    {t('amcs.schedule.add')}
                                </Button>
                            )
                        }
                    >
                        {visits.length === 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 lg:px-6">
                                <p className="max-w-xl text-sm text-muted-foreground">{contract.canSchedule ? t('amcs.schedule.empty') : t('amcs.schedule.closed')}</p>
                                {contract.canSchedule && (
                                    <Button onClick={() => setIsAddingVisits(true)}>
                                        <CalendarPlusIcon data-icon="inline-start" />
                                        {t('amcs.schedule.add')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <VisitSchedule visits={visits} />
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('amcs.show.cheques')}
                        description={
                            contract.paysByCheque
                                ? t('amcs.show.chequesDescription', { paid: formatMoney(chequeStats.paid, currency), toPay: formatMoney(chequeStats.toPay, currency) })
                                : t('amcs.form.cheques.perVisit')
                        }
                        flush
                        action={
                            contract.paysByCheque &&
                            cheques.length > 0 && (
                                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route(amcRoute(service, 'edit'), contract.id)} />}>
                                    <PencilIcon data-icon="inline-start" />
                                    {t('leasing.cheques.actions.record')}
                                </Button>
                            )
                        }
                    >
                        {!contract.paysByCheque ? null : cheques.length === 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 lg:px-6">
                                <p className="max-w-xl text-sm text-muted-foreground">{t('leasing.cheques.schedule.setUpDescription')}</p>
                                <PostButton href={route('amcs.cheques.store', contract.id)} icon={WalletCardsIcon}>
                                    {t('leasing.cheques.schedule.setUp')}
                                </PostButton>
                            </div>
                        ) : (
                            <ChequeSchedule cheques={cheques} currency={currency} statuses={chequeStatuses} banks={banks} />
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('amcs.show.coverage')}
                        description={t('amcs.show.coverageCount', { count: contract.coverage.length, total: contract.coverageOptions })}
                    >
                        <Coverage systems={contract.coverage} />
                    </SectionCard>

                    <SectionCard title={t('amcs.show.details')}>
                        <DetailList
                            rows={[
                                {
                                    label: t('amcs.form.fields.property'),
                                    value: contract.property && (
                                        <Link href={route('properties.show', contract.property.id)} dir="auto" className={linkClass}>
                                            {`${contract.property.name} · ${contract.property.code}`}
                                        </Link>
                                    ),
                                },
                                { label: t('amcs.form.fields.reference'), value: contract.reference },
                                { label: t('amcs.form.fields.startDate'), value: formatDate(contract.startDate) },
                                { label: t('amcs.form.fields.endDate'), value: formatDate(contract.endDate) },
                                { label: t('amcs.show.length'), value: t('amcs.months', { count: contract.termMonths }) },
                                { label: t('amcs.show.payments'), value: `${t(`amcs.paymentTerms.${contract.paymentTerms}`)} · ${payments}` },
                                { label: t('amcs.show.visits'), value: t('amcs.show.visitsDetail', { frequency, visits: t('amcs.visits', { count: contract.visitCount }) }) },
                                { label: t('amcs.form.fields.lastVisit'), value: contract.lastVisitOn && formatDate(contract.lastVisitOn) },
                                {
                                    label: t('amcs.show.responseTime'),
                                    value: contract.response_time_hours && t('amcs.show.within', { hours: t('amcs.hours', { count: contract.response_time_hours }) }),
                                },
                                {
                                    label: t('amcs.show.addedBy'),
                                    value: contract.createdBy ? t('amcs.show.addedOn', { name: contract.createdBy, date: formatDate(contract.createdAt) }) : null,
                                },
                                {
                                    label: t('amcs.show.renewedFrom'),
                                    value: contract.renewedFrom && (
                                        <Link href={route(amcRoute(service, 'show'), contract.renewedFrom.id)} className={linkClass}>
                                            {contract.renewedFrom.number}
                                        </Link>
                                    ),
                                },
                                {
                                    label: t('amcs.show.renewedBy'),
                                    value: contract.renewal && (
                                        <Link href={route(amcRoute(service, 'show'), contract.renewal.id)} className={linkClass}>
                                            {contract.renewal.number}
                                        </Link>
                                    ),
                                },
                            ]}
                        />
                    </SectionCard>

                    {contract.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                {contract.notes}
                            </p>
                        </SectionCard>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('amcs.show.contractor')}>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-0.5">
                                <span dir="auto" className="font-heading text-lg font-bold">
                                    {contract.vendor}
                                </span>
                                {contract.vendor_contact_person && (
                                    <span dir="auto" className="text-sm text-muted-foreground">
                                        {contract.vendor_contact_person}
                                    </span>
                                )}
                            </div>
                            {(contract.vendorPhone || contract.vendor_email) && (
                                <div className="flex flex-wrap gap-2">
                                    {contract.vendorPhone && (
                                        <Button variant="outline" size="sm" nativeButton={false} render={<a href={`tel:${contract.vendorPhone.replace(/\s+/g, '')}`} />}>
                                            <PhoneIcon data-icon="inline-start" />
                                            <span className="tabular-nums">{contract.vendorPhone}</span>
                                        </Button>
                                    )}
                                    {contract.vendor_email && (
                                        <Button variant="outline" size="sm" nativeButton={false} render={<a href={`mailto:${contract.vendor_email}`} />}>
                                            <MailIcon data-icon="inline-start" />
                                            <span className="max-w-48 truncate">{contract.vendor_email}</span>
                                        </Button>
                                    )}
                                </div>
                            )}
                            <DetailList columns={1} rows={[{ label: t(`amcs.services.${service}.licence`), value: contract.vendor_licence_number }]} />
                        </div>
                    </SectionCard>

                    <SectionCard title={t('amcs.show.document')}>
                        <SignedCopy document={contract.document} />
                    </SectionCard>
                </div>
            </div>

            {isAddingVisits && (
                <AddVisitsDialog
                    contract={contract}
                    scheduled={visits.filter((visit) => visit.status !== 'cancelled').map((visit) => visit.scheduledOn)}
                    open
                    onOpenChange={(open) => !open && setIsAddingVisits(false)}
                />
            )}
        </DashboardLayout>
    );
}
