import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
import { LEVEL_ICONS, useCalendarFormat } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { CalendarCheckIcon, CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, LayersIcon, TableIcon } from 'lucide-react';
import DaySheet from './Partials/DaySheet';
import MonthRegister from './Partials/MonthRegister';

const WORKPLACE_ICONS = { head_office: LEVEL_ICONS.head_office, office: LEVEL_ICONS.regional, property: LEVEL_ICONS.site };

// The day before or after a YYYY-MM-DD day.
const shiftDay = (day, days) => {
    const date = new Date(`${day}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
};

/**
 * The daily sheet or the monthly register, keeping the workplace.
 */
function ViewTabs({ view, workplace }) {
    const { t } = useTranslation();
    const tabs = [
        { value: 'day', label: t('staff.attendance.tabs.day'), icon: CalendarCheckIcon },
        { value: 'month', label: t('staff.attendance.tabs.month'), icon: TableIcon },
    ];

    return (
        <nav aria-label={t('staff.attendance.title')} className="flex w-fit flex-wrap gap-1 rounded-2xl bg-muted/70 p-1 ring-1 ring-foreground/[0.06]">
            {tabs.map((tab) => {
                const isActive = view === tab.value;

                return (
                    <Link
                        key={tab.value}
                        href={route('attendance.index', { ...(tab.value === 'month' ? { view: 'month' } : {}), ...(workplace ? { workplace } : {}) })}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            isActive && 'bg-card text-foreground shadow-(--card-shadow) ring-1 ring-foreground/[0.06]',
                        )}
                    >
                        <tab.icon className={cn('size-4', isActive && 'text-brand-cyan')} />
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}

/**
 * Choose one workplace, or all of them.
 */
function WorkplacePicker({ workplace, workplaces, onChange }) {
    const { t } = useTranslation();
    const items = [
        { value: 'all', label: t('staff.attendance.allWorkplaces'), icon: LayersIcon },
        ...workplaces.map((option) => ({
            value: option.value,
            label: option.type === 'head_office' ? t('staff.levels.head_office') : option.label,
            icon: WORKPLACE_ICONS[option.type],
        })),
    ];

    return (
        <Select items={items} value={workplace ?? 'all'} onValueChange={(value) => onChange(value === 'all' ? null : value)}>
            <SelectTrigger aria-label={t('staff.attendance.workplace')} className="w-full sm:w-64">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            <item.icon />
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

/**
 * Previous and next buttons around a date or month field.
 */
function Stepper({ previousLabel, nextLabel, onPrevious, onNext, canGoNext, children }) {
    return (
        <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" aria-label={previousLabel} onClick={onPrevious}>
                <ChevronLeftIcon className="rtl:-scale-x-100" />
            </Button>
            {children}
            <Button variant="outline" size="icon" aria-label={nextLabel} onClick={onNext} disabled={!canGoNext}>
                <ChevronRightIcon className="rtl:-scale-x-100" />
            </Button>
        </div>
    );
}

/**
 * Attendance: one day's sheet to mark who came to work, or the month's
 * register, for one workplace or all of them.
 */
export default function Attendance({ company, view, date, month, today, workplace, workplaces, statuses, sheet, register }) {
    const { t } = useTranslation();
    const { formatFullDay } = useCalendarFormat();
    const title = t('staff.attendance.title');
    const currentMonth = today?.slice(0, 7);

    const visit = (changes) => {
        const next = { view, date, month, workplace, ...changes };

        router.get(
            route('attendance.index'),
            {
                ...(next.view === 'month' ? { view: 'month', month: next.month } : { date: next.date }),
                ...(next.workplace ? { workplace: next.workplace } : {}),
            },
            { preserveScroll: true },
        );
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('staff.title'), href: route('staff.index') }, { label: title }]} title={title} description={t('staff.attendance.description')} />

            <FlashMessages errorKeys={['work_date', 'entries']} />

            {company === null ? (
                <NoCompany icon={CalendarCheckIcon} />
            ) : (
                <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <ViewTabs view={view} workplace={workplace} />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <WorkplacePicker workplace={workplace} workplaces={workplaces} onChange={(value) => visit({ workplace: value })} />
                            {view === 'day' && date !== today && (
                                <Button variant="outline" onClick={() => visit({ date: today })} className="sm:order-last">
                                    {t('staff.attendance.today')}
                                </Button>
                            )}
                            {view === 'day' ? (
                                <Stepper
                                    previousLabel={t('staff.attendance.previousDay')}
                                    nextLabel={t('staff.attendance.nextDay')}
                                    onPrevious={() => visit({ date: shiftDay(date, -1) })}
                                    onNext={() => visit({ date: shiftDay(date, 1) })}
                                    canGoNext={date < today}
                                >
                                    <Input
                                        type="date"
                                        aria-label={t('staff.attendance.day')}
                                        value={date}
                                        max={today}
                                        onChange={(event) => event.target.value && visit({ date: event.target.value })}
                                        className="w-40 tabular-nums"
                                    />
                                </Stepper>
                            ) : (
                                <Stepper
                                    previousLabel={t('staff.attendance.previousMonth')}
                                    nextLabel={t('staff.attendance.nextMonth')}
                                    onPrevious={() => visit({ month: addMonths(`${month}-01`, -1).slice(0, 7) })}
                                    onNext={() => visit({ month: addMonths(`${month}-01`, 1).slice(0, 7) })}
                                    canGoNext={month < currentMonth}
                                >
                                    <Input
                                        type="month"
                                        aria-label={t('staff.attendance.month')}
                                        value={month}
                                        max={currentMonth}
                                        onChange={(event) => event.target.value && visit({ month: event.target.value })}
                                        className="w-40 tabular-nums"
                                    />
                                </Stepper>
                            )}
                        </div>
                    </div>

                    {view === 'day' ? (
                        <>
                            <p className="-mt-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <CalendarDaysIcon className="size-4" />
                                {formatFullDay(date)}
                            </p>
                            <DaySheet key={`${date}|${workplace ?? 'all'}`} date={date} sheet={sheet} statuses={statuses} />
                        </>
                    ) : (
                        <MonthRegister month={month} register={register} today={today} />
                    )}
                </>
            )}
        </DashboardLayout>
    );
}
