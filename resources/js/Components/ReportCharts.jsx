import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const toDate = (month) => new Date(`${month}-01T00:00:00`);

/**
 * Month names for a chart's axis and tooltip.
 *
 * Report charts are drawn without animation: a report is a document, and
 * printing redraws its charts at the page's width, which would replay the
 * animation and leave them blank on paper.
 */
function useMonthAxis() {
    const { locale } = useTranslation();
    const intl = LOCALES[locale].intl;

    return useMemo(() => {
        const short = new Intl.DateTimeFormat(intl, { month: 'short' });
        const long = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' });

        return {
            shortMonth: (month) => short.format(toDate(month)),
            longMonth: (month) => long.format(toDate(month)),
            compact: new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' }),
        };
    }, [intl]);
}

/**
 * The legend above a chart of two or more series: each one's swatch, name
 * and, when given, its total.
 */
export function ChartLegend({ series }) {
    return (
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {series.map((item) => (
                <div key={item.key} className="flex flex-col gap-0.5">
                    <dt className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                        <span aria-hidden="true" className="size-2.5 rounded-[3px] print:[print-color-adjust:exact]" style={{ backgroundColor: item.color }} />
                        {item.label}
                    </dt>
                    {item.total !== undefined && <dd className="text-lg font-bold tracking-tight tabular-nums">{item.total}</dd>}
                </div>
            ))}
        </dl>
    );
}

/**
 * Figures over the months as lines with a soft fill beneath, one for each
 * series. `data` are `{ month, ...values }` and `series` are
 * `{ key, label, color, total? }`; more than one series brings a legend,
 * and the first is drawn on top. `compactAxis` shortens large amounts on
 * the axis (12K); counts leave it off.
 */
export function MonthlyAreaChart({ data, series, valueFormatter, compactAxis = true, className = 'h-64' }) {
    const { dir, isRtl, formatNumber } = useTranslation();
    const { shortMonth, longMonth, compact } = useMonthAxis();
    const config = Object.fromEntries(series.map((item) => [item.key, { label: item.label, color: item.color }]));
    const rows = data.map((point) => ({ ...point, label: shortMonth(point.month) }));
    const peak = Math.max(...data.flatMap((point) => series.map((item) => point[item.key])), 1);
    const gradientId = (key) => `report-area-${series.map((item) => item.key).join('-')}-${key}`;

    return (
        <div className="flex flex-col gap-5">
            {series.length > 1 && <ChartLegend series={series} />}
            <ChartContainer config={config} dir="ltr" className={cn('aspect-auto w-full', className)} initialDimension={{ width: 640, height: 256 }}>
                <AreaChart accessibilityLayer data={rows} margin={{ top: 8, left: 4, right: 4, bottom: 0 }}>
                    <defs>
                        {series.map((item) => (
                            <linearGradient key={item.key} id={gradientId(item.key)} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={`var(--color-${item.key})`} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={`var(--color-${item.key})`} stopOpacity={0.02} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" />
                    <YAxis
                        orientation={isRtl ? 'right' : 'left'}
                        domain={compactAxis ? [0, 'auto'] : [0, Math.ceil(peak * 1.2)]}
                        tickLine={false}
                        axisLine={false}
                        width={compactAxis ? 48 : 36}
                        allowDecimals={false}
                        tickFormatter={(value) => (compactAxis ? compact.format(value) : formatNumber(value))}
                    />
                    <ChartTooltip
                        cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                        content={
                            <ChartTooltipContent
                                dir={dir}
                                indicator="line"
                                valueFormatter={valueFormatter ?? formatNumber}
                                labelFormatter={(_, payload) => longMonth(payload[0].payload.month)}
                            />
                        }
                    />
                    {[...series].reverse().map((item, index) => {
                        const isFirst = index === series.length - 1;

                        return (
                            <Area
                                key={item.key}
                                dataKey={item.key}
                                type="monotone"
                                stroke={`var(--color-${item.key})`}
                                strokeWidth={isFirst ? 2.5 : 2}
                                fill={`url(#${gradientId(item.key)})`}
                                dot={isFirst ? { r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: `var(--color-${item.key})` } : false}
                                activeDot={{ r: isFirst ? 5 : 4, strokeWidth: 2, stroke: 'var(--card)' }}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </AreaChart>
            </ChartContainer>
        </div>
    );
}
