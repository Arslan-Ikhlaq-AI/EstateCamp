import { Button } from '@/components/ui/button';
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
import { Link } from '@inertiajs/react';
import { ArrowRightIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

/**
 * Collected is the series the story is about, in the strong brand blue;
 * invoiced is its context, a paler step of the same hue.
 */
const SERIES = {
    invoiced: 'var(--chart-context)',
    collected: 'var(--chart-1)',
};

function Total({ color, label, value }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                {color && <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: color }} />}
                {label}
            </span>
            <span className="text-lg font-bold tracking-tight">{value}</span>
        </div>
    );
}

/**
 * Six months of money invoiced and money collected, from the server's
 * monthly totals.
 */
export default function CollectionsChart({ trend, currency, className }) {
    const { t, locale, dir, isRtl, formatCurrency, formatMoney, formatPercent } = useTranslation();
    const intl = LOCALES[locale].intl;
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const monthFormat = new Intl.DateTimeFormat(intl, { month: 'short' });
    const fullMonthFormat = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' });
    const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });
    const toDate = (month) => new Date(`${month}-01T00:00:00`);

    const data = trend.map((point) => ({ ...point, label: monthFormat.format(toDate(point.month)) }));
    const invoiced = trend.reduce((sum, point) => sum + point.invoiced, 0);
    const collected = trend.reduce((sum, point) => sum + point.collected, 0);
    const config = {
        invoiced: { label: t('dashboard.collections.invoiced'), color: SERIES.invoiced },
        collected: { label: t('dashboard.collections.collected'), color: SERIES.collected },
    };

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.collections.title')}</CardTitle>
                <CardDescription>{t('dashboard.collections.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('payments.index')} />}>
                        {t('nav.paymentsReceived')}
                        <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-5">
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <Total color={SERIES.collected} label={config.collected.label} value={formatCurrency(collected, currency)} />
                    <Total color={SERIES.invoiced} label={config.invoiced.label} value={formatCurrency(invoiced, currency)} />
                    <Total label={t('dashboard.collections.rate')} value={invoiced > 0 ? formatPercent((collected / invoiced) * 100) : '—'} />
                </div>

                <ChartContainer
                    config={config}
                    dir="ltr"
                    className="aspect-auto h-64 w-full flex-1"
                    initialDimension={{ width: 640, height: 256 }}
                >
                    <AreaChart accessibilityLayer data={data} margin={{ top: 8, left: 4, right: 4, bottom: 0 }}>
                        <defs>
                            <linearGradient id="collections-collected" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-collected)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--color-collected)" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="collections-invoiced" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-invoiced)" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="var(--color-invoiced)" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={10} />
                        <YAxis
                            orientation={isRtl ? 'right' : 'left'}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            tickFormatter={(value) => compact.format(value)}
                        />
                        <ChartTooltip
                            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                            content={
                                <ChartTooltipContent
                                    dir={dir}
                                    indicator="line"
                                    valueFormatter={(value) => formatMoney(value, currency)}
                                    labelFormatter={(_, payload) => fullMonthFormat.format(toDate(payload[0].payload.month))}
                                />
                            }
                        />
                        <Area
                            dataKey="invoiced"
                            type="monotone"
                            stroke="var(--color-invoiced)"
                            strokeWidth={2}
                            fill="url(#collections-invoiced)"
                            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                            isAnimationActive={isAnimated}
                        />
                        <Area
                            dataKey="collected"
                            type="monotone"
                            stroke="var(--color-collected)"
                            strokeWidth={2.5}
                            fill="url(#collections-collected)"
                            dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--color-collected)' }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                            isAnimationActive={isAnimated}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
