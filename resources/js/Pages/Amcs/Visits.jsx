import { amcNavTitle, VISIT_STATUS_ICONS } from '@/Components/AmcBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import VisitSchedule, { useVisitTiming } from '@/Components/VisitSchedule';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useTranslation } from '@/hooks/use-translation';
import { Head } from '@inertiajs/react';
import { BellRingIcon, Building2Icon, CalendarCheckIcon, CalendarClockIcon, CalendarDaysIcon, CircleAlertIcon, ClipboardCheckIcon, FileStackIcon, SirenIcon } from 'lucide-react';

const DUE_ICONS = { overdue: CircleAlertIcon, alert: BellRingIcon, this_week: CalendarClockIcon, next_30_days: CalendarDaysIcon };

/**
 * Every visit on the maintenance contractors' schedules, such as the pest
 * control company's treatments, across every property: what is overdue
 * or close, what is coming up and what was done, with each visit updated
 * from the list.
 */
export default function Visits({ company, filters, period, facets, summary, visits }) {
    const { t, formatNumber, formatDate } = useTranslation();
    const timing = useVisitTiming();
    const title = t('amcs.visitsPage.title');
    const needsAttention = company ? summary.overdue + summary.due : 0;

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.contractsMenu') }, { label: title }]}
                title={title}
                count={visits?.total}
                description={t('amcs.visitsPage.description')}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={CalendarCheckIcon} />
            ) : (
                <>
                    <section aria-label={t('amcs.visitsPage.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={SirenIcon}
                            tone={needsAttention > 0 ? 'warning' : 'success'}
                            label={t('amcs.visitsPage.stats.attention')}
                            value={formatNumber(needsAttention)}
                            detail={
                                needsAttention > 0
                                    ? t('amcs.visitsPage.stats.attentionDetail', { overdue: summary.overdue, due: summary.due })
                                    : t('amcs.visitsPage.stats.allClear')
                            }
                            href={needsAttention > 0 ? route('amc-visits.index', { due: ['overdue', 'alert'] }) : undefined}
                        />
                        <StatCard
                            icon={CalendarClockIcon}
                            label={t('amcs.visitsPage.stats.thisWeek')}
                            value={formatNumber(summary.thisWeek)}
                            detail={t('amcs.visitsPage.stats.thisWeekDetail')}
                            href={summary.thisWeek > 0 ? route('amc-visits.index', { due: ['this_week'] }) : undefined}
                        />
                        <StatCard
                            icon={CalendarCheckIcon}
                            tone="gold"
                            label={t('amcs.visitsPage.stats.next')}
                            value={summary.next ? formatDate(summary.next.scheduledOn) : '—'}
                            detail={
                                summary.next
                                    ? `${timing(summary.next)} · ${summary.next.contract.property?.name ?? summary.next.contract.number}`
                                    : t('amcs.visitsPage.stats.noNext')
                            }
                            href={summary.next?.contract.url}
                        />
                        <StatCard
                            icon={ClipboardCheckIcon}
                            tone="success"
                            label={t('amcs.visitsPage.stats.done')}
                            value={formatNumber(summary.doneThisMonth)}
                            detail={t('amcs.visitsPage.stats.doneDetail')}
                        />
                    </section>

                    <RecordList
                        routeName="amc-visits.index"
                        filters={filters}
                        period={period}
                        facets={{
                            due: facets.due.map((option) => ({ ...option, label: t(`amcs.visitsPage.due.${option.value}`), icon: DUE_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`amcs.visitStatuses.${option.value}`), icon: VISIT_STATUS_ICONS[option.value] })),
                            service: facets.service
                                .filter((option) => option.count > 0 || filters.service.includes(option.value))
                                .map((option) => ({ ...option, label: t(amcNavTitle(option.value)), icon: FileStackIcon })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{
                            due: t('amcs.visitsPage.filters.due'),
                            status: t('amcs.visitsPage.filters.status'),
                            service: t('amcs.visitsPage.filters.service'),
                            properties: t('amcs.filters.properties'),
                        }}
                        only={['visits', 'facets', 'summary']}
                        paginator={visits}
                        searchLabel={t('amcs.visitsPage.searchLabel')}
                        searchPlaceholder={t('amcs.visitsPage.searchPlaceholder')}
                        empty={<ListEmpty icon={CalendarCheckIcon} title={t('amcs.visitsPage.empty.title')} description={t('amcs.visitsPage.empty.description')} />}
                    >
                        <VisitSchedule visits={visits.data} showContract />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
