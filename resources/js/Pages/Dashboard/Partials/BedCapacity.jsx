import { BED_SEGMENTS } from '@/Components/BedBar';
import {
    Card,
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
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BedDoubleIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Pie, PieChart } from 'recharts';

const COLORS = {
    occupied: 'var(--chart-1)',
    available: 'var(--chart-2)',
    outOfService: 'var(--chart-3)',
};

/**
 * Every bed by status as a donut, with the occupied count in the middle and
 * each status's count and share beside its swatch.
 */
export default function BedCapacity({ beds, className }) {
    const { t, dir, formatNumber, formatPercent } = useTranslation();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const config = Object.fromEntries(
        BED_SEGMENTS.map(({ key }) => [key, { label: t(`dashboard.beds.${key}`), color: COLORS[key] }]),
    );
    const segments = BED_SEGMENTS.filter(({ key }) => beds[key] > 0).map(({ key }) => ({
        key,
        value: beds[key],
        fill: `var(--color-${key})`,
    }));

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.bedStatus.title')}</CardTitle>
                <CardDescription>{t('dashboard.bedStatus.description')}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
                {beds.total === 0 ? (
                    <Empty className="p-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <BedDoubleIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.bedStatus.empty')}</EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <div className="relative mx-auto w-full max-w-52">
                            <ChartContainer config={config} className="aspect-square w-full" initialDimension={{ width: 208, height: 208 }}>
                                <PieChart accessibilityLayer>
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent dir={dir} hideLabel nameKey="key" valueFormatter={formatNumber} />}
                                    />
                                    <Pie
                                        data={segments}
                                        dataKey="value"
                                        nameKey="key"
                                        innerRadius="72%"
                                        outerRadius="100%"
                                        startAngle={90}
                                        endAngle={-270}
                                        cornerRadius={4}
                                        stroke="var(--card)"
                                        strokeWidth={2}
                                        isAnimationActive={isAnimated}
                                        animationDuration={700}
                                    />
                                </PieChart>
                            </ChartContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="font-heading text-3xl font-semibold tracking-tight">{formatNumber(beds.occupied)}</span>
                                <span className="max-w-28 text-xs text-muted-foreground">
                                    {t('dashboard.bedStatus.centerLabel', { count: beds.total })}
                                </span>
                            </div>
                        </div>

                        <ul className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/[0.07]">
                            {BED_SEGMENTS.map(({ key, swatch }) => (
                                <li key={key} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                                    <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', swatch)} />
                                    <span className="flex-1 text-muted-foreground">{t(`dashboard.beds.${key}`)}</span>
                                    <span className="font-medium tabular-nums">{formatNumber(beds[key])}</span>
                                    <span className="w-12 text-end text-xs text-muted-foreground tabular-nums">
                                        {formatPercent((beds[key] / beds.total) * 100)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
