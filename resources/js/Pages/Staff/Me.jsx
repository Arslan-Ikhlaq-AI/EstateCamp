import { SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { AttendanceBadge, StaffAvatar, useCalendarFormat, useStaffNames } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, router } from '@inertiajs/react';
import { BanknoteIcon, CalendarCheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, LogInIcon, LogOutIcon, UserRoundXIcon } from 'lucide-react';
import { useState } from 'react';
import AttendanceCalendar from './Partials/AttendanceCalendar';
import { DocumentsCard, SalaryCard, SalaryHistory } from './Partials/StaffCards';

/**
 * Today at work: check in, check out (also of last night's shift), or what
 * the supervisor marked instead, with the times recorded.
 */
function TodayCard({ today }) {
    const { t, formatDate } = useTranslation();
    const { formatFullDay } = useCalendarFormat();
    const [processing, setProcessing] = useState(false);
    const mark = today.attendance;
    const send = (routeName) => router.post(route(routeName), {}, { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false) });

    let message = t('staff.me.today.notMarked');

    if (!today.isEmployed) {
        message = t('staff.me.today.notEmployed');
    } else if (today.openShift) {
        message =
            today.openShift.date === today.date
                ? t('staff.me.today.openShiftToday', { time: today.openShift.checkIn })
                : t('staff.me.today.openShift', { date: formatDate(today.openShift.date), time: today.openShift.checkIn });
    } else if (mark && !today.canCheckIn) {
        message = mark.status === 'present' && mark.checkOut ? t('staff.me.today.done') : t('staff.me.today.markedBy', { status: t(`staff.attendance.statuses.${mark.status}`) });
    }

    return (
        <Card className="h-full gap-3">
            <CardHeader>
                <CardDescription className="text-[0.875rem] font-medium">{t('staff.me.today.title')}</CardDescription>
                <CardTitle className="font-heading text-lg">{formatFullDay(today.date)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    {mark && <AttendanceBadge status={mark.status} />}
                    {mark?.checkIn && <span className="text-sm tabular-nums">{t('staff.me.today.checkedIn', { time: mark.checkIn })}</span>}
                    {mark?.checkOut && <span className="text-sm text-muted-foreground tabular-nums">· {t('staff.me.today.checkedOut', { time: mark.checkOut })}</span>}
                </div>
                <p className="text-[0.875rem] text-pretty text-muted-foreground">{message}</p>
                <div className="mt-auto">
                    {today.openShift ? (
                        <Button size="lg" className="w-full" disabled={processing} onClick={() => send('my.check-out')}>
                            {processing ? <Spinner data-icon="inline-start" /> : <LogOutIcon data-icon="inline-start" />}
                            {t('staff.me.today.checkOut')}
                        </Button>
                    ) : today.canCheckIn ? (
                        <Button size="lg" variant="brand" className="w-full" disabled={processing} onClick={() => send('my.check-in')}>
                            {processing ? <Spinner data-icon="inline-start" /> : <LogInIcon data-icon="inline-start" />}
                            {t('staff.me.today.checkIn')}
                        </Button>
                    ) : (
                        today.isEmployed &&
                        mark && (
                            <span className="flex items-center gap-2 text-sm font-medium text-success">
                                <CircleCheckIcon className="size-4" />
                                {t('staff.me.today.done')}
                            </span>
                        )
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * A staff member's own page: today's check-in, their month of attendance,
 * their salaries with whether each is paid, their pay and their documents.
 */
export default function Me({ staff, today, attendance, salaries, currency }) {
    const { t, formatNumber, formatCurrency, formatDate } = useTranslation();
    const { roleName, workplaceName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const title = t('staff.me.title');

    if (!staff) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={[{ label: title }]} title={title} />
                <Empty className="border bg-card py-16 shadow-(--card-shadow)">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <UserRoundXIcon />
                        </EmptyMedia>
                        <EmptyTitle>{t('staff.me.noRecord.title')}</EmptyTitle>
                        <EmptyDescription>{t('staff.me.noRecord.description')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </DashboardLayout>
        );
    }

    const latest = salaries[0];
    const counts = attendance.counts;
    const goTo = (month) => router.get(route('my.index'), month === attendance.currentMonth ? {} : { month }, { preserveScroll: true, only: ['attendance'] });
    const shiftMonth = (months) => addMonths(`${attendance.month}-01`, months).slice(0, 7);

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: title }]}
                title={t('staff.me.greeting', { name: staff.name.split(' ')[0] })}
                description={[roleName(staff.role), workplaceName(staff.workplace), staff.number].filter(Boolean).join(' · ')}
                actions={<StaffAvatar name={staff.name} className="size-11" />}
            />

            <FlashMessages errorKeys={['attendance']} />

            <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
                <TodayCard today={today} />
                <StatCard
                    icon={CalendarCheckIcon}
                    tone="success"
                    label={t('staff.me.stats.present')}
                    value={formatNumber((counts.present ?? 0) + (counts.half_day ?? 0))}
                    detail={t('staff.me.stats.presentDetail', { absent: counts.absent ?? 0, leave: counts.leave ?? 0, month: formatMonth(attendance.month) })}
                />
                {latest ? (
                    <StatCard
                        icon={BanknoteIcon}
                        tone={latest.status === 'paid' ? 'success' : 'gold'}
                        label={t('staff.me.stats.salary', { month: formatMonth(latest.period) })}
                        value={formatCurrency(latest.netPay, currency)}
                        detail={latest.status === 'paid' ? t('staff.me.stats.salaryPaid', { date: formatDate(latest.paidOn) }) : t('staff.me.stats.salaryPending')}
                    />
                ) : (
                    <StatCard
                        icon={BanknoteIcon}
                        tone="gold"
                        label={t('staff.me.stats.monthly')}
                        value={formatCurrency(staff.salary.gross, currency)}
                        detail={t('staff.me.stats.salaryNotPrepared')}
                    />
                )}
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard
                        title={`${t('staff.me.attendance')} · ${formatMonth(attendance.month)}`}
                        description={t('staff.me.attendanceDescription')}
                        action={
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
                        }
                    >
                        <AttendanceCalendar month={attendance.month} days={attendance.days} marks={attendance.marks} counts={counts} />
                    </SectionCard>

                    <SectionCard title={t('staff.me.salaries')} description={t('staff.me.salariesDescription')} flush>
                        <SalaryHistory salaries={salaries} currency={currency} empty={t('staff.show.noSalaries')} />
                    </SectionCard>
                </div>

                <div className="flex flex-col gap-6">
                    <SalaryCard salary={staff.salary} currency={currency} />
                    <DocumentsCard documents={staff.documents} />
                </div>
            </div>
        </DashboardLayout>
    );
}
