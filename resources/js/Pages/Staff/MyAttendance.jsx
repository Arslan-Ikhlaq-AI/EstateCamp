import DataTable from '@/Components/DataTable';
import { SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { AttendanceBadge, useCalendarFormat, useStaffNames } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, router } from '@inertiajs/react';
import { CalendarCheckIcon, CalendarXIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, LogInIcon, LogOutIcon, TreePalmIcon } from 'lucide-react';
import { useState } from 'react';
import { NoStaffRecord } from './Partials/StaffCards';

/**
 * Minutes as "8h 30m", or "9h" on the hour.
 */
function useDuration() {
    const { t } = useTranslation();

    return (minutes) =>
        minutes % 60 === 0
            ? t('staff.myAttendance.wholeHours', { hours: minutes / 60 })
            : t('staff.myAttendance.duration', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/**
 * The page's main action: mark today's attendance (checking in at the
 * current time), then check out; once the day is recorded, what was marked
 * and its times.
 */
function MarkAttendance({ today }) {
    const { t, formatDate } = useTranslation();
    const [processing, setProcessing] = useState(false);
    const mark = today.attendance;
    const send = (routeName) => router.post(route(routeName), {}, { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false) });

    if (today.openShift) {
        return (
            <>
                <span className="text-sm text-muted-foreground tabular-nums">
                    {today.openShift.date === today.date
                        ? t('staff.me.today.openShiftToday', { time: today.openShift.checkIn })
                        : t('staff.me.today.openShift', { date: formatDate(today.openShift.date), time: today.openShift.checkIn })}
                </span>
                <Button size="lg" disabled={processing} onClick={() => send('my.check-out')}>
                    {processing ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />}
                    {t('staff.me.today.checkOut')}
                </Button>
            </>
        );
    }

    if (today.canCheckIn) {
        return (
            <Button size="lg" variant="brand" disabled={processing} onClick={() => send('my.check-in')}>
                {processing ? <Spinner data-icon="inline-start" /> : <LogInIcon data-icon="inline-start" />}
                {t('staff.myAttendance.mark')}
            </Button>
        );
    }

    if (!mark) {
        return today.isEmployed ? null : <span className="text-sm text-muted-foreground">{t('staff.me.today.notEmployed')}</span>;
    }

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-(--card-shadow)">
            <span className="text-sm font-medium">{t('staff.attendance.today')}</span>
            <AttendanceBadge status={mark.status} />
            {mark.checkIn && (
                <span className="text-sm text-muted-foreground tabular-nums">
                    {mark.checkIn}–{mark.checkOut ?? '…'}
                </span>
            )}
        </div>
    );
}

/**
 * The month's totals: days present, absent and on leave, and the hours
 * worked on the days checked in and out.
 */
function MonthTotals({ attendance }) {
    const { t, formatNumber } = useTranslation();
    const duration = useDuration();
    const { counts } = attendance;

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={CalendarCheckIcon}
                tone="success"
                label={t('staff.myAttendance.stats.present')}
                value={formatNumber(counts.present)}
                detail={counts.half_day > 0 ? t('staff.myAttendance.stats.halfDays', { count: counts.half_day }) : t('staff.myAttendance.stats.fullDays')}
            />
            <StatCard
                icon={CalendarXIcon}
                tone="danger"
                label={t('staff.myAttendance.stats.absent')}
                value={formatNumber(counts.absent)}
                detail={t('staff.myAttendance.stats.absentDetail')}
            />
            <StatCard
                icon={TreePalmIcon}
                tone="gold"
                label={t('staff.myAttendance.stats.leave')}
                value={formatNumber(counts.leave)}
                detail={counts.day_off > 0 ? t('staff.myAttendance.stats.daysOff', { count: counts.day_off }) : t('staff.myAttendance.stats.noDaysOff')}
            />
            <StatCard
                icon={ClockIcon}
                label={t('staff.myAttendance.stats.hours')}
                value={duration(attendance.minutes)}
                detail={[
                    t('staff.myAttendance.stats.timedDays', { count: attendance.timedDays }),
                    counts.unmarked > 0 && t('staff.myAttendance.stats.notMarked', { count: counts.unmarked }),
                ]
                    .filter(Boolean)
                    .join(' · ')}
            />
        </div>
    );
}

