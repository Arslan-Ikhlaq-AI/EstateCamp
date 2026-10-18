import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

/**
 * How many people were staying at the end of each month, from check-in and
 * check-out dates, with today's count and the change over the window.
 */
export default function OccupancyTrend({ trend, className }) {
    const { t, locale, dir, isRtl, formatNumber } = useTranslation();
    const intl = LOCALES[locale].intl;
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const toDate = (month) => new Date(`${month}-01T00:00:00`);
    const monthFormat = new Intl.DateTimeFormat(intl, { month: 'short' });
    const fullMonthFormat = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' });

    const data = trend.map((point) => ({ ...point, label: monthFormat.format(toDate(point.month)) }));
    const first = trend[0];
    const latest = trend[trend.length - 1];
    const change = latest.staying - first.staying;
    const since = fullMonthFormat.format(toDate(first.month));
    const peak = Math.max(...trend.map((point) => point.staying), 1);

    const Trend = change > 0 ? TrendingUpIcon : TrendingDownIcon;
    const changeLabel =
        change === 0
            ? t('dashboard.occupancyTrend.steady', { month: since })
            : t(change > 0 ? 'dashboard.occupancyTrend.up' : 'dashboard.occupancyTrend.down', { count: Math.abs(change), month: since });

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.occupancyTrend.title')}</CardTitle>
                <CardDescription>{t('dashboard.occupancyTrend.description')}</CardDescription>
                {change !== 0 && (
                    <CardAction>
                        <Badge variant={change < 0 ? 'warning' : 'info'} className="h-6">
                            <Trend data-icon="inline-start" />
                            {`${change > 0 ? '+' : '−'}${formatNumber(Math.abs(change))}`}
                        </Badge>
                    </CardAction>
                )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-baseline gap-2">
                    <span className="font-heading text-[2rem] leading-none font-bold tracking-tight">{formatNumber(latest.staying)}</span>
                    <span className="text-[0.875rem] text-muted-foreground">{t('dashboard.occupancyTrend.staying')}</span>
                </div>
                <p className="-mt-2 text-[0.8125rem] text-muted-foreground">{changeLabel}</p>

                <ChartContainer
                    config={{ staying: { label: t('dashboard.occupancyTrend.title'), color: 'var(--chart-1)' } }}
                    dir="ltr"
                    className="aspect-auto h-40 w-full flex-1"
                    initialDimension={{ width: 320, height: 160 }}
                >
                    <AreaChart accessibilityLayer data={data} margin={{ top: 8, left: 0, right: 4, bottom: 0 }}>
                        <defs>
                            <linearGradient id="occupancy-trend-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-staying)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--color-staying)" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis
                            orientation={isRtl ? 'right' : 'left'}
                            domain={[0, Math.ceil(peak * 1.2)]}
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            width={32}
                        />
                        <ChartTooltip
                            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                            content={
                                <ChartTooltipContent
                                    dir={dir}
                                    indicator="line"
                                    valueFormatter={formatNumber}
                                    labelFormatter={(_, payload) => fullMonthFormat.format(toDate(payload[0].payload.month))}
                                />
                            }
                        />
                        <Area
                            dataKey="staying"
                            type="monotone"
                            stroke="var(--color-staying)"
                            strokeWidth={2.5}
                            fill="url(#occupancy-trend-fill)"
                            dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--color-staying)' }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                            isAnimationActive={isAnimated}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
