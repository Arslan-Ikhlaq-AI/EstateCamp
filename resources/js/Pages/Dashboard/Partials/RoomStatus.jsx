import { ROOM_SEGMENTS } from '@/Components/RoomBar';
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
import { DoorOpenIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Pie, PieChart } from 'recharts';

const COLORS = {
    occupied: 'var(--chart-1)',
    available: 'var(--chart-2)',
    outOfService: 'var(--chart-3)',
};

/**
 * Every room by state as a donut, with the occupied count in the middle and
 * each state's count and share beside its swatch.
 */
export default function RoomStatus({ rooms, className }) {
    const { t, dir, formatNumber, formatPercent } = useTranslation();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const config = Object.fromEntries(
        ROOM_SEGMENTS.map(({ key }) => [key, { label: t(`dashboard.roomStates.${key}`), color: COLORS[key] }]),
    );
    const segments = ROOM_SEGMENTS.filter(({ key }) => rooms[key] > 0).map(({ key }) => ({
        key,
        value: rooms[key],
        fill: `var(--color-${key})`,
    }));

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.roomStatus.title')}</CardTitle>
                <CardDescription>{t('dashboard.roomStatus.description')}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
                {rooms.total === 0 ? (
                    <Empty className="p-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <DoorOpenIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.roomStatus.empty')}</EmptyTitle>
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
                                <span className="font-heading text-3xl font-semibold tracking-tight">{formatNumber(rooms.occupied)}</span>
                                <span className="max-w-28 text-xs text-muted-foreground">
                                    {t('dashboard.roomStatus.centerLabel', { count: rooms.total })}
                                </span>
                            </div>
                        </div>

                        <ul className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/[0.07]">
                            {ROOM_SEGMENTS.map(({ key, swatch }) => (
                                <li key={key} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                                    <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', swatch)} />
                                    <span className="flex-1 text-muted-foreground">{t(`dashboard.roomStates.${key}`)}</span>
                                    <span className="font-medium tabular-nums">{formatNumber(rooms[key])}</span>
                                    <span className="w-12 text-end text-xs text-muted-foreground tabular-nums">
                                        {formatPercent((rooms[key] / rooms.total) * 100)}
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
