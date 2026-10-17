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
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Link, usePage } from '@inertiajs/react';
import { CircleCheckIcon } from 'lucide-react';

export default function AttentionCard({ className }) {
    const { t } = useTranslation();
    const notifications = usePage().props.notifications ?? [];

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.attention.title')}</CardTitle>
                <CardDescription>{t('dashboard.attention.description')}</CardDescription>
                {notifications.length > 0 && (
                    <CardAction>
                        <Badge variant="warning" className="tabular-nums">{notifications.length}</Badge>
                    </CardAction>
                )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
                {notifications.length === 0 ? (
                    <Empty className="p-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <CircleCheckIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.attention.empty')}</EmptyTitle>
                            <EmptyDescription>{t('dashboard.attention.emptyDescription')}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ul className="-mx-2 flex max-h-[26rem] flex-col gap-0.5 overflow-y-auto">
                        {notifications.map((notification) => (
                            <li key={notification.id}>
                                <Link
                                    href={notification.url}
                                    className="block rounded-lg p-2 outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <NotificationItem notification={notification} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
