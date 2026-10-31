import ChangeBadge from '@/Components/ChangeBadge';
import { ChartLegend } from '@/Components/ReportCharts';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ChartColumnStackedIcon, Grid3x3Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ColumnSegment, SOURCE_COLORS, SOURCES, SourcesTooltip, useCompactNumber, useTimelineLabels } from './chartParts';

/**
 * The heatmap's sequential scale: one hue, from a wash of the brand blue to
 * its deepest step (lighter on the dark theme, where more reads brighter),
 * with nothing at all in the muted grey.
 */
const LEVELS = [
    'var(--muted)',
    'color-mix(in oklab, var(--chart-1) 28%, var(--card))',
    'color-mix(in oklab, var(--chart-1) 46%, var(--card))',
    'color-mix(in oklab, var(--chart-1) 64%, var(--card))',
    'color-mix(in oklab, var(--chart-1) 84%, var(--card))',
    'var(--chart-4)',
];

const levelOf = (value, peak) => (value <= 0 || peak <= 0 ? 0 : Math.min(LEVELS.length - 1, Math.ceil((value / peak) * (LEVELS.length - 1))));

/**
 * One property's revenue along the timeline as small stacked columns over
 * faint tracks, on the scale every property shares (`peak`) so their
 * heights compare, with
 * what each source brought in the period beneath. `onFocus` shows the
 * property in the chart at the top of the page.
 */
function PropertyColumns({ property, rank, timeline, by, peak, previousLabel, currency, isFocused, onFocus }) {
    const { t, isRtl, formatCurrency } = useTranslation();
    const { short, long } = useTimelineLabels(by, timeline);
    const compact = useCompactNumber();
    const data = timeline.map((step, index) => ({
        ...step,
        label: short(step),
        ...property.sourceTimeline[index],
        total: property.timeline[index],
        previous: property.previousTimeline?.[index] ?? null,
    }));
    const config = Object.fromEntries(SOURCES.map((source) => [source, { label: t(`analyze.sources.${source}`), color: SOURCE_COLORS[source] }]));

    return (
        <li className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow', isFocused && 'border-brand-cyan/50 ring-3 ring-brand-cyan/15')}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                    <span dir="auto" className="truncate font-medium">
                        {property.name}
                    </span>
                    <span dir="auto" className="truncate text-xs text-muted-foreground">
                        {[property.code, property.place].filter(Boolean).join(' · ')}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t('analyze.columns.show', { name: property.name })}
                                    aria-pressed={isFocused}
                                    className="text-muted-foreground aria-pressed:bg-brand-cyan/10 aria-pressed:text-brand-ink"
                                    onClick={() => onFocus(property.id)}
                                />
                            }
                        >
                            <ChartColumnStackedIcon />
                        </TooltipTrigger>
                        <TooltipContent>{t('analyze.columns.showHint')}</TooltipContent>
                    </Tooltip>
                    <span
                        className={cn(
                            'flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums',
                            rank === 1 && property.revenue > 0 ? 'bg-gold/20 text-gold-ink inset-ring inset-ring-gold/40' : 'bg-muted text-muted-foreground',
                        )}
                    >
                        {rank}
                    </span>
                </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-lg font-bold tracking-tight">{formatCurrency(property.revenue, currency)}</span>
                {property.previous && <ChangeBadge compact current={property.revenue} previous={property.previous.revenue} previousLabel={previousLabel} />}
            </div>
            <div className="relative">
                <ChartContainer config={config} dir="ltr" className="aspect-auto h-24 w-full" initialDimension={{ width: 280, height: 96 }}>
                    <BarChart data={data} margin={{ top: 2, left: 0, right: 0, bottom: 0 }} barCategoryGap="16%" maxBarSize={by === 'month' ? 30 : 16}>
                        <XAxis dataKey="label" reversed={isRtl} hide />
                        <YAxis domain={[0, peak]} hide />
                        <ChartTooltip cursor={{ fill: 'var(--muted)', radius: 4 }} content={<SourcesTooltip long={long} currency={currency} />} />
                        {SOURCES.map((source, index) => (
                            <Bar
                                key={source}
                                dataKey={source}
                                stackId="revenue"
                                fill={`var(--color-${source})`}
                                shape={<ColumnSegment radius={4} gap={2} />}
                                background={index === 0 && { fill: 'color-mix(in oklab, var(--muted) 80%, transparent)', radius: 4 }}
                                isAnimationActive={false}
                            />
                        ))}
                    </BarChart>
                </ChartContainer>
                {property.revenue === 0 && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground">
                        {t('analyze.columns.empty')}
                    </p>
                )}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
                {SOURCES.map((source) => (
                    <li key={source} title={config[source].label} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] }} />
                        <span className="sr-only">{config[source].label}</span>
                        <span className={cn('tabular-nums', property.sources[source] > 0 ? 'font-medium' : 'text-muted-foreground')}>{compact.format(property.sources[source])}</span>
                    </li>
                ))}
            </ul>
        </li>
    );
}

