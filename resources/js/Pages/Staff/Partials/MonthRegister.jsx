import { ListEmpty } from '@/Components/RecordList';
import { ATTENDANCE, dayOfMonth, useCalendarFormat, useStaffNames } from '@/Components/StaffBadges';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { UsersRoundIcon } from 'lucide-react';

// The totals shown at the end of each row, in this order.
const TOTALS = ['present', 'half_day', 'absent', 'leave', 'day_off'];

/**
 * A month of attendance for everyone employed in it: one row per person,
 * one cell per day holding the letter of what was marked, then the totals.
 * Days before someone joined or after they left are greyed out; days
 * still to come are left empty.
 */
export default function MonthRegister({ month, register, today }) {
    const { t, formatNumber } = useTranslation();
    const { roleName } = useStaffNames();
    const { formatMonth, weekdayLetter, formatFullDay } = useCalendarFormat();
    const days = Array.from({ length: register.days }, (_, index) => dayOfMonth(month, index + 1));

    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t('staff.attendance.register.title', { month: formatMonth(month) })}</CardTitle>
                <CardDescription>{t('staff.attendance.register.description')}</CardDescription>
            </CardHeader>

            {register.rows.length === 0 ? (
                <ListEmpty icon={UsersRoundIcon} title={t('staff.attendance.emptyRegister.title')} description={t('staff.attendance.emptyRegister.description')} />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                            <tr className="bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))]">
                                <th scope="col" className="sticky start-0 z-10 min-w-44 bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))] px-4 py-2 text-start font-medium sm:px-5 lg:px-6">
                                    {t('staff.columns.staff')}
                                </th>
                                {days.map((day, index) => (
                                    <th key={day} scope="col" title={formatFullDay(day)} className={cn('px-px py-2 text-center font-medium', day === today && 'text-brand-ink')}>
                                        <span className="flex flex-col items-center text-[0.6875rem] leading-tight">
                                            <span className="text-muted-foreground uppercase">{weekdayLetter(day)}</span>
                                            <span className="tabular-nums">{index + 1}</span>
                                        </span>
                                    </th>
                                ))}
                                {TOTALS.map((status) => (
                                    <th key={status} scope="col" title={t(`staff.attendance.statuses.${status}`)} className="px-1 py-2 text-center text-[0.6875rem] font-semibold last:pe-4 sm:last:pe-5 lg:last:pe-6">
                                        <span className={cn('inline-flex size-6 items-center justify-center rounded-md', ATTENDANCE[status].cell)}>{t(`staff.attendance.short.${status}`)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {register.rows.map((person) => (
                                <tr key={person.id} className="group/row">
                                    <th scope="row" className="sticky start-0 z-10 border-t bg-card px-4 py-2 text-start font-normal sm:px-5 lg:px-6">
                                        <span className="flex min-w-0 flex-col">
                                            <Link href={route('staff.show', person.id)} dir="auto" className="max-w-40 truncate text-[0.8125rem] font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                {person.name}
                                            </Link>
                                            <span dir="auto" className="max-w-40 truncate text-[0.6875rem] text-muted-foreground">
                                                {roleName(person.role)}
                                            </span>
                                        </span>
                                    </th>
                                    {days.map((day, index) => {
                                        const status = person.marks[index + 1];
                                        const isEmployed = day >= person.joinedOn && (!person.leftOn || day <= person.leftOn);
                                        const label = `${formatFullDay(day)} · ${status ? t(`staff.attendance.statuses.${status}`) : t(isEmployed ? 'staff.attendance.register.notMarked' : 'staff.attendance.register.notEmployed')}`;

                                        return (
                                            <td key={day} className="border-t px-px py-2 text-center">
                                                <span
                                                    title={label}
                                                    aria-label={label}
                                                    className={cn(
                                                        'mx-auto flex size-5.5 items-center justify-center rounded-md text-[0.625rem] font-bold',
                                                        status && ATTENDANCE[status].cell,
                                                        !status && isEmployed && day <= today && 'text-muted-foreground/60 ring-1 ring-foreground/[0.08] ring-inset',
                                                        !isEmployed && 'bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_3px,transparent_3px_6px)]',
                                                    )}
                                                >
                                                    {status ? t(`staff.attendance.short.${status}`) : isEmployed && day <= today ? '·' : ''}
                                                </span>
                                            </td>
                                        );
                                    })}
                                    {TOTALS.map((status) => (
                                        <td key={status} className="border-t px-1 py-2 text-center text-[0.8125rem] font-semibold tabular-nums last:pe-4 sm:last:pe-5 lg:last:pe-6">
                                            {person.counts[status] > 0 ? formatNumber(person.counts[status]) : <span className="text-muted-foreground/50">0</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <CardFooter className="flex flex-wrap gap-x-4 gap-y-2 border-t bg-transparent px-4 py-3 sm:px-5 lg:px-6">
                <span className="text-xs font-semibold text-muted-foreground">{t('staff.attendance.register.legend')}</span>
                {Object.entries(ATTENDANCE).map(([status, { cell }]) => (
                    <span key={status} className="flex items-center gap-1.5 text-xs">
                        <span className={cn('flex size-5 items-center justify-center rounded-md text-[0.625rem] font-bold', cell)}>{t(`staff.attendance.short.${status}`)}</span>
                        {t(`staff.attendance.statuses.${status}`)}
                    </span>
                ))}
                <span className="flex items-center gap-1.5 text-xs">
                    <span className="flex size-5 items-center justify-center rounded-md text-muted-foreground/60 ring-1 ring-foreground/[0.08] ring-inset">·</span>
                    {t('staff.attendance.register.notMarked')}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                    <span className="size-5 rounded-md bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_3px,transparent_3px_6px)] ring-1 ring-foreground/[0.06] ring-inset" />
                    {t('staff.attendance.register.notEmployed')}
                </span>
            </CardFooter>
        </Card>
    );
}
