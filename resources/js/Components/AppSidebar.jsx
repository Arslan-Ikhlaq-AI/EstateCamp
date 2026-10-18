import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';
import { footerNavigation, isCurrentRoute, navigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { Building2Icon, CheckIcon, ChevronRightIcon } from 'lucide-react';
import { Fragment } from 'react';

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
/**
 * Whether the link at `index` is the first under its heading.
 */
const startsHeading = (children, index) => Boolean(children[index].heading) && children[index].heading !== children[index - 1]?.heading;

function NavFlyout({ item, children, isActive }) {
    const { t } = useTranslation();

    return (
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton isActive={isActive} aria-label={t(item.title)} />}>
                    <item.icon />
                    <span>{t(item.title)}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="inline-end" align="start" sideOffset={12} className="w-60">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>{t(item.title)}</DropdownMenuLabel>
                        {children.map((child, index) => {
                            const isChildActive = isCurrentRoute(child.routeName, child.activeFor);

                            return (
                                <Fragment key={child.routeName}>
                                    {startsHeading(children, index) && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>{t(child.heading)}</DropdownMenuLabel>
                                        </>
                                    )}
                                    <DropdownMenuItem aria-current={isChildActive ? 'page' : undefined} render={<Link href={route(child.routeName)} />}>
                                        {child.icon && <child.icon className="text-muted-foreground" />}
                                        {t(child.title)}
                                        {isChildActive && <CheckIcon className="ms-auto text-brand-ink" />}
                                    </DropdownMenuItem>
                                </Fragment>
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
                        className={cn('group/trigger', isActive && 'font-semibold text-sidebar-accent-foreground [&>svg:first-child]:text-sidebar-primary')}
                    />
                }
            >
                <item.icon />
                <span>{t(item.title)}</span>
                <ChevronRightIcon className="ms-auto size-4! opacity-50 transition-transform duration-200 group-data-[panel-open]/trigger:rotate-90 rtl:-scale-x-100 rtl:group-data-[panel-open]/trigger:-rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                <SidebarMenuSub className="mt-1 mb-1.5">
                    {children.map((child, index) => {
                        const isChildActive = isCurrentRoute(child.routeName, child.activeFor);

                        return (
                            <Fragment key={child.routeName}>
                                {startsHeading(children, index) && (
                                    <li aria-hidden="true" className="px-3 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                                        {t(child.heading)}
                                    </li>
                                )}
                                <SidebarMenuSubItem>
                                    <SidebarMenuSubButton
                                        isActive={isChildActive}
                                        aria-current={isChildActive ? 'page' : undefined}
                                        render={<Link href={route(child.routeName)} />}
                                    >
                                        <span>{t(child.title)}</span>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            </Fragment>
                        );
                    })}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * The top of the sidebar belongs to the signed-in company: its logo (or
 * initials), its name and the user's role there. Users without a company
 * see a neutral placeholder instead.
 */
function CompanyBrand() {
    const { t } = useTranslation();
    const { company, role } = usePage().props.auth;
    const name = company?.name ?? t('common.tagline');

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    size="lg"
                    className="h-auto gap-3 rounded-2xl bg-white/[0.06] p-2.5 inset-ring inset-ring-white/10 hover:bg-white/10 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:inset-ring-0"
                    tooltip={{ children: name, side: 'inline-end' }}
                    render={<Link href={route('dashboard')} />}
                >
                    <Avatar className="size-11 rounded-xl shadow-lg shadow-black/20 after:rounded-xl group-data-[collapsible=icon]:size-8">
                        {company && <AvatarImage src={company.logo_url ?? undefined} alt="" className="rounded-xl bg-white" />}
                        <AvatarFallback className="rounded-xl bg-linear-to-br from-brand-cyan to-[#0b4f8a] text-sm font-bold text-white">
                            {company ? getInitials(company.short_name ?? company.name) : <Building2Icon className="size-5" />}
                        </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 leading-tight whitespace-normal!">
                        <span className="line-clamp-2 text-[0.9375rem] font-bold text-white" dir="auto">
                            {name}
                        </span>
                        {company && role && <span className="mt-0.5 truncate text-xs text-sidebar-foreground">{role}</span>}
                    </span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export default function AppSidebar(props) {
    return (
        <Sidebar collapsible="icon" variant="sidebar" {...props}>
            <SidebarHeader className="pt-5 pb-3">
                <CompanyBrand />
            </SidebarHeader>

            <SidebarContent className="gap-1">
                {navigation.map((group) => (
                    <NavGroup key={group.label} group={group} />
                ))}
            </SidebarContent>

            <SidebarFooter className="gap-1 border-t border-sidebar-border pt-3 pb-4">
                <SidebarMenu className="gap-1">
                    {footerNavigation.map((item) => (
                        <NavLink key={item.title} item={item} />
                    ))}
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

function NavGroup({ group }) {
    const { t } = useTranslation();

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="mb-1">{t(group.label)}</SidebarGroupLabel>
            <SidebarMenu className="gap-1">
                {group.items.map((item) =>
                    item.children ? <NavSection key={item.title} item={item} /> : <NavLink key={item.title} item={item} />,
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