/**
 * Each day of the month so far, newest first, with what was marked and
 * the times in and out.
 */
function DayList({ days, today }) {
    const { t } = useTranslation();
    const { formatFullDay } = useCalendarFormat();
    const duration = useDuration();
    const blank = <span className="text-muted-foreground">—</span>;

    if (days.length === 0) {
        return <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{t('staff.myAttendance.empty')}</p>;
    }

    return (
        <DataTable
            rowKey="date"
            rows={days}
            columns={[
                {
                    id: 'day',
                    header: t('staff.myAttendance.columns.day'),
                    cell: (day) => (
                        <span className="flex items-center gap-2 font-medium whitespace-nowrap">
                            {formatFullDay(day.date)}
                            {day.date === today && <Badge variant="info">{t('staff.attendance.today')}</Badge>}
                        </span>
                    ),
                },
                {
                    id: 'status',
                    header: t('staff.myAttendance.columns.status'),
                    cell: (day) =>
                        day.status ? <AttendanceBadge status={day.status} /> : <span className="text-sm text-muted-foreground">{t('staff.attendance.register.notMarked')}</span>,
                },
                {
                    id: 'checkIn',
                    header: t('staff.myAttendance.columns.checkIn'),
                    cell: (day) => <span className="tabular-nums">{day.checkIn ?? blank}</span>,
                },
                {
                    id: 'checkOut',
                    header: t('staff.myAttendance.columns.checkOut'),
                    cell: (day) => <span className="tabular-nums">{day.checkOut ?? blank}</span>,
                },
                {
                    id: 'hours',
                    header: t('staff.myAttendance.columns.hours'),
                    align: 'end',
                    cell: (day) => <span className="font-medium whitespace-nowrap tabular-nums">{day.minutes === null ? blank : duration(day.minutes)}</span>,
                },
                {
                    id: 'note',
                    header: t('staff.myAttendance.columns.note'),
                    cell: (day) => (day.note ? <span className="line-clamp-2 max-w-64 text-sm text-muted-foreground">{day.note}</span> : blank),
                },
            ]}
        />
    );
}

/**
 * A staff member's own attendance: a button to mark today, the month's
 * totals, and the month day by day.
 */
export default function MyAttendance({ staff, today, attendance }) {
    const { t } = useTranslation();
    const { roleName, workplaceName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const title = t('staff.myAttendance.title');
    const breadcrumbs = [{ label: t('nav.staffMenu') }, { label: title }];

    if (!staff) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={breadcrumbs} title={title} />
                <NoStaffRecord />
            </DashboardLayout>
        );
    }

    const month = formatMonth(attendance.month);
    const goTo = (value) => router.get(route('my.attendance'), value === attendance.currentMonth ? {} : { month: value }, { preserveScroll: true, only: ['attendance'] });
    const shiftMonth = (months) => addMonths(`${attendance.month}-01`, months).slice(0, 7);

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={breadcrumbs}
                title={title}
                description={[staff.name, roleName(staff.role), workplaceName(staff.workplace)].filter(Boolean).join(' · ')}
                actions={<MarkAttendance today={today} />}
            />

            <FlashMessages errorKeys={['attendance']} />

            <section aria-labelledby="totals-heading" className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="totals-heading" className="font-heading text-lg font-bold">
                        {t('staff.myAttendance.totals', { month })}
                    </h2>
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={t('staff.attendance.previousMonth')}
                            onClick={() => goTo(shiftMonth(-1))}
                            disabled={attendance.month <= attendance.firstMonth}
                        >
                            <ChevronLeftIcon className="rtl:-scale-x-100" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={t('staff.attendance.nextMonth')}
                            onClick={() => goTo(shiftMonth(1))}
                            disabled={attendance.month >= attendance.currentMonth}
                        >
                            <ChevronRightIcon className="rtl:-scale-x-100" />
                        </Button>
                    </div>
                </div>
                <MonthTotals attendance={attendance} />
            </section>

            <SectionCard title={t('staff.myAttendance.list', { month })} description={t('staff.myAttendance.listDescription')} flush>
                <DayList days={attendance.days} today={today.date} />
            </SectionCard>
        </DashboardLayout>
    );
}
