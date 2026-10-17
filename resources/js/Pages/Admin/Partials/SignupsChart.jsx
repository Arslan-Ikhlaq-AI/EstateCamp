import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { formatMediumDay, formatNumber, formatShortDay } from '@/lib/format';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfig = {
    verified: {
        label: 'Verified',
        color: 'var(--chart-4)',
    },
    unverified: {
        label: 'Unverified',
        color: 'var(--chart-2)',
    },
};

export default function SignupsChart({ signups, days, className }) {
    const total = signups.reduce(
        (sum, day) => sum + day.verified + day.unverified,
        0,
    );

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>New users</CardTitle>
                <CardDescription>
                    {formatNumber(total)} {total === 1 ? 'signup' : 'signups'}{' '}
                    in the last {days} days
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-64 w-full"
                >
                    <AreaChart
                        accessibilityLayer
                        data={signups}
                        margin={{ left: 4, right: 12 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={formatShortDay}
                        />
                        <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            width={28}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    indicator="dot"
                                    labelFormatter={formatMediumDay}
                                />
                            }
                        />
                        <Area
                            dataKey="unverified"
                            type="monotone"
                            stackId="signups"
                            fill="var(--color-unverified)"
                            fillOpacity={0.14}
                            strokeWidth={2}
                            stroke="var(--color-unverified)"
                        />
                        <Area
                            dataKey="verified"
                            type="monotone"
                            stackId="signups"
                            fill="var(--color-verified)"
                            fillOpacity={0.14}
                            strokeWidth={2}
                            stroke="var(--color-verified)"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
