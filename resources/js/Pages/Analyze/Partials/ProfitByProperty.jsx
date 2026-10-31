import { ChartLegend } from '@/Components/ReportCharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';
import { NameTick, RoundedBar, TooltipBox, useCompactNumber } from './chartParts';

/**
 * Profit and loss pull apart from zero in the two poles of the diverging
 * pair: the brand blue and red.
 */
const PROFIT = 'var(--chart-1)';
const LOSS = 'var(--chart-loss)';

function ProfitTooltip({ active, payload, currency }) {
    const { t, formatMoney } = useTranslation();

    if (!active || !payload?.length) {
        return null;
    }

    const row = payload[0].payload;

    return (
        <TooltipBox
            title={row.name}
            rows={[
                { key: 'revenue', label: t('analyze.ranking.revenue'), value: formatMoney(row.revenue, currency) },
                { key: 'expenses', label: t('analyze.ranking.expenses'), value: formatMoney(row.expenses, currency) },
                { key: 'net', color: row.net < 0 ? LOSS : PROFIT, label: row.net < 0 ? t('analyze.profit.loss') : t('analyze.profit.profit'), value: formatMoney(row.net, currency) },
            ]}
        />
    );
}

/**
 * What each property kept after its expenses, highest first, losses
 * running the other way from zero. Properties with no money in or out are
 * left out.
 */
export default function ProfitByProperty({ properties, currency }) {
    const { t, isRtl, formatCurrency } = useTranslation();
    const compact = useCompactNumber();
    const isMobile = useIsMobile();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const data = properties
        .filter((property) => property.revenue !== 0 || property.expenses !== 0)
        .map((property) => ({ name: property.name, revenue: property.revenue, expenses: property.expenses, net: property.net }))
        .sort((a, b) => b.net - a.net);
    const profit = data.filter((row) => row.net > 0).reduce((sum, row) => sum + row.net, 0);
    const loss = data.filter((row) => row.net < 0).reduce((sum, row) => sum + row.net, 0);
    const highest = Math.max(0, ...data.map((row) => row.net));
    const lowest = Math.min(0, ...data.map((row) => row.net));
    // Room past each end of the scale for the figure at a bar's tip, which would otherwise run off the chart or into the names; a phone's narrow chart needs more of it.
    const room = Math.max((highest - lowest) * (isMobile ? 0.5 : 0.24), 1);
    // A gain runs towards the end of the line, a loss towards its start; right to left flips both.
    const sideOf = (net) => ((net >= 0) !== isRtl ? 'right' : 'left');

    const renderNet = ({ x, y, width, height, index }) => {
        const side = sideOf(data[index].net);
        const tip = side === 'right' ? Math.max(x, x + width) + 8 : Math.min(x, x + width) - 8;

        return (
            <text x={tip} y={y + height / 2} dy={4} textAnchor={side === 'right' ? 'start' : 'end'} className="fill-foreground text-xs font-semibold tabular-nums">
                {compact.format(data[index].net)}
            </text>
        );
    };

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{t('analyze.profit.title')}</CardTitle>
                <CardDescription>{t('analyze.profit.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <ChartLegend
                    series={[
                        { key: 'profit', label: t('analyze.profit.profit'), color: PROFIT, total: formatCurrency(profit, currency) },
                        { key: 'loss', label: t('analyze.profit.loss'), color: LOSS, total: formatCurrency(loss, currency) },
                    ]}
                />

                {data.length > 0 && (
                    <ChartContainer config={{ net: { label: t('analyze.ranking.net') } }} dir="ltr" className="aspect-auto w-full" style={{ height: data.length * 44 + 16 }} initialDimension={{ width: 640, height: data.length * 44 + 16 }}>
                        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ top: 0, bottom: 0, left: 8, right: 8 }} barSize={20}>
                            <CartesianGrid horizontal={false} />
                            <XAxis type="number" reversed={isRtl} hide domain={[lowest < 0 ? lowest - room : 0, highest + room]} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                orientation={isRtl ? 'right' : 'left'}
                                tickLine={false}
                                axisLine={false}
                                width={isMobile ? 96 : 150}
                                tick={<NameTick anchor={isRtl ? 'start' : 'end'} maxLength={isMobile ? 13 : 22} />}
                            />
                            <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.7 }} content={<ProfitTooltip currency={currency} />} />
                            <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                            <Bar
                                dataKey="net"
                                isAnimationActive={isAnimated}
                                shape={(props) => <RoundedBar {...props} fill={props.payload.net < 0 ? LOSS : PROFIT} side={sideOf(props.payload.net)} />}
                            >
                                <LabelList dataKey="net" content={renderNet} />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
