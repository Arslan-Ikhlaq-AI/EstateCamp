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
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';
import { Link, usePage } from '@inertiajs/react';
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react';

function UserAvatar({ name }) {
    return (
        <Avatar className="size-8 rounded-lg after:rounded-lg">
            <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

/**
 * The signed-in account at the foot of the sidebar, with links to settings
 * and signing out.
 */
export default function UserMenu() {
    const { t } = useTranslation();
    const { isMobile } = useSidebar();
    const { user, role } = usePage().props.auth;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                size="lg"
                                aria-label={t('user.accountMenu', { name: user.name })}
                            />
                        }
                    >
                        <UserAvatar name={user.name} />
                        <span className="grid flex-1 leading-tight">
                            <span className="truncate font-medium text-sidebar-accent-foreground">
                                {user.name}
                            </span>
                            <span className="truncate text-xs">
                                {role ?? user.email}
                            </span>
                        </span>
                        <ChevronsUpDownIcon className="ms-auto" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        side={isMobile ? 'bottom' : 'inline-end'}
                        align="end"
                        sideOffset={8}
                        className="w-60"
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                                <span className="truncate text-sm font-medium text-foreground">
                                    {user.name}
                                </span>
                                <span className="truncate">{user.email}</span>
                            </DropdownMenuLabel>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                render={<Link href={route('profile.edit')} />}
                            >
                                <SettingsIcon />
                                {t('user.settings')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                nativeButton
                                render={
                                    <Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                    />
                                }
                            >
                                <LogOutIcon />
                                {t('user.logOut')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
