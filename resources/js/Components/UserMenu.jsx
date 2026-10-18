import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDownIcon, LifeBuoyIcon, LogOutIcon, SettingsIcon } from 'lucide-react';

function UserAvatar({ name, className }) {
    return (
        <Avatar className={cn('size-9', className)}>
            <AvatarFallback className="bg-linear-to-br from-brand-cyan to-brand-navy text-xs font-bold text-white">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

/**
 * The signed-in account in the top bar: avatar, name and role, opening a
 * menu with settings, help and signing out.
 */
export default function UserMenu() {
    const { t } = useTranslation();
    const { user, role } = usePage().props.auth;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <button
                        type="button"
                        aria-label={t('user.accountMenu', { name: user.name })}
                        className="flex items-center gap-2.5 rounded-full p-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted lg:pe-3"
                    />
                }
            >
                <UserAvatar name={user.name} className="ring-2 ring-background" />
                <span className="hidden min-w-0 flex-col text-start leading-tight lg:flex">
                    <span className="max-w-36 truncate text-sm font-semibold">{user.name}</span>
                    <span className="max-w-36 truncate text-xs text-muted-foreground">{role ?? user.email}</span>
                </span>
                <ChevronDownIcon className="hidden size-4 text-muted-foreground lg:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={10} className="w-64">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-3 py-2">
                        <UserAvatar name={user.name} className="size-10" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                            <span className="truncate text-xs">{user.email}</span>
                        </span>
                    </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href={route('profile.edit')} />}>
                        <SettingsIcon />
                        {t('user.settings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('help')} />}>
                        <LifeBuoyIcon />
                        {t('nav.help')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem
                        variant="destructive"
                        nativeButton
                        render={<Link href={route('logout')} method="post" as="button" className="w-full" />}
                    >
                        <LogOutIcon />
                        {t('user.logOut')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
