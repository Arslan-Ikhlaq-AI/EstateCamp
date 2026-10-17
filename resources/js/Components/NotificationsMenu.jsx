import NotificationItem from '@/Components/NotificationItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { Link, usePage } from '@inertiajs/react';
import { BellIcon, CircleCheckIcon } from 'lucide-react';

export default function NotificationsMenu() {
    const { t } = useTranslation();
    const notifications = usePage().props.notifications ?? [];
    const count = notifications.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative"
                        aria-label={`${t('header.notifications')}: ${t('header.notificationsCount', { count })}`}
                    />
                }
            >
                <BellIcon />
                {count > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold text-white ring-2 ring-background"
                    >
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="font-heading text-sm font-semibold">
                        {t('header.notifications')}
                    </span>
                    {count > 0 && <Badge variant="secondary">{count}</Badge>}
                </div>

                <DropdownMenuSeparator className="my-0" />

                {count === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <CircleCheckIcon className="size-6 text-success" />
                        <p className="text-sm font-medium">
                            {t('header.allCaughtUp')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {t('header.allCaughtUpDescription')}
                        </p>
                    </div>
                ) : (
                    <DropdownMenuGroup className="max-h-96 overflow-y-auto p-1">
                        {notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className="p-2"
                                render={<Link href={notification.url} />}
                            >
                                <NotificationItem notification={notification} />
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
