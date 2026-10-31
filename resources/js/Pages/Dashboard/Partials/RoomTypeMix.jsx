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
import { useTranslation } from '@/hooks/use-translation';
import { useMemo } from 'react';
import { Pie, PieChart } from 'recharts';

/**
 * Categorical slots validated for three series (every pair, both themes);
 * any further room types fold into one grey "Other" slice.
 */
const SLOTS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'];
const OTHER = 'var(--chart-3)';

/**
 * How the portfolio's rooms split across room types, with each type's
 * occupancy beside it.
 */
export default function RoomTypeMix({ roomTypes, className }) {
    const { t, tOr, dir, formatNumber, formatPercent } = useTranslation();
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const named = roomTypes.slice(0, SLOTS.length).map((roomType, index) => ({
        key: roomType.slug,
        label: tOr(`roomTypes.${roomType.slug}`, roomType.name),
        rooms: roomType.roomOccupancy,
        color: SLOTS[index],
    }));
    const rest = roomTypes.slice(SLOTS.length);
    const slices = rest.length
        ? [
              ...named,
              {
                  key: 'other',
                  label: t('dashboard.roomMix.other'),
                  color: OTHER,
                  rooms: rest.reduce(
                      (sum, roomType) => ({
                          total: sum.total + roomType.roomOccupancy.total,
                          occupied: sum.occupied + roomType.roomOccupancy.occupied,
                          available: sum.available + roomType.roomOccupancy.available,
                      }),
                      { total: 0, occupied: 0, available: 0 },
                  ),
              },
          ]
        : named;

    const total = slices.reduce((sum, slice) => sum + slice.rooms.total, 0);
    const config = Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.label, color: slice.color }]));
    const data = slices.map((slice) => ({ key: slice.key, value: slice.rooms.total, fill: slice.color }));
    const occupancy = ({ occupied, available }) => (occupied + available > 0 ? (occupied / (occupied + available)) * 100 : null);

    if (total === 0) {
        return null;
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.roomMix.title')}</CardTitle>
                <CardDescription>{t('dashboard.roomMix.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
                <div className="relative size-40 shrink-0">
                    <ChartContainer config={config} className="aspect-square size-40" initialDimension={{ width: 160, height: 160 }}>
                        <PieChart accessibilityLayer>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent dir={dir} hideLabel nameKey="key" valueFormatter={(value) => `${formatNumber(value)} ${t('dashboard.roomMix.rooms')}`} />}
                            />
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="key"
                                innerRadius="66%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                                cornerRadius={4}
                                stroke="var(--card)"
                                strokeWidth={2}
                                isAnimationActive={isAnimated}
                            />
                        </PieChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-heading text-2xl font-bold tracking-tight">{formatNumber(total)}</span>
                        <span className="text-xs text-muted-foreground">{t('dashboard.roomMix.rooms')}</span>
                    </div>
                </div>

                <ul className="flex w-full flex-col gap-2.5">
                    {slices.map((slice) => {
                        const rate = occupancy(slice.rooms);

                        return (
                            <li key={slice.key} className="flex items-center gap-3 text-sm">
                                <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ backgroundColor: slice.color }} />
                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span className="truncate font-medium">{slice.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {rate === null ? '—' : t('dashboard.roomMix.occupied', { percent: formatPercent(rate) })}
                                    </span>
                                </span>
                                <span className="font-semibold tabular-nums">{formatNumber(slice.rooms.total)}</span>
                                <span className="w-11 text-end text-xs text-muted-foreground tabular-nums">
                                    {formatPercent((slice.rooms.total / total) * 100)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}
