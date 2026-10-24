import ActionDialog from '@/Components/ActionDialog';
import { TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldGroup } from '@/components/ui/field';
import { addMonths, todayIso } from '@/hooks/use-leasing-format';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CalendarDaysIcon, CalendarIcon, CalendarRangeIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Named periods in the order the menu offers them, matching
 * FiltersByPeriod::PERIOD_PRESETS on the server.
 */
export const PERIOD_PRESETS = ['today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year'];

const parseDay = (day) => new Date(`${day}T00:00:00`);

/**
 * The last day (YYYY-MM-DD) of a YYYY-MM month.
 */
function monthEnd(month) {
    const [year, number] = month.split('-').map(Number);

    return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

/**
 * Whether a period is one calendar month, so it can be stepped a month at a time.
 */
function isSingleMonth(period) {
    return Boolean(period?.from && period?.to && period.from.endsWith('-01') && period.to === monthEnd(period.from.slice(0, 7)));
}

/**
 * Words for a period from the server (`{ name, kind, from, to }`): its
 * name ("This month", "September 2026", "Custom range") and the days it
 * covers ("October 2026", "Jul – Sep 2026", "1 Sep 2026 – 15 Sep 2026").
 */
export function usePeriodLabel() {
    const { t, locale, formatDate } = useTranslation();
    const intl = LOCALES[locale].intl;
    const monthFormat = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
    const shortMonthFormat = new Intl.DateTimeFormat(intl, { month: 'short', year: 'numeric', numberingSystem: 'latn' });

    const range = (period) => {
        if (!period?.from || !period?.to) {
            return '';
        }

        if (period.from === period.to) {
            return formatDate(period.from);
        }

        if (isSingleMonth(period)) {
            return monthFormat.format(parseDay(period.from));
        }

        if (period.from.endsWith('-01') && period.to === monthEnd(period.to.slice(0, 7))) {
            return `${shortMonthFormat.format(parseDay(period.from))} – ${shortMonthFormat.format(parseDay(period.to))}`;
        }

        return `${formatDate(period.from)} – ${formatDate(period.to)}`;
    };

    const name = (period) => {
        switch (period?.kind) {
            case 'all':
                return t('finance.period.all');
            case 'month':
                return monthFormat.format(parseDay(period.from));
            case 'range':
                return t('finance.period.custom');
            default:
                return t(`finance.period.${period?.name}`);
        }
    };

    return { name, range, full: (period) => [name(period), period?.kind === 'preset' ? range(period) : null].filter(Boolean).join(' · ') };
}

function MonthDialog({ period, onApply, open, onOpenChange }) {
    const { t } = useTranslation();
    const [month, setMonth] = useState(period?.from?.slice(0, 7) ?? todayIso().slice(0, 7));

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.period.monthTitle')}
            description={t('finance.period.monthDescription')}
            submitLabel={t('finance.period.apply')}
            onSubmit={() => month && onApply(month)}
        >
            <FieldGroup>
                <TextField id="period-month" type="month" label={t('finance.period.month')} value={month} onChange={setMonth} inputClassName="tabular-nums" />
            </FieldGroup>
        </ActionDialog>
    );
}

function RangeDialog({ period, onApply, open, onOpenChange }) {
    const { t } = useTranslation();
    const [from, setFrom] = useState(period?.from ?? `${todayIso().slice(0, 7)}-01`);
    const [to, setTo] = useState(period?.to ?? todayIso());
    const isInvalid = !from || !to || to < from;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.period.rangeTitle')}
            description={t('finance.period.rangeDescription')}
            submitLabel={t('finance.period.apply')}
            onSubmit={() => !isInvalid && onApply(`${from}..${to}`)}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField id="period-from" type="date" label={t('finance.period.from')} value={from} onChange={setFrom} inputClassName="tabular-nums" />
                <TextField
                    id="period-to"
                    type="date"
                    label={t('finance.period.to')}
                    value={to}
                    min={from}
                    onChange={setTo}
                    inputClassName="tabular-nums"
                    error={from && to && to < from ? t('finance.period.invalidRange') : undefined}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * The period a payments page covers: a menu of named periods (all time,
 * this month, last quarter…), a month or a custom range of days, and,
 * while one month is shown, arrows to step to the month before or after.
 * `period` is the server's resolved period; `onChange` gets the new value
 * as the URL carries it, '' for the page's default (`period.default`).
 */
export default function PeriodFilter({ period, onChange, className }) {
    const { t } = useTranslation();
    const { name, range } = usePeriodLabel();
    const [dialog, setDialog] = useState(null);
    const current = period?.value || period?.default || 'all';
    const choose = (value) => onChange(value === (period?.default ?? 'all') ? '' : value);
    const canStep = isSingleMonth(period);

    const step = (months) => {
        const month = addMonths(`${period.from.slice(0, 7)}-01`, months).slice(0, 7);
        const thisMonth = todayIso().slice(0, 7);
        const lastMonth = addMonths(`${thisMonth}-01`, -1).slice(0, 7);

        choose(month === thisMonth ? 'this_month' : month === lastMonth ? 'last_month' : month);
    };

    const subtitle = period?.kind === 'preset' ? range(period) : null;

    return (
        <div className={cn('flex items-center gap-1', className)}>
            {canStep && (
                <Button variant="outline" size="icon" aria-label={t('finance.period.previous')} onClick={() => step(-1)}>
                    <ChevronLeftIcon className="rtl:-scale-x-100" />
                </Button>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" className={cn(period?.kind !== 'all' && 'border-brand-cyan/40 bg-brand-cyan/[0.06]')} />}>
                    <CalendarDaysIcon data-icon="inline-start" className={cn(period?.kind !== 'all' && 'text-brand-cyan')} />
                    <span className="font-medium">{name(period)}</span>
                    {subtitle && <span className="hidden font-normal text-muted-foreground sm:inline">· {subtitle}</span>}
                    <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>{t('finance.period.label')}</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={current} onValueChange={choose}>
                            <DropdownMenuRadioItem value="all">{t('finance.period.all')}</DropdownMenuRadioItem>
                            {PERIOD_PRESETS.map((preset) => (
                                <DropdownMenuRadioItem key={preset} value={preset}>
                                    {t(`finance.period.${preset}`)}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setDialog('month')}>
                            <CalendarIcon />
                            {t('finance.period.pickMonth')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDialog('range')}>
                            <CalendarRangeIcon />
                            {t('finance.period.pickRange')}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {canStep && (
                <Button variant="outline" size="icon" aria-label={t('finance.period.next')} onClick={() => step(1)}>
                    <ChevronRightIcon className="rtl:-scale-x-100" />
                </Button>
            )}

            {dialog === 'month' && (
                <MonthDialog
                    period={period}
                    open
                    onOpenChange={(open) => !open && setDialog(null)}
                    onApply={(month) => {
                        setDialog(null);
                        choose(month);
                    }}
                />
            )}
            {dialog === 'range' && (
                <RangeDialog
                    period={period}
                    open
                    onOpenChange={(open) => !open && setDialog(null)}
                    onApply={(value) => {
                        setDialog(null);
                        choose(value);
                    }}
                />
            )}
        </div>
    );
}
