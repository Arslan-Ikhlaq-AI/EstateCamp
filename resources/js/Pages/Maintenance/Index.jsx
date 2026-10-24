import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { ArrowDownIcon, ArrowUpIcon, BanknoteIcon, Building2Icon, CircleCheckIcon, EyeIcon, FileTextIcon, HourglassIcon, PencilIcon, PlusIcon, SirenIcon, WrenchIcon } from 'lucide-react';
import { MaintenanceStatusBadge, PriorityBadge, STAGE_ICONS, useLookupNames, useUnitLabel } from '@/Components/MaintenanceBadges';

const PRIORITY_ICONS = { low: ArrowDownIcon, high: ArrowUpIcon, urgent: SirenIcon };

export default function Index({ company, filters, facets, summary, jobs }) {
    const { t, formatNumber, formatMoney, formatCurrency, formatDate, tOr } = useTranslation();
    const { categoryName } = useLookupNames();
    const unitLabel = useUnitLabel();
    const title = t('maintenance.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('maintenance.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('maintenance.add')}
        </Button>
    );

    const columns = [
        {
            id: 'job',
            header: t('maintenance.columns.job'),
            cell: (job) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('maintenance.show', job.id)} dir="auto" className="max-w-72 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {job.title}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {job.number} · {categoryName(job.category)}
                    </span>
                </div>
            ),
        },
        {
            id: 'location',
            header: t('maintenance.columns.location'),
            cell: (job) => (
                <div className="flex max-w-56 min-w-0 flex-col">
                    <span dir="auto" className="truncate text-sm font-medium">
                        {unitLabel(job, { withLocation: false })}
                    </span>
                    <span dir="auto" className="truncate text-xs text-muted-foreground">
                        {[job.property?.name, job.location].filter(Boolean).join(' · ')}
                    </span>
                </div>
            ),
        },
        { id: 'priority', header: t('maintenance.columns.priority'), cell: (job) => <PriorityBadge priority={job.priority} /> },
        { id: 'reported', header: t('maintenance.columns.reported'), cell: (job) => <span className="text-sm tabular-nums">{formatDate(job.reportedOn)}</span> },
        { id: 'status', header: t('maintenance.columns.status'), cell: (job) => <MaintenanceStatusBadge status={job.status} /> },
        {
            id: 'cost',
            header: t('maintenance.columns.cost'),
            align: 'end',
            cell: (job) =>
                job.amount === null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <div className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums">{formatMoney(job.amount, company.currency)}</span>
                        <span className={job.isPaid ? 'text-xs text-success' : 'text-xs text-warning'}>
                            {job.isPaid ? t('maintenance.paid') : t('maintenance.unpaid')}
                            {job.hasInvoice && <FileTextIcon className="ms-1 inline size-3 align-[-1px]" aria-label={t('maintenance.invoice.onFile')} />}
                        </span>
                    </div>
                ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: title }]} title={title} count={jobs?.total} description={t('maintenance.description')} actions={company && addButton} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={WrenchIcon} />
            ) : (
                <>
                    <section aria-label={t('maintenance.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={WrenchIcon}
                            label={t('maintenance.stats.open')}
                            value={formatNumber(summary.open)}
                            detail={t('maintenance.stats.openDetail', { inProgress: summary.inProgress, urgent: summary.urgent })}
                        />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('maintenance.stats.completed')}
                            value={formatNumber(summary.completedThisMonth)}
                            detail={t('maintenance.stats.completedDetail')}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            tone="gold"
                            label={t('maintenance.stats.spent')}
                            value={formatCurrency(summary.spentThisMonth, company.currency)}
                            detail={t('maintenance.stats.spentDetail', { amount: formatCurrency(summary.spentThisYear, company.currency) })}
                        />
                        <StatCard
                            icon={HourglassIcon}
                            tone="warning"
                            label={t('maintenance.stats.unpaid')}
                            value={formatCurrency(summary.unpaid.amount, company.currency)}
                            detail={summary.unpaid.count > 0 ? t('maintenance.stats.unpaidDetail', { count: summary.unpaid.count }) : t('maintenance.stats.nothingUnpaid')}
                        />
                    </section>

                    <RecordList
                        routeName="maintenance.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({
                                ...option,
                                label: tOr(`maintenance.statusNames.${option.value}`, option.label),
                                icon: STAGE_ICONS[option.stage],
                            })),
                            category: facets.category.map((option) => ({ ...option, label: tOr(`maintenance.categoryNames.${option.value}`, option.label) })),
                            priority: facets.priority.map((option) => ({ ...option, label: t(`maintenance.priorities.${option.value}`), icon: PRIORITY_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{
                            status: t('maintenance.filters.status'),
                            category: t('maintenance.filters.category'),
                            priority: t('maintenance.filters.priority'),
                            properties: t('maintenance.filters.properties'),
                        }}
                        only={['jobs', 'facets']}
                        paginator={jobs}
                        searchLabel={t('maintenance.searchLabel')}
                        searchPlaceholder={t('maintenance.searchPlaceholder')}
                        empty={<ListEmpty icon={WrenchIcon} title={t('maintenance.empty.title')} description={t('maintenance.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={jobs.data}
                            actions={(job) => (
                                <RowActions
                                    label={t('maintenance.actions.menu', { number: job.number })}
                                    items={[
                                        { label: t('maintenance.actions.view'), href: route('maintenance.show', job.id), icon: EyeIcon },
                                        { label: t('maintenance.actions.edit'), href: route('maintenance.edit', job.id), icon: PencilIcon },
                                    ]}
                                />
                            )}
                        />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
