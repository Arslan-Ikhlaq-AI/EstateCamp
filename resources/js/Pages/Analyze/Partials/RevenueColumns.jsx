import ChangeBadge from '@/Components/ChangeBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Building2Icon, ChartColumnStackedIcon, ChevronDownIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { ColumnSegment, SOURCE_COLORS, SOURCE_INKS, SOURCES, SourcesTooltip, useCompactNumber, useTimelineLabels } from './chartParts';

function Figure({ label, value, color, children }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                {color && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: color }} />}
                {label}
            </span>
            <span className="text-lg font-bold tracking-tight tabular-nums">{value}</span>
            {children}
        </div>
    );
}

/**
 * Which revenue the chart shows: every property together or one of them,
 * each with what it earned in the period.
 */
function PropertyPicker({ focus, onChange, properties, totals }) {
    const { t } = useTranslation();
    const compact = useCompactNumber();
    const chosen = properties.find((property) => String(property.id) === focus);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={cn('max-w-full font-semibold', chosen && 'border-brand-cyan/40 bg-brand-cyan/[0.06]')} />}>
                <Building2Icon data-icon="inline-start" className="text-brand-ink" />
                <span dir="auto" className="max-w-52 truncate">
                    {chosen?.name ?? t('analyze.columns.allProperties')}
                </span>
                <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-72">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('analyze.columns.choose')}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={chosen ? focus : 'all'} onValueChange={onChange}>
                        <DropdownMenuRadioItem value="all">
                            <span className="flex-1 font-medium">{t('analyze.columns.allProperties')}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{compact.format(totals.revenue)}</span>
                        </DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        {properties.map((property) => (
                            <DropdownMenuRadioItem key={property.id} value={String(property.id)}>
                                <span dir="auto" className="min-w-0 flex-1 truncate">
                                    {property.name}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">{compact.format(property.revenue)}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Revenue along the timeline as stacked columns, one part for each source
 * (client contracts, short-term rentals, extra income), for every property
 * together or the one chosen (`focus`, a property id or 'all'). Each column
 * carries its total, the best one in gold, and parts big enough their own
 * amount when the column has more than one.
 */
export default function RevenueColumns({ id, timeline, by, totals, properties, focus, onFocusChange, previousLabel, currency }) {
    const { t, dir, isRtl, formatCurrency } = useTranslation();
    const { short, long } = useTimelineLabels(by, timeline);
    const compact = useCompactNumber();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const figures = properties.find((property) => String(property.id) === focus) ?? totals;
    const data = timeline.map((step, index) => ({
        ...step,
        label: short(step),
        ...figures.sourceTimeline[index],
        total: figures.timeline[index],
        previous: figures.previousTimeline?.[index] ?? null,
    }));
    const best = data.reduce((top, step, index) => (step.total > 0 && (top === null || step.total > data[top].total) ? index : top), null);
    const average = data.length > 0 ? figures.revenue / data.length : 0;
    const bucket = t(`analyze.buckets.${by}`);
    const config = Object.fromEntries(SOURCES.map((source) => [source, { label: t(`analyze.sources.${source}`), color: SOURCE_COLORS[source] }]));

    const renderPart = (source) =>
        function PartLabel({ x, y, width, height, value, index }) {
            if (!(value > 0) || value === data[index]?.total || height < 22 || width < 34) {
                return null;
            }

            return (
                <text x={x + width / 2} y={y + height / 2} dy={4} textAnchor="middle" className={cn('text-[0.6875rem] font-semibold tabular-nums', SOURCE_INKS[source])}>
                    {compact.format(value)}
                </text>
            );
        };

    const renderTotal = ({ x, y, width, index }) => {
        const step = data[index];

        if (!step || step.total <= 0 || width < 22) {
            return null;
        }

        return (
            <text x={x + width / 2} y={y - 8} textAnchor="middle" className={cn('text-xs font-bold tabular-nums', index === best ? 'fill-gold-ink' : 'fill-foreground')}>
                {compact.format(step.total)}
            </text>
        );
    };

    return (
        <Card id={id} className="min-w-0 scroll-mt-24 gap-0 py-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-(--card-spacing) py-3.5">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm rtl:bg-linear-to-bl">
                    <ChartColumnStackedIcon className="size-4" />
                </span>
                <h2 className="flex flex-wrap items-center gap-x-1.5 text-[0.9375rem] text-muted-foreground">
                    <span className="font-heading font-semibold text-foreground">{t('analyze.columns.title')}</span>
                    <span>{t(`analyze.columns.by.${by}`)}</span>
                    <span>{t('analyze.columns.for')}</span>
                </h2>
                <PropertyPicker focus={focus} onChange={onFocusChange} properties={properties} totals={totals} />
            </div>

            <div className="flex flex-col gap-6 p-(--card-spacing)">
                <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[0.8125rem] text-muted-foreground">{t('analyze.columns.total')}</span>
                        <span className="font-heading text-3xl font-bold tracking-tight sm:text-[2.25rem] sm:leading-10">{formatCurrency(figures.revenue, currency)}</span>
                        <ChangeBadge current={figures.revenue} previous={figures.previous?.revenue} previousLabel={previousLabel} />
                    </div>
                    {figures.previous && <Figure label={t('analyze.columns.previous')} value={formatCurrency(figures.previous.revenue, currency)} />}
                    <Figure label={t('analyze.columns.average', { bucket })} value={formatCurrency(average, currency)} />
                    {best !== null && (
                        <Figure label={t('analyze.columns.best', { bucket })} value={formatCurrency(data[best].total, currency)} color="var(--gold)">
                            <span className="text-xs text-muted-foreground">{long(data[best])}</span>
                        </Figure>
                    )}
                </div>

                <div className="relative">
                    <ChartContainer config={config} dir="ltr" className="aspect-auto h-80 w-full lg:h-96" initialDimension={{ width: 960, height: 384 }}>
                        <BarChart accessibilityLayer data={data} margin={{ top: 24, left: 4, right: 4, bottom: 0 }} barCategoryGap="18%" maxBarSize={by === 'month' ? 76 : 44}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={10} minTickGap={8} />
                            <YAxis
                                orientation={isRtl ? 'right' : 'left'}
                                tickLine={false}
                                axisLine={false}
                                width={52}
                                allowDecimals={false}
                                tickFormatter={(value) => compact.format(value)}
                            />
                            <ChartTooltip cursor={{ fill: 'var(--muted)', radius: 10 }} content={<SourcesTooltip long={long} currency={currency} />} />
                            {SOURCES.map((source, index) => (
                                <Bar key={source} dataKey={source} stackId="revenue" fill={`var(--color-${source})`} shape={<ColumnSegment />} isAnimationActive={isAnimated}>
                                    <LabelList dataKey={source} content={renderPart(source)} />
                                    {index === SOURCES.length - 1 && <LabelList dataKey="total" content={renderTotal} />}
                                </Bar>
                            ))}
                        </BarChart>
                    </ChartContainer>
                    {figures.revenue === 0 && (
                        <p dir={dir} className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                            {t('analyze.columns.empty')}
                        </p>
                    )}
                </div>

                <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5">
                    {SOURCES.map((source) => (
                        <li key={source} className="flex items-center gap-2 text-sm">
                            <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] }} />
                            <span className="text-muted-foreground">{config[source].label}</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(figures.sources[source], currency)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Card>
    );
}
