import NotificationItem from '@/Components/NotificationItem';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Link, usePage } from '@inertiajs/react';
import { BellRingIcon } from 'lucide-react';

/**
 * What needs acting on now (expiring documents and leases, rooms out of
 * service), as a strip of links near the top of the dashboard. Hidden when
 * nothing needs attention; the header's bell says so instead.
 */
export default function AttentionCard({ className }) {
    const { t, formatNumber } = useTranslation();
    const notifications = usePage().props.notifications ?? [];

    if (notifications.length === 0) {
        return null;
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-warning/12 text-warning">
                        <BellRingIcon className="size-4" />
                    </span>
                    {t('dashboard.attention.title')}
                </CardTitle>
                <CardDescription>{t('dashboard.attention.description')}</CardDescription>
                <CardAction>
                    <Badge variant="warning" className="h-6 px-2.5 tabular-nums">
                        {formatNumber(notifications.length)}
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent>
                <ul className="grid gap-3 sm:grid-cols-2">
                    {notifications.map((notification) => (
                        <li key={notification.id}>
                            <Link
                                href={notification.url}
                                className="block h-full rounded-xl p-3 ring-1 ring-foreground/[0.07] outline-none transition-[background-color,box-shadow] hover:bg-accent hover:ring-brand-cyan/30 focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <NotificationItem notification={notification} />
                            </Link>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
