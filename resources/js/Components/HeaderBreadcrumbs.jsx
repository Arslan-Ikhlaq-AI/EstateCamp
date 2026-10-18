import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { HomeIcon } from 'lucide-react';
import { createContext, Fragment, useContext, useLayoutEffect, useState } from 'react';

const BreadcrumbContext = createContext({ crumbs: [], setCrumbs: () => {} });

/**
 * Holds the current page's trail so the top bar can show it.
 */
export function BreadcrumbProvider({ children }) {
    const [crumbs, setCrumbs] = useState([]);

    return <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>;
}

/**
 * Puts a page's trail (`{ label, href? }` after the dashboard) in the top bar.
 */
export function useBreadcrumbs(crumbs) {
    const { setCrumbs } = useContext(BreadcrumbContext);
    const key = JSON.stringify(crumbs.map((crumb) => [crumb.label, crumb.href ?? null]));

    useLayoutEffect(() => {
        setCrumbs(crumbs);
        // The key captures every change that matters; the array itself is new on each render.
    }, [key, setCrumbs]);
}

/**
 * Sets the top bar's trail from inside the layout, for pages without a
 * page header.
 */
export function PageBreadcrumbs({ crumbs }) {
    useBreadcrumbs(crumbs);

    return null;
}

/**
 * The trail in the top bar: home, then the page's breadcrumbs. The dashboard
 * itself shows just its name.
 */
export default function HeaderBreadcrumbs({ className }) {
    const { t } = useTranslation();
    const { crumbs } = useContext(BreadcrumbContext);

    return (
        <Breadcrumb className={className}>
            <BreadcrumbList className="flex-nowrap text-[0.875rem]">
                <BreadcrumbItem>
                    {crumbs.length === 0 ? (
                        <BreadcrumbPage className="flex items-center gap-2 font-semibold">
                            <HomeIcon className="size-4 text-brand-ink" />
                            {t('nav.dashboard')}
                        </BreadcrumbPage>
                    ) : (
                        <BreadcrumbLink
                            render={<Link href={route('dashboard')} />}
                            aria-label={t('nav.dashboard')}
                            className="flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-brand-ink"
                        >
                            <HomeIcon className="size-4" />
                        </BreadcrumbLink>
                    )}
                </BreadcrumbItem>
                {crumbs.map((crumb, index) => {
                    const isLast = index === crumbs.length - 1;

                    return (
                        <Fragment key={crumb.label}>
                            <BreadcrumbSeparator className={cn('rtl:rotate-180', !isLast && 'hidden lg:inline-flex')} />
                            <BreadcrumbItem className={isLast ? 'min-w-0' : 'hidden lg:inline-flex'}>
                                {crumb.href && !isLast ? (
                                    <BreadcrumbLink render={<Link href={crumb.href} />} className="hover:text-brand-ink">
                                        {crumb.label}
                                    </BreadcrumbLink>
                                ) : isLast ? (
                                    <BreadcrumbPage className="truncate font-semibold" dir="auto">{crumb.label}</BreadcrumbPage>
                                ) : (
                                    <span className="text-muted-foreground">{crumb.label}</span>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
