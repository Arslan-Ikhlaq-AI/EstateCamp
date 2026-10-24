import { FormActions } from '@/Components/FormShell';
import { ListEmpty } from '@/Components/RecordList';
import { ATTENDANCE, StaffAvatar, useStaffNames, Workplace } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { CalendarCheckIcon, CalendarX2Icon, CheckCheckIcon, CircleDashedIcon, TreePalmIcon, UsersRoundIcon } from 'lucide-react';
import { useState } from 'react';

// The colours of a chosen status, matching its badge.
const PRESSED = {
    present: 'aria-pressed:border-success/40 aria-pressed:bg-success/10 aria-pressed:text-success',
    half_day: 'aria-pressed:border-brand-cyan/50 aria-pressed:bg-brand-cyan/10 aria-pressed:text-brand-ink',
    absent: 'aria-pressed:border-destructive/40 aria-pressed:bg-destructive/10 aria-pressed:text-destructive',
    leave: 'aria-pressed:border-warning/40 aria-pressed:bg-warning/10 aria-pressed:text-warning',
    day_off: 'aria-pressed:border-foreground/20 aria-pressed:bg-muted aria-pressed:text-foreground',
};

// Statuses of someone at work, who can have the times they came and went.
const AT_WORK = ['present', 'half_day'];

const entryFrom = (person) => ({
    status: person.attendance?.status ?? null,
    check_in: person.attendance?.checkIn ?? '',
    check_out: person.attendance?.checkOut ?? '',
    note: person.attendance?.note ?? '',
});

const isSame = (a, b) => a.status === b.status && a.check_in === b.check_in && a.check_out === b.check_out && a.note === b.note;

/**
 * One person on the sheet: who they are, their attendance, and the times
 * and a note when they were at work.
 */
function SheetRow({ person, entry, error, statuses, onChange }) {
    const { t } = useTranslation();
    const { roleName } = useStaffNames();
    const isAtWork = AT_WORK.includes(entry.status);

    const chooseStatus = (status) => onChange(AT_WORK.includes(status) ? { status } : { status, check_in: '', check_out: '' });

    return (
        <li className={cn('flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:px-6', error && 'bg-destructive/[0.04]')}>
            <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
                <StaffAvatar name={person.name} />
                <div className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                        <Link href={route('staff.show', person.id)} dir="auto" className="truncate text-sm font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {person.name}
                        </Link>
                        {person.status === 'on_leave' && (
                            <Badge variant="warning">
                                <TreePalmIcon data-icon="inline-start" />
                                {t('staff.attendance.onLeave')}
                            </Badge>
                        )}
                    </span>
                    <span dir="auto" className="truncate text-xs text-muted-foreground">
                        {roleName(person.role)}
                    </span>
                    <Workplace workplace={person.workplace} className="text-xs text-muted-foreground" />
                    {error && <span className="text-xs text-destructive">{error}</span>}
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                <ToggleGroup
                    aria-label={t('staff.attendance.sheet')}
                    variant="outline"
                    size="sm"
                    value={entry.status ? [entry.status] : []}
                    onValueChange={([next]) => next !== undefined && chooseStatus(next)}
                    className="flex-wrap"
                >
                    {statuses.map((status) => {
                        const Icon = ATTENDANCE[status].icon;

                        return (
                            <ToggleGroupItem key={status} value={status} className={PRESSED[status]}>
                                <Icon data-icon="inline-start" />
                                {t(`staff.attendance.statuses.${status}`)}
                            </ToggleGroupItem>
                        );
                    })}
                </ToggleGroup>

                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="time"
                        aria-label={t('staff.attendance.checkIn')}
                        title={t('staff.attendance.checkIn')}
                        value={entry.check_in}
                        onChange={(event) => onChange({ check_in: event.target.value })}
                        disabled={!isAtWork}
                        className="h-8 w-28 tabular-nums"
                    />
                    <span aria-hidden="true" className="text-muted-foreground">
                        –
                    </span>
                    <Input
                        type="time"
                        aria-label={t('staff.attendance.checkOut')}
                        title={t('staff.attendance.checkOut')}
                        value={entry.check_out}
                        onChange={(event) => onChange({ check_out: event.target.value })}
                        disabled={!isAtWork}
                        className="h-8 w-28 tabular-nums"
                    />
                    <Input
                        aria-label={t('staff.attendance.note')}
                        placeholder={t('staff.attendance.notePlaceholder')}
                        value={entry.note}
                        onChange={(event) => onChange({ note: event.target.value })}
                        maxLength={255}
                        dir="auto"
                        className="h-8 w-full sm:w-44"
                    />
                </div>
            </div>
        </li>
    );
}

/**
 * The sheet for one day: the day's figures, everyone employed with their
 * attendance, and the bar to save what changed. Only people whose
 * attendance changed are sent.
 */
