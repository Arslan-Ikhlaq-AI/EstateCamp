import { ATTENDANCE, dayOfMonth, useCalendarFormat } from '@/Components/StaffBadges';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * One person's month as a calendar: each day in the colour of what was
 * marked, with the counts and a key below. Days still to come are faded.
 * `marks` are `{ day, status, checkIn, checkOut, note }`.
 */
export default function AttendanceCalendar({ month, days, marks, counts }) {
    const { t, formatNumber } = useTranslation();
    const { weekdayLetter, formatFullDay } = useCalendarFormat();
    const today = todayIso();
    const byDay = Object.fromEntries(marks.map((mark) => [mark.day, mark]));
    // Weeks start on Monday, as in the UAE; getDay() counts from Sunday.
    const offset = (new Date(`${dayOfMonth(month, 1)}T00:00:00`).getDay() + 6) % 7;
    // 1 June 2026 was a Monday, so its first week names the days in order.
    const weekdays = Array.from({ length: 7 }, (_, index) => weekdayLetter(dayOfMonth('2026-06', index + 1)));

    return (
        <div className="flex flex-col gap-5">
            <div className="grid max-w-md grid-cols-7 gap-1.5 text-center">
                {weekdays.map((letter, index) => (
                    <span key={index} aria-hidden="true" className="text-[0.6875rem] font-semibold text-muted-foreground uppercase">
                        {letter}
                    </span>
                ))}
                {Array.from({ length: offset }, (_, index) => (
                    <span key={`blank-${index}`} aria-hidden="true" />
                ))}
                {Array.from({ length: days }, (_, index) => {
                    const day = index + 1;
                    const date = dayOfMonth(month, day);
                    const mark = byDay[day];
                    const label = [formatFullDay(date), mark ? t(`staff.attendance.statuses.${mark.status}`) : t('staff.attendance.register.notMarked'), mark?.checkIn && `${mark.checkIn}–${mark.checkOut ?? '…'}`, mark?.note]
                        .filter(Boolean)
                        .join(' · ');

                    return (
                        <span
                            key={day}
                            title={label}
                            aria-label={label}
                            className={cn(
                                'flex h-9 items-center justify-center rounded-lg text-[0.8125rem] font-semibold tabular-nums',
                                mark ? ATTENDANCE[mark.status].cell : 'text-muted-foreground ring-1 ring-foreground/[0.07] ring-inset',
                                date > today && 'opacity-40',
                                date === today && 'ring-2 ring-brand-cyan',
                            )}
                        >
                            {day}
                        </span>
                    );
                })}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {Object.entries(ATTENDANCE).map(([status, { icon: Icon, cell }]) => (
                    <li key={status} className="flex items-center gap-1.5 text-[0.8125rem]">
                        <span className={cn('flex size-5 items-center justify-center rounded-md', cell)}>
                            <Icon className="size-3" />
                        </span>
                        <span className="text-muted-foreground">{t(`staff.attendance.statuses.${status}`)}</span>
                        <span className="font-semibold tabular-nums">{formatNumber(counts[status] ?? 0)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