/**
 * Every property's revenue on every step of the timeline as a grid of
 * squares, darker for more. Pointing at a square reads it out above the
 * grid; the ranking table below carries the same figures.
 */
function Heatmap({ properties, timeline, by, peak, currency }) {
    const { t, formatMoney, formatPercent } = useTranslation();
    const { short, long } = useTimelineLabels(by, timeline);
    const [pointed, setPointed] = useState(null);
    const labelEvery = Math.max(1, Math.ceil(timeline.length / 12));
    const columns = { gridTemplateColumns: `minmax(8rem, 13rem) repeat(${timeline.length}, minmax(1.5rem, 1fr))` };
    const readout = (property, index) => {
        const value = property.timeline[index];
        const share = property.revenue > 0 ? ` (${t('analyze.properties.ofPeriod', { percent: formatPercent((value / property.revenue) * 100) })})` : '';

        return `${property.name} · ${long(timeline[index])} · ${formatMoney(value, currency)}${share}`;
    };

    return (
        <div className="flex flex-col gap-4">
            <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
                {pointed ? <span className="font-medium text-foreground">{readout(pointed.property, pointed.index)}</span> : t('analyze.properties.pointAt')}
            </p>

            <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="grid min-w-max gap-[2px]" style={columns}>
                    <span />
                    {timeline.map((step, index) => (
                        <span key={step.from} className="h-5 overflow-visible text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                            {index % labelEvery === 0 ? short(step) : ''}
                        </span>
                    ))}

                    {properties.map((property) => (
                        <div key={property.id} className="contents">
                            <span dir="auto" className="sticky start-0 z-10 truncate bg-card pe-3 text-sm leading-7">
                                {property.name}
                            </span>
                            {timeline.map((step, index) => (
                                <span
                                    key={step.from}
                                    title={readout(property, index)}
                                    onPointerEnter={() => setPointed({ property, index })}
                                    onPointerLeave={() => setPointed(null)}
                                    className="h-7 rounded-[4px] transition-shadow hover:ring-2 hover:ring-foreground/40"
                                    style={{ backgroundColor: LEVELS[levelOf(property.timeline[index], peak)] }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    {t('analyze.properties.less')}
                    {LEVELS.slice(1).map((color) => (
                        <span key={color} aria-hidden="true" className="size-3.5 rounded-[3px]" style={{ backgroundColor: color }} />
                    ))}
                    {t('analyze.properties.more')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-3.5 rounded-[3px]" style={{ backgroundColor: LEVELS[0] }} />
                    {t('analyze.properties.none')}
                </span>
            </div>
        </div>
    );
}

/**
 * Each property's revenue along the timeline, as small stacked column
 * charts on one shared scale or as a heatmap. `focus` is the property the
 * chart at the top shows, which a chart's button changes (`onFocus`).
 */
export default function PropertyTrends({ properties, totals, timeline, by, previousLabel, currency, focus, onFocus }) {
    const { t, formatCurrency } = useTranslation();
    const [view, setView] = useState('charts');
    const peak = useMemo(() => Math.max(0, ...properties.flatMap((property) => property.timeline)), [properties]);

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('analyze.properties.title')}</CardTitle>
                <CardDescription>{t('analyze.properties.description')}</CardDescription>
                <CardAction>
                    <ToggleGroup variant="outline" size="sm" spacing={0} value={[view]} onValueChange={([value]) => value && setView(value)}>
                        <ToggleGroupItem value="charts" className="gap-1.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                            <ChartColumnStackedIcon data-icon="inline-start" />
                            <span className="hidden sm:inline">{t('analyze.properties.charts')}</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem value="heatmap" className="gap-1.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                            <Grid3x3Icon data-icon="inline-start" />
                            <span className="hidden sm:inline">{t('analyze.properties.heatmap')}</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </CardAction>
            </CardHeader>
            <CardContent>
                {view === 'charts' ? (
                    <div className="flex flex-col gap-5">
                        <ChartLegend
                            series={SOURCES.map((source) => ({
                                key: source,
                                label: t(`analyze.sources.${source}`),
                                color: SOURCE_COLORS[source],
                                total: formatCurrency(totals.sources[source], currency),
                            }))}
                        />
                        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {properties.map((property, index) => (
                                <PropertyColumns
                                    key={property.id}
                                    property={property}
                                    rank={index + 1}
                                    timeline={timeline}
                                    by={by}
                                    peak={Math.max(peak, 1)}
                                    previousLabel={previousLabel}
                                    currency={currency}
                                    isFocused={String(property.id) === focus}
                                    onFocus={onFocus}
                                />
                            ))}
                        </ul>
                    </div>
                ) : (
                    <Heatmap properties={properties} timeline={timeline} by={by} peak={peak} currency={currency} />
                )}
            </CardContent>
        </Card>
    );
}
