import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';

function TrendBadge({ change }) {
    if (change === null) {
        return <Badge variant="outline">No prior data</Badge>;
    }

    const isDecline = change < 0;
    const Icon = isDecline ? TrendingDownIcon : TrendingUpIcon;

    return (
        <Badge variant={isDecline ? 'destructive' : 'secondary'}>
            <Icon data-icon="inline-start" />
            {change > 0 ? '+' : ''}
            {change}%
        </Badge>
    );
}

export default function StatCards({ stats, days }) {
    const cards = [
        {
            title: 'Total users',
            value: stats.totalUsers,
            footer: 'All registered accounts',
        },
        {
            title: `New users (${days} days)`,
            value: stats.newUsers.value,
            action: <TrendBadge change={stats.newUsers.change} />,
            footer: `${formatNumber(stats.newUsers.previous)} in the previous ${days} days`,
        },
        {
            title: 'Verified users',
            value: stats.verifiedUsers.value,
            action: stats.verifiedUsers.rate !== null && (
                <Badge variant="secondary">{stats.verifiedUsers.rate}%</Badge>
            ),
            footer: 'Email address confirmed',
        },
        {
            title: 'Unverified users',
            value: stats.unverifiedUsers,
            footer: 'Awaiting email verification',
        },
    ];

    return (
        <section
            aria-label="Key statistics"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader>
                        <CardDescription>{card.title}</CardDescription>
                        <CardTitle className="text-3xl font-semibold tabular-nums">
                            {formatNumber(card.value)}
                        </CardTitle>
                        {card.action && <CardAction>{card.action}</CardAction>}
                    </CardHeader>
                    <CardFooter className="mt-auto text-sm text-muted-foreground">
                        {card.footer}
                    </CardFooter>
                </Card>
            ))}
        </section>
    );
}
