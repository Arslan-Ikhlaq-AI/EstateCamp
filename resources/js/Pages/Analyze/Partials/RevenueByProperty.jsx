import { ChartLegend } from '@/Components/ReportCharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { NameTick, RoundedBar, SOURCE_COLORS, SOURCES, useCompactNumber } from './chartParts';

/**
 * Properties shown before "Show all".
 */
const SHOWN = 8;

/**
 * Each property's revenue as a bar, highest first, split by where the
 * money came from, with its total at the tip.
 */
export default function RevenueByProperty({ properties, totals, currency }) {
    const { t, dir, isRtl, formatCurrency, formatMoney } = useTranslation();
    const compact = useCompactNumber();
    const isMobile = useIsMobile();
    const [isExpanded, setIsExpanded] = useState(false);
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const shown = isExpanded ? properties : properties.slice(0, SHOWN);
    const data = shown.map((property) => ({
        name: property.name,
        revenue: property.revenue,
        ...property.sources,
        endKey: [...SOURCES].reverse().find((source) => property.sources[source] > 0),
    }));
    const config = Object.fromEntries(SOURCES.map((source) => [source, { label: t(`analyze.sources.${source}`), color: SOURCE_COLORS[source] }]));
    const endSide = isRtl ? 'left' : 'right';

    const renderTotal = ({ x, y, width, height, index }) => {
        const tip = isRtl ? Math.min(x, x + width) - 8 : Math.max(x, x + width) + 8;

        return (
            <text x={tip} y={y + height / 2} dy={4} textAnchor={isRtl ? 'end' : 'start'} className="fill-foreground text-xs font-semibold tabular-nums">
                {compact.format(data[index].revenue)}
            </text>
        );
    };

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('analyze.byProperty.title')}</CardTitle>
                <CardDescription>{t('analyze.byProperty.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <ChartLegend series={SOURCES.map((source) => ({ key: source, label: config[source].label, color: SOURCE_COLORS[source], total: formatCurrency(totals.sources[source], currency) }))} />

                <ChartContainer config={config} dir="ltr" className="aspect-auto w-full" style={{ height: data.length * 44 + 16 }} initialDimension={{ width: 640, height: data.length * 44 + 16 }}>
                    <BarChart accessibilityLayer data={data} layout="vertical" margin={{ top: 0, bottom: 0, left: isRtl ? 56 : 4, right: isRtl ? 4 : 56 }} barSize={20}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" reversed={isRtl} hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            orientation={isRtl ? 'right' : 'left'}
                            tickLine={false}
                            axisLine={false}
                            width={isMobile ? 96 : 150}
                            tick={<NameTick anchor={isRtl ? 'start' : 'end'} maxLength={isMobile ? 13 : 22} />}
                        />
                        <ChartTooltip
                            cursor={{ fill: 'var(--muted)', opacity: 0.7 }}
                            content={
                                <ChartTooltipContent
                                    dir={dir}
                                    indicator="line"
                                    valueFormatter={(value) => formatMoney(value, currency)}
                                    labelFormatter={(_, payload) => payload[0]?.payload.name}
                                />
                            }
                        />
                        {SOURCES.map((source, index) => (
                            <Bar
                                key={source}
                                dataKey={source}
                                stackId="revenue"
                                fill={`var(--color-${source})`}
                                isAnimationActive={isAnimated}
                                shape={(props) => <RoundedBar {...props} side={props.payload.endKey === source ? endSide : null} />}
                            >
                                {index === SOURCES.length - 1 && <LabelList dataKey="revenue" content={renderTotal} />}
                            </Bar>
                        ))}
                    </BarChart>
                </ChartContainer>

                {properties.length > SHOWN && (
                    <Button variant="ghost" size="sm" className="self-center" onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? t('analyze.byProperty.showFewer') : t('analyze.byProperty.showAll', { count: properties.length })}
                        {isExpanded ? <ChevronUpIcon data-icon="inline-end" /> : <ChevronDownIcon data-icon="inline-end" />}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
