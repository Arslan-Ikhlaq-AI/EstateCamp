import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, XAxis, YAxis } from 'recharts';

const ROW_HEIGHT = 40;
const AXIS_HEIGHT = 26;
const SEGMENT_GAP = 2;
const END_RADIUS = 4;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const truncate = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/**
 * One segment of a stacked bar. Segments are separated by a 2px surface
 * gap, and the last filled segment gets the rounded data end; the baseline
 * end stays square. With a reversed (right-to-left) axis the stack grows
 * leftwards, so the gap and the rounding move to the left edge.
 */
function segmentShape(key, keys, isRtl) {
    return function StackSegment({ x, y, width, height, fill, payload }) {
        const left = Math.min(x, x + width);
        const size = Math.abs(width);

        if (!size) {
            return null;
        }

        const isLast = keys.slice(keys.indexOf(key) + 1).every((next) => !payload[next]);
        const gap = isLast ? 0 : Math.min(SEGMENT_GAP, size - 1);
        const radius = isLast ? END_RADIUS : 0;

        return (
            <Rectangle
                x={isRtl ? left + gap : left}
                y={y}
                width={size - gap}
                height={height}
                fill={fill}
                radius={isRtl ? [radius, 0, 0, radius] : [0, radius, radius, 0]}
            />
        );
    };
}

/**
 * A row's name beside its bar, on one line and shortened to fit.
 */
function CategoryTick({ x, y, payload, isRtl, maxLength }) {
    return (
        <text
            x={x}
            y={y}
            dy="0.35em"
            textAnchor={isRtl ? 'start' : 'end'}
            className="text-xs"
            style={{ fill: 'var(--foreground)' }}
        >
            <title>{payload.value}</title>
            {truncate(String(payload.value), maxLength)}
        </text>
    );
}

/**
 * The value written just past the end of each bar, such as its occupancy.
 */
function EndLabel({ viewBox, x: labelX, y: labelY, width: labelWidth, height: labelHeight, value, isRtl, format }) {
    const { x, y, width, height } = viewBox ?? { x: labelX, y: labelY, width: labelWidth, height: labelHeight };

    if (value === undefined || x === undefined) {
        return null;
    }

    const edge = isRtl ? Math.min(x, x + width) - 8 : Math.max(x, x + width) + 8;

    return (
        <text
            x={edge}
            y={y + height / 2}
            textAnchor={isRtl ? 'end' : 'start'}
            dominantBaseline="central"
            className="fill-foreground text-xs font-medium tabular-nums"
        >
            {format(value)}
        </text>
    );
}

/**
 * Horizontal stacked bars, one row per item, such as each property's beds by
 * status. `keys` are the stacked series in order (each needs a `config`
 * entry with its label and colour); `endLabel` writes `{ key, format }`
 * past each bar. Every value is also in the tooltip and the legend above,
 * so colour never carries a number alone.
 *
 * @param {{ data: Array<Record<string, any>>, keys: string[], config: Record<string, { label: string, color: string }>, endLabel?: { key: string, format: (value: any) => string }, formatValue?: (value: number) => string, formatTick?: (value: number) => string, label: string }} props
 */
export default function HorizontalStackChart({ data, keys, config, endLabel, formatValue, formatTick, label }) {
    const { dir, isRtl } = useTranslation();
    const isMobile = useIsMobile();
    const isAnimated = useMemo(() => !prefersReducedMotion(), []);
    const labelWidth = isMobile ? 96 : 156;

    return (
        <ChartContainer
            config={config}
            dir="ltr"
            role="img"
            aria-label={label}
            className="aspect-auto w-full"
            style={{ height: data.length * ROW_HEIGHT + AXIS_HEIGHT }}
            initialDimension={{ width: 640, height: data.length * ROW_HEIGHT + AXIS_HEIGHT }}
        >
            <BarChart
                accessibilityLayer
                data={data}
                layout="vertical"
                barSize={18}
                margin={{ top: 0, bottom: 0, left: isRtl ? 52 : 0, right: isRtl ? 0 : 52 }}
            >
                <CartesianGrid horizontal={false} />
                <XAxis
                    type="number"
                    reversed={isRtl}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    height={AXIS_HEIGHT}
                    tickFormatter={formatTick}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    orientation={isRtl ? 'right' : 'left'}
                    width={labelWidth}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={<CategoryTick isRtl={isRtl} maxLength={isMobile ? 13 : 24} />}
                />
                <ChartTooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                    content={<ChartTooltipContent dir={dir} valueFormatter={formatValue} />}
                />
                {keys.map((key, index) => (
                    <Bar
                        key={key}
                        dataKey={key}
                        stackId="stack"
                        fill={`var(--color-${key})`}
                        shape={segmentShape(key, keys, isRtl)}
                        isAnimationActive={isAnimated}
                        animationDuration={700}
                    >
                        {endLabel && index === keys.length - 1 && (
                            <LabelList dataKey={endLabel.key} content={<EndLabel isRtl={isRtl} format={endLabel.format} />} />
                        )}
                    </Bar>
                ))}
            </BarChart>
        </ChartContainer>
    );
}

/**
 * The legend above a chart: each series' swatch, name and total.
 *
 * @param {{ items: Array<{ key: string, label: string, color: string, value: string }> }} props
 */
export function ChartLegendList({ items }) {
    return (
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {items.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-[0.8125rem]">
                    <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium tabular-nums">{item.value}</span>
                </li>
            ))}
        </ul>
    );
}