export default function DaySheet({ date, sheet, statuses }) {
    const { t, formatNumber } = useTranslation();
    const { errors } = usePage().props;
    const [entries, setEntries] = useState(() => Object.fromEntries(sheet.map((person) => [person.id, entryFrom(person)])));
    const [sentIds, setSentIds] = useState([]);
    const [processing, setProcessing] = useState(false);
    const changed = sheet.filter((person) => entries[person.id]?.status && !isSame(entries[person.id], entryFrom(person)));
    const count = (...wanted) => sheet.filter((person) => wanted.includes(entries[person.id]?.status)).length;
    const unmarked = count(null);

    const update = (personId, changes) => setEntries((current) => ({ ...current, [personId]: { ...current[personId], ...changes } }));

    // Everyone not yet marked is present, or on leave if that is their status.
    const markRestPresent = () =>
        setEntries((current) =>
            Object.fromEntries(
                sheet.map((person) => {
                    const entry = current[person.id];

                    return [person.id, entry.status ? entry : { ...entry, status: person.status === 'on_leave' ? 'leave' : 'present' }];
                }),
            ),
        );

    const errorFor = (personId) => {
        const index = sentIds.indexOf(personId);

        return index === -1 ? null : ['staff_member_id', 'status', 'check_in', 'check_out', 'note'].map((field) => errors[`entries.${index}.${field}`]).find(Boolean);
    };

    const save = () => {
        const sent = changed.map((person) => person.id);

        setSentIds(sent);
        router.post(
            route('attendance.store'),
            {
                work_date: date,
                entries: sent.map((personId) => {
                    const entry = entries[personId];

                    return { staff_member_id: personId, status: entry.status, check_in: entry.check_in || null, check_out: entry.check_out || null, note: entry.note || null };
                }),
            },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false) },
        );
    };

    if (sheet.length === 0) {
        return (
            <Card className="py-0">
                <ListEmpty icon={UsersRoundIcon} title={t('staff.attendance.empty.title')} description={t('staff.attendance.empty.description')} />
            </Card>
        );
    }

    return (
        <form
            noValidate
            className="flex flex-1 flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                save();
            }}
        >
            <section aria-label={t('staff.attendance.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={CalendarCheckIcon}
                    tone="success"
                    label={t('staff.attendance.stats.present')}
                    value={formatNumber(count('present', 'half_day'))}
                    detail={t('staff.attendance.stats.presentDetail', { count: count('half_day') })}
                />
                <StatCard
                    icon={CalendarX2Icon}
                    tone="warning"
                    label={t('staff.attendance.stats.absent')}
                    value={formatNumber(count('absent'))}
                    detail={t('staff.attendance.stats.absentDetail')}
                />
                <StatCard
                    icon={TreePalmIcon}
                    tone="gold"
                    label={t('staff.attendance.stats.away')}
                    value={formatNumber(count('leave', 'day_off'))}
                    detail={t('staff.attendance.stats.awayDetail', { leave: count('leave'), off: count('day_off') })}
                />
                <StatCard
                    icon={CircleDashedIcon}
                    label={t('staff.attendance.stats.unmarked')}
                    value={formatNumber(unmarked)}
                    meter={((sheet.length - unmarked) / sheet.length) * 100}
                    detail={unmarked > 0 ? t('staff.attendance.stats.unmarkedDetail', { total: sheet.length }) : t('staff.attendance.stats.allMarked')}
                />
            </section>

            <Card className="gap-0 py-0">
                <CardHeader className="border-b py-4">
                    <CardTitle>{t('staff.attendance.sheet')}</CardTitle>
                    <CardDescription>{t('staff.attendance.sheetDescription')}</CardDescription>
                    <CardAction>
                        <Button type="button" variant="outline" size="sm" onClick={markRestPresent} disabled={unmarked === 0}>
                            <CheckCheckIcon data-icon="inline-start" />
                            {t('staff.attendance.markAll')}
                        </Button>
                    </CardAction>
                </CardHeader>
                <ul className="flex flex-col divide-y">
                    {sheet.map((person) => (
                        <SheetRow
                            key={person.id}
                            person={person}
                            entry={entries[person.id]}
                            error={errorFor(person.id)}
                            statuses={statuses}
                            onChange={(changes) => update(person.id, changes)}
                        />
                    ))}
                </ul>
            </Card>

            <FormActions>
                <span className="me-auto text-sm text-muted-foreground tabular-nums">
                    {changed.length > 0 ? t('staff.attendance.changes', { count: changed.length }) : t('staff.attendance.noChanges')}
                </span>
                <Button type="submit" disabled={processing || changed.length === 0}>
                    {processing && <Spinner data-icon="inline-start" />}
                    {t('staff.attendance.save')}
                </Button>
            </FormActions>
        </form>
    );
}
