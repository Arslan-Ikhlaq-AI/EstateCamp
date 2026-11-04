import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { ListEmpty } from '@/Components/RecordList';
import { StaffAvatar, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { BanknoteIcon, BanknoteXIcon, ChevronLeftIcon, ChevronRightIcon, CalendarPlusIcon, HourglassIcon, TreePalmIcon } from 'lucide-react';
import { LeavePayBadge, LeaveStatusBadge, LeaveType, useLeaveSpan } from './Partials/LeaveParts';

const FILTERS = ['pending', 'approved', 'closed', 'all'];

/**
 * The lists of leave: waiting, approved, rejected or cancelled, and all,
 * each with how many it holds.
 */
function FilterTabs({ filter, counts }) {
    const { t, formatNumber } = useTranslation();

    return (
        <nav aria-label={t('staff.leave.title')} className="flex w-fit flex-wrap gap-1 rounded-2xl bg-muted/70 p-1 ring-1 ring-foreground/[0.06]">
            {FILTERS.map((value) => {
                const isActive = filter === value;

                return (
                    <Link
                        key={value}
                        href={route('leave.index', { status: value })}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            isActive && 'bg-card text-foreground shadow-(--card-shadow) ring-1 ring-foreground/[0.06]',
                        )}
                    >
                        {t(`staff.leave.filters.${value}`)}
                        <span
                            className={cn(
                                'rounded-full px-1.5 text-xs tabular-nums',
                                value === 'pending' && counts.pending > 0 ? 'bg-warning/15 text-warning' : 'bg-foreground/[0.06] text-muted-foreground',
                            )}
                        >
                            {formatNumber(counts[value])}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}

/**
 * One leave in the list: who, what kind and when, where it stands, and the
 * way to it.
 */
function LeaveRow({ leave }) {
    const { t, formatDate } = useTranslation();
    const { roleName } = useStaffNames();
    const span = useLeaveSpan();

    return (
        <li>
            <Link
                href={route('leave.show', leave.id)}
                className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5 lg:flex-row lg:items-center lg:gap-5 lg:px-6"
            >
                <span className="flex min-w-0 items-center gap-3 lg:w-72 lg:shrink-0">
                    <StaffAvatar name={leave.staff.name} />
                    <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate text-sm font-medium group-hover:text-brand-ink">
                            {leave.staff.name}
                        </span>
                        <span dir="auto" className="truncate text-xs text-muted-foreground">
                            {roleName(leave.staff.role)}
                        </span>
                        <Workplace workplace={leave.staff.workplace} className="text-xs text-muted-foreground" />
                    </span>
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <LeaveType type={leave.type} className="font-medium" />
                        <span className="text-muted-foreground tabular-nums">{span(leave)}</span>
                        <span className="font-medium tabular-nums">{t('staff.leave.days', { count: leave.days })}</span>
                    </span>
                    {leave.reason && <span className="line-clamp-1 text-xs text-muted-foreground">{leave.reason}</span>}
                </span>

                <span className="flex flex-wrap items-center gap-2 lg:w-56 lg:shrink-0 lg:justify-end">
                    <LeaveStatusBadge status={leave.status} />
                    <LeavePayBadge isPaid={leave.isPaid} />
                    <Badge variant="outline">{t(leave.isRequest ? 'staff.leave.asked' : 'staff.leave.given')}</Badge>
                </span>

                <span className="flex items-center gap-1 text-xs text-muted-foreground lg:w-32 lg:shrink-0 lg:justify-end">
                    {formatDate(leave.requestedOn)}
                    <ChevronRightIcon className="size-4 text-brand-ink transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
            </Link>
        </li>
    );
}

/**
 * Leave across the company: requests waiting for a decision, leave
 * approved as paid or unpaid, and leave turned down or called off, with
 * the month's leave days. Managers give leave from here too.
 */
export default function Leave({ filter, counts, leaves, summary, canManage }) {
    const { t, formatNumber } = useTranslation();
    const { formatMonth } = useCalendarFormat();
    const title = t('staff.leave.title');
    const month = formatMonth(summary.month);

    const giveButton = canManage && (
        <Button variant="brand" nativeButton={false} render={<Link href={route('leave.create')} />}>
            <CalendarPlusIcon data-icon="inline-start" />
            {t('staff.leave.give')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.staffMenu') }, { label: title }]} title={title} description={t('staff.leave.description')} actions={giveButton} />

            <FlashMessages errorKeys={['leave']} />

            <section aria-label={t('staff.leave.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={HourglassIcon}
                    tone="warning"
                    label={t('staff.leave.stats.pending')}
                    value={formatNumber(summary.pending)}
                    detail={summary.pending > 0 ? t('staff.leave.stats.pendingDetail') : t('staff.leave.stats.nonePending')}
                    href={summary.pending > 0 ? route('leave.index', { status: 'pending' }) : undefined}
                />
                <StatCard icon={TreePalmIcon} tone="gold" label={t('staff.leave.stats.today')} value={formatNumber(summary.onLeaveToday)} detail={t('staff.leave.stats.todayDetail')} />
                <StatCard
                    icon={BanknoteIcon}
                    tone="success"
                    label={t('staff.leave.stats.paidDays', { month })}
                    value={formatNumber(summary.paidDays)}
                    detail={t('staff.leave.stats.paidDaysDetail')}
                />
                <StatCard
                    icon={BanknoteXIcon}
                    tone="danger"
                    label={t('staff.leave.stats.unpaidDays', { month })}
                    value={formatNumber(summary.unpaidDays)}
                    detail={t('staff.leave.stats.unpaidDaysDetail')}
                />
            </section>

            <FilterTabs filter={filter} counts={counts} />

            <Card className="gap-0 overflow-hidden py-0">
                {leaves.data.length === 0 ? (
                    <ListEmpty icon={TreePalmIcon} title={t(`staff.leave.empty.${filter}.title`)} description={t(`staff.leave.empty.${filter}.description`)} action={filter === 'all' ? giveButton : undefined} />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {leaves.data.map((leave) => (
                            <LeaveRow key={leave.id} leave={leave} />
                        ))}
                    </ul>
                )}
            </Card>

            {leaves.last_page > 1 && (
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground tabular-nums">{t('properties.pagination.showing', { from: leaves.from, to: leaves.to, total: leaves.total })}</span>
                    <div className="flex gap-2">
                        {leaves.prev_page_url && (
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={leaves.prev_page_url} />}>
                                <ChevronLeftIcon data-icon="inline-start" className="rtl:-scale-x-100" />
                                {t('properties.pagination.previous')}
                            </Button>
                        )}
                        {leaves.next_page_url && (
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={leaves.next_page_url} />}>
                                {t('properties.pagination.next')}
                                <ChevronRightIcon data-icon="inline-end" className="rtl:-scale-x-100" />
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
