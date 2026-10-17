import { BrandMark, BrandWordmark } from '@/Components/BrandLogo';
import UserMenu from '@/Components/UserMenu';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
    SidebarSeparator,
    useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { footerNavigation, isCurrentRoute, navigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';

function NavLink({ item }) {
    const { t } = useTranslation();
    const isActive = isCurrentRoute(item.routeName);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isActive}
                tooltip={{ children: t(item.title), side: 'inline-end' }}
                aria-current={isActive ? 'page' : undefined}
                render={<Link href={route(item.routeName)} />}
            >
                <item.icon />
                <span>{t(item.title)}</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

/**
 * In icon-only mode a nested section opens as a flyout menu, so its pages
 * stay one click away without expanding the sidebar.
 */
function NavFlyout({ item, children, isActive }) {
    const { t } = useTranslation();

    return (
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <SidebarMenuButton
                            isActive={isActive}
                            aria-label={t(item.title)}
                        />
                    }
                >
                    <item.icon />
                    <span>{t(item.title)}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="inline-end" align="start" sideOffset={10} className="w-56">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>{t(item.title)}</DropdownMenuLabel>
                        {children.map((child) => {
                            const isChildActive = isCurrentRoute(child.routeName, child.activeFor);

                            return (
                                <DropdownMenuItem
                                    key={child.routeName}
                                    aria-current={isChildActive ? 'page' : undefined}
                                    render={<Link href={route(child.routeName)} />}
                                >
                                    {t(child.title)}
                                    {isChildActive && <CheckIcon className="ms-auto text-primary" />}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}

function NavSection({ item }) {
    const { t } = useTranslation();
    const { state, isMobile } = useSidebar();
    const isAdmin = Boolean(usePage().props.auth.user.is_admin);

    const children = item.children.filter((child) => !child.adminOnly || isAdmin);
    const isActive = children.some((child) => isCurrentRoute(child.routeName, child.activeFor));

    if (state === 'collapsed' && !isMobile) {
        return <NavFlyout item={item} isActive={isActive}>{children}</NavFlyout>;
    }

    return (
        <Collapsible defaultOpen={isActive} render={<SidebarMenuItem />}>
            <CollapsibleTrigger
                render={
                    <SidebarMenuButton
                        className={cn('group/trigger', isActive && 'font-medium text-sidebar-accent-foreground [&>svg:first-child]:text-sidebar-primary')}
                    />
                }
            >
                <item.icon />
                <span>{t(item.title)}</span>
                <ChevronRightIcon className="ms-auto opacity-60 transition-transform duration-200 group-data-[panel-open]/trigger:rotate-90 rtl:-scale-x-100 rtl:group-data-[panel-open]/trigger:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                <SidebarMenuSub className="mt-0.5 mb-1">
                    {children.map((child) => {
                        const isChildActive = isCurrentRoute(child.routeName, child.activeFor);

                        return (
                            <SidebarMenuSubItem key={child.routeName}>
                                <SidebarMenuSubButton
                                    isActive={isChildActive}
                                    aria-current={isChildActive ? 'page' : undefined}
                                    render={<Link href={route(child.routeName)} />}
                                >
                                    <span>{t(child.title)}</span>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        );
                    })}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function AppSidebar(props) {
    const { t } = useTranslation();
    const { company } = usePage().props.auth;

    return (
        <Sidebar collapsible="icon" variant="inset" {...props}>
            <SidebarHeader className="pt-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="group/brand h-12 hover:bg-transparent active:bg-transparent"
                            tooltip={{ children: 'EstateCamp', side: 'inline-end' }}
                            render={<Link href={route('dashboard')} />}
                        >
                            <BrandMark className="size-8! drop-shadow-sm" />
                            <span className="grid flex-1 leading-tight">
                                <BrandWordmark className="text-[0.9375rem] text-sidebar-accent-foreground" />
                                <span className="truncate text-xs text-sidebar-foreground" dir="auto">
                                    {company?.name ?? t('common.tagline')}
                                </span>
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-0">
                {navigation.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
                        <SidebarMenu className="gap-0.5">
                            {group.items.map((item) =>
                                item.children ? (
                                    <NavSection key={item.title} item={item} />
                                ) : (
                                    <NavLink key={item.title} item={item} />
                                ),
                            )}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu className="gap-0.5">
                    {footerNavigation.map((item) => (
                        <NavLink key={item.title} item={item} />
                    ))}
                </SidebarMenu>
                <SidebarSeparator className="mx-0" />
                <UserMenu />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
