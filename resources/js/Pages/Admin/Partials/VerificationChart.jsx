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
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { formatNumber } from '@/lib/format';
import { UsersIcon } from 'lucide-react';
import { Label, Pie, PieChart } from 'recharts';

const chartConfig = {
    users: {
        label: 'Users',
    },
    verified: {
        label: 'Verified',
        color: 'var(--chart-4)',
    },
    unverified: {
        label: 'Unverified',
        color: 'var(--chart-2)',
    },
};

export default function VerificationChart({ verification, className }) {
    const total = verification.reduce((sum, item) => sum + item.users, 0);

    const data = verification.map((item) => ({
        ...item,
        fill: `var(--color-${item.status})`,
    }));

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Verification</CardTitle>
                <CardDescription>
                    Email verification across all users
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 items-center">
                {total === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <UsersIcon />
                            </EmptyMedia>
                            <EmptyTitle>No users yet</EmptyTitle>
                            <EmptyDescription>
                                The breakdown appears once people sign up.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-64 w-full"
                    >
                        <PieChart accessibilityLayer>
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        hideLabel
                                        nameKey="status"
                                    />
                                }
                            />
                            <Pie
                                data={data}
                                dataKey="users"
                                nameKey="status"
                                innerRadius="68%"
                                cornerRadius={4}
                                stroke="var(--card)"
                                strokeWidth={2}
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (!viewBox || !('cx' in viewBox)) {
                                            return null;
                                        }

                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-semibold tracking-tight"
                                                >
                                                    {formatNumber(total)}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    {total === 1
                                                        ? 'User'
                                                        : 'Users'}
                                                </tspan>
                                            </text>
                                        );
                                    }}
                                />
                            </Pie>
                            <ChartLegend
                                content={<ChartLegendContent nameKey="status" />}
                            />
                        </PieChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
