import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { ArrowRightLeftIcon, CircleCheckIcon, ExternalLinkIcon, FileTextIcon, HandCoinsIcon, HourglassIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { MaintenanceStatusBadge, PriorityBadge, STAGE_ICONS, useLookupNames, useUnitLabel } from '@/Components/MaintenanceBadges';
import StatusChangeDialog from './Partials/StatusChangeDialog';

// Timeline dot colours, matching the status badge colours.
const DOT_COLORS = {
    cyan: 'bg-brand-cyan/12 text-brand-ink ring-brand-cyan/30',
    navy: 'bg-primary text-primary-foreground ring-primary/30',
    amber: 'bg-warning/12 text-warning ring-warning/30',
    green: 'bg-success/12 text-success ring-success/30',
    red: 'bg-destructive/10 text-destructive ring-destructive/30',
    grey: 'bg-muted text-muted-foreground ring-foreground/10',
};

/**
 * Every step the job has been through, newest first.
 */
function History({ history }) {
    const { t, formatDate } = useTranslation();
    const { statusName } = useLookupNames();

    return (
        <ol className="flex flex-col">
            {[...history].reverse().map((entry, index, entries) => {
                const Icon = STAGE_ICONS[entry.status.stage];

                return (
                    <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < entries.length - 1 && <span aria-hidden="true" className="absolute start-4 top-9 bottom-0 w-px -translate-x-1/2 bg-border rtl:translate-x-1/2" />}
                        <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full ring-1', DOT_COLORS[entry.status.color] ?? DOT_COLORS.grey)}>
                            <Icon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <MaintenanceStatusBadge status={entry.status} />
                                <span className="text-xs text-muted-foreground">
                                    {entry.previous ? t('maintenance.show.from', { status: statusName(entry.previous) }) : t('maintenance.show.reported')}
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {[formatDate(entry.date), entry.user && t('maintenance.show.by', { name: entry.user })].filter(Boolean).join(' · ')}
                            </span>
                            {entry.note && (
                                <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                    {entry.note}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * The amount charged, whether and how it was paid, and the invoice.
 */
function CostCard({ job, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const hasCost = job.amount !== null || job.invoiceUrl;

    return (
        <SectionCard title={t('maintenance.show.cost')}>
            {hasCost ? (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{t('maintenance.show.amount')}</span>
                        <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{job.amount === null ? '—' : formatMoney(job.amount, currency)}</span>
                        <span className={cn('flex items-center gap-1.5 text-[0.8125rem] font-medium', job.isPaid ? 'text-success' : 'text-warning')}>
                            {job.isPaid ? <CircleCheckIcon className="size-4" /> : <HourglassIcon className="size-4" />}
                            {job.isPaid ? t('maintenance.show.paidOn', { date: formatDate(job.paidOn) }) : t('maintenance.show.notPaid')}
                        </span>
                    </div>
                    <DetailList
                        rows={[
                            { label: t('maintenance.show.method'), value: job.payment_method && t(`leasing.methods.${job.payment_method}`) },
                            { label: t('maintenance.show.invoiceNumber'), value: job.invoice_number },
                            ...(job.voucher_number
                                ? [
                                      {
                                          label: t('finance.bills.voucher.number'),
                                          value: (
                                              <Link href={route('maintenance-bills.voucher', job.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                  {job.voucher_number}
                                              </Link>
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />
                    {job.amount > 0 && !job.isPaid && (
                        <Button variant="outline" size="sm" className="self-start" nativeButton={false} render={<Link href={route('maintenance-bills.index', { status: ['unpaid'], search: job.number })} />}>
                            <HandCoinsIcon data-icon="inline-start" />
                            {t('finance.bills.actions.pay')}
                        </Button>
                    )}
                    {job.invoiceUrl ? (
                        <a
                            href={job.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group/invoice flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10 transition hover:ring-brand-cyan focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            {job.invoiceIsImage ? (
                                <img src={job.invoiceUrl} alt={t('maintenance.invoice.view')} className="max-h-72 w-full bg-muted object-contain" loading="lazy" />
                            ) : (
                                <span className="flex h-28 items-center justify-center bg-brand-cyan/[0.06] text-brand-ink">
                                    <FileTextIcon className="size-8" />
                                </span>
                            )}
                            <span className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[0.8125rem] font-medium">
                                <span className="truncate">{job.invoice_name || (job.invoiceIsImage ? t('maintenance.invoice.view') : t('maintenance.invoice.pdf'))}</span>
                                <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground group-hover/invoice:text-brand-ink" />
                            </span>
                        </a>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('maintenance.invoice.missing')}</p>
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">{t('maintenance.show.costPending')}</p>
            )}
        </SectionCard>
    );
}

export default function Show({ job, history, statuses, paymentMethods, currency }) {
    const { t, formatDate } = useTranslation();
    const { categoryName } = useLookupNames();
    const unitLabel = useUnitLabel();
    const [isChangingStatus, setChangingStatus] = useState(false);

    return (
        <DashboardLayout>
            <Head title={`${job.number} · ${job.title}`} />

            <PageHeader
                breadcrumbs={[{ label: t('maintenance.title'), href: route('maintenance.index') }, { label: job.number }]}
                title={job.title}
                badge={<MaintenanceStatusBadge status={job.status} />}
                description={[job.number, job.property?.name, unitLabel(job, { withLocation: false })].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('maintenance.edit', job.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        <Button onClick={() => setChangingStatus(true)}>
                            <ArrowRightLeftIcon data-icon="inline-start" />
                            {t('maintenance.actions.changeStatus')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('maintenance.show.details')}>
                        <div className="flex flex-col gap-5">
                            {job.description && (
                                <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                    {job.description}
                                </p>
                            )}
                            <DetailList
                                rows={[
                                    {
                                        label: t('maintenance.show.where'),
                                        value: (
                                            <span className="flex flex-col">
                                                {job.property && (
                                                    <Link href={route('properties.show', job.property.id)} dir="auto" className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                        {job.property.name}
                                                    </Link>
                                                )}
                                                <span dir="auto" className="text-xs font-normal text-muted-foreground">
                                                    {unitLabel(job)}
                                                </span>
                                            </span>
                                        ),
                                    },
                                    { label: t('maintenance.columns.category'), value: categoryName(job.category) },
                                    { label: t('maintenance.columns.priority'), value: <PriorityBadge priority={job.priority} /> },
                                    { label: t('maintenance.show.reportedOn'), value: formatDate(job.reportedOn) },
                                    { label: t('maintenance.show.reportedBy'), value: job.reported_by },
                                    { label: t('maintenance.show.doneBy'), value: job.vendor },
                                    { label: t('maintenance.show.phone'), value: job.vendor_phone && <span className="tabular-nums">{job.vendor_phone}</span> },
                                    { label: t('maintenance.show.startedOn'), value: job.startedOn && formatDate(job.startedOn) },
                                    { label: t('maintenance.show.completedOn'), value: job.completedOn && formatDate(job.completedOn) },
                                    { label: t('maintenance.show.loggedBy'), value: job.createdBy },
                                ]}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title={t('maintenance.show.history')} description={t('maintenance.show.historyDescription')}>
                        <History history={history} />
                    </SectionCard>

                    {job.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                {job.notes}
                            </p>
                        </SectionCard>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <CostCard job={job} currency={currency} />
                </div>
            </div>

            {isChangingStatus && (
                <StatusChangeDialog
                    job={job}
                    statuses={statuses}
                    paymentMethods={paymentMethods}
                    currency={currency}
                    open
                    onOpenChange={(open) => !open && setChangingStatus(false)}
                />
            )}
        </DashboardLayout>
    );
}
