import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { Pie, PieChart } from 'recharts';

/**
 * A donut of parts of a whole. `segments` are `{ key, label, value, color }`
 * (zero values are left out); `children` sit in the hole, such as the total.
 * Segments are separated by a 2px surface gap and each one has a tooltip.
 * Pair it with a legend that names every segment and its value, so colour
 * never carries the figures alone.
 */
export default function DonutChart({ segments, label, size = 160, valueFormatter, className, children }) {
    const { dir } = useTranslation();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const config = Object.fromEntries(segments.map((segment) => [segment.key, { label: segment.label, color: segment.color }]));
    const data = segments.filter((segment) => segment.value > 0).map((segment) => ({ key: segment.key, value: segment.value, fill: segment.color }));

    return (
        <div role="img" aria-label={label} className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
            <ChartContainer config={config} className="aspect-square size-full" initialDimension={{ width: size, height: size }}>
                <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent dir={dir} hideLabel nameKey="key" valueFormatter={valueFormatter} />} />
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="key"
                        innerRadius="68%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={4}
                        stroke="var(--card)"
                        strokeWidth={2}
                        isAnimationActive={isAnimated}
                        animationDuration={800}
                    />
                </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
        </div>
    );
}

/**
 * The legend beside a donut: each segment's swatch (or icon), name, value
 * and share of the whole.
 */
export function DonutLegend({ segments, total, valueFormatter, formatShare }) {
    return (
        <ul className="flex w-full flex-col gap-2.5">
            {segments.map((segment) => (
                <li key={segment.key} className="flex items-center gap-3 text-sm">
                    {segment.icon ? (
                        <segment.icon aria-hidden="true" className="size-4 shrink-0" style={{ color: segment.color }} />
                    ) : (
                        <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ backgroundColor: segment.color }} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                    <span className="font-semibold tabular-nums">{valueFormatter(segment.value)}</span>
                    <span className="w-12 text-end text-xs text-muted-foreground tabular-nums">
                        {total > 0 ? formatShare((segment.value / total) * 100) : '—'}
                    </span>
                </li>
            ))}
        </ul>
    );
}
