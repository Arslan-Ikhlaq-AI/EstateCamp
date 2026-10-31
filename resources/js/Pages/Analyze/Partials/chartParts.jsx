import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

const parseDay = (day) => new Date(`${day}T00:00:00`);

export const SOURCES = ['contract_rent', 'short_term', 'extra_income'];

/**
 * Where revenue comes from, as one ramp of the brand blue, strongest for
 * client contracts (the main money) and palest for extra income. Validated
 * as an ordinal ramp in both themes; on the dark theme the ramp runs the
 * other way, so the strongest is the brightest.
 */
export const SOURCE_COLORS = {
    contract_rent: 'var(--chart-4)',
    short_term: 'var(--chart-1)',
    extra_income: 'var(--chart-context)',
};

/**
 * The ink of a figure set inside each source's fill: white or navy,
 * whichever reads best on it (by APCA) in each theme.
 */
export const SOURCE_INKS = {
    contract_rent: 'fill-white dark:fill-[#070d33]',
    short_term: 'fill-white',
    extra_income: 'fill-[#070d33] dark:fill-white',
};

/**
 * One source's part of a column: a block with every corner rounded and a
 * gap of the surface above and below, so the parts of a stack read apart.
 * `radius` is the largest rounding; small parts get less.
 */
export function ColumnSegment({ x, y, width, height, fill, radius = 8, gap = 3 }) {
    if (!height || height <= 0 || width <= 0) {
        return null;
    }

    const inset = height > gap * 2 ? gap / 2 : 0;
    const h = Math.max(height - inset * 2, 1);
    const r = Math.min(radius, width / 2, h / 2);

    return <rect x={x} y={y + inset} width={width} height={h} rx={r} ry={r} fill={fill} />;
}

/**
 * Whether a step of the timeline covers a whole calendar month.
 */
function isWholeMonth(step) {
    const after = parseDay(step.to);
    after.setDate(after.getDate() + 1);

    return step.from.endsWith('-01') && after.getDate() === 1;
}

/**
 * Amounts shortened for an axis or a bar's tip (12K, 1.2M).
 */
export function useCompactNumber() {
    const { locale } = useTranslation();
    const intl = LOCALES[locale].intl;

    return useMemo(() => new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' }), [intl]);
}

/**
 * Words for the steps of the timeline, grouped by `by` (day, week or
 * month): a short label for an axis ("6 Oct", "Oct") and a full one for a
 * tooltip ("6 Oct 2026 – 12 Oct 2026", "October 2026"). Months carry the
 * year when the timeline crosses one.
 */
export function useTimelineLabels(by, timeline) {
    const { locale, formatDate } = useTranslation();
    const intl = LOCALES[locale].intl;
    const crossesYear = timeline.length > 0 && timeline[0].from.slice(0, 4) !== timeline[timeline.length - 1].from.slice(0, 4);

    return useMemo(() => {
        const dayMonth = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', numberingSystem: 'latn' });
        const month = new Intl.DateTimeFormat(intl, { month: 'short', ...(crossesYear && { year: '2-digit' }), numberingSystem: 'latn' });
        const longMonth = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
        const range = (step) => (step.from === step.to ? formatDate(step.from) : `${formatDate(step.from)} – ${formatDate(step.to)}`);

        return {
            short: (step) => (by === 'month' ? month : dayMonth).format(parseDay(step.from)),
            long: (step) => (by === 'month' && isWholeMonth(step) ? longMonth.format(parseDay(step.from)) : range(step)),
        };
    }, [by, intl, crossesYear, formatDate]);
}

/**
 * A horizontal bar (or a segment of one) whose data end, on `side`, is
 * rounded 4px and whose base stays square. Recharts may hand over a
 * negative width when the axis runs right to left, so the box is
 * normalised first.
 */
export function RoundedBar({ x, y, width, height, fill, side, stroke = 'var(--card)' }) {
    const left = Math.min(x, x + width);
    const right = Math.max(x, x + width);
    const w = right - left;

    if (w <= 0 || height <= 0) {
        return null;
    }

    if (!side) {
        return <rect x={left} y={y} width={w} height={height} fill={fill} stroke={stroke} strokeWidth={2} />;
    }

    const r = Math.min(4, w, height / 2);
    const bottom = y + height;
    const path =
        side === 'right'
            ? `M${left},${y} H${right - r} Q${right},${y} ${right},${y + r} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${left} Z`
            : `M${right},${y} H${left + r} Q${left},${y} ${left},${y + r} V${bottom - r} Q${left},${bottom} ${left + r},${bottom} H${right} Z`;

    return <path d={path} fill={fill} stroke={stroke} strokeWidth={2} />;
}

function TooltipRow({ row, isStrong = false }) {
    return (
        <div className="flex items-center gap-2 leading-none">
            {row.color ? <span aria-hidden="true" className="h-3 w-1 shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} /> : <span className="w-1" />}
            <span className="flex-1 text-muted-foreground">{row.label}</span>
            <span className={cn('ms-3 text-foreground tabular-nums', isStrong ? 'font-semibold' : 'font-medium')}>{row.value}</span>
        </div>
    );
}

/**
 * A tooltip in the look of the chart library's own: a title, then rows of
 * a short colour key, a name and a value, the value leading. `footer` rows,
 * such as a total, follow under a hairline, the first one in bold.
 */
export function TooltipBox({ title, rows, footer = [] }) {
    const { dir } = useTranslation();

    return (
        <div dir={dir} className="grid min-w-48 gap-1.5 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-(--overlay-shadow) ring-1 ring-foreground/10">
            <div className="font-medium">{title}</div>
            <div className="grid gap-1.5">
                {rows.map((row) => (
                    <TooltipRow key={row.key} row={row} />
                ))}
            </div>
            {footer.length > 0 && (
                <div className="mt-0.5 grid gap-1.5 border-t pt-2">
                    {footer.map((row, index) => (
                        <TooltipRow key={row.key} row={row} isStrong={index === 0} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * The tooltip of a revenue column: what each source brought in that step,
 * then the total and, when there is one, the same step of the period
 * before. `long` names the step.
 */
export function SourcesTooltip({ active, payload, long, currency }) {
    const { t, formatMoney } = useTranslation();

    if (!active || !payload?.length) {
        return null;
    }

    const step = payload[0].payload;

    return (
        <TooltipBox
            title={long(step)}
            rows={SOURCES.map((source) => ({ key: source, color: SOURCE_COLORS[source], label: t(`analyze.sources.${source}`), value: formatMoney(step[source], currency) }))}
            footer={[
                { key: 'total', label: t('analyze.columns.total'), value: formatMoney(step.total, currency) },
                ...(step.previous === null || step.previous === undefined ? [] : [{ key: 'previous', label: t('analyze.columns.previous'), value: formatMoney(step.previous, currency) }]),
            ]}
        />
    );
}

/**
 * A name on a bar chart's axis, cut short with an ellipsis so long
 * property names keep the bars in line.
 */
export function NameTick({ x, y, payload, anchor = 'end', maxLength = 22 }) {
    const name = String(payload.value);
    const shown = name.length > maxLength ? `${name.slice(0, maxLength - 1)}…` : name;

    return (
        <text x={x} y={y} dy={4} textAnchor={anchor} className="fill-muted-foreground text-xs">
            <title>{name}</title>
            {shown}
        </text>
    );
}
