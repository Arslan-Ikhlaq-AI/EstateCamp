import { Badge } from '@/components/ui/badge';
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
import { Fragment } from 'react';

/**
 * The trail from the dashboard, the page title with an optional count and
 * badge, a line of description, and the page's main actions.
 *
 * `breadcrumbs` are `{ label, href? }` after the dashboard; the last one is
 * the current page and needs no link. `actionsClassName` styles the
 * actions' wrapper, such as hiding it on phones.
 */
export default function PageHeader({ breadcrumbs = [], title, count, badge, description, actions, actionsClassName }) {
    const { t, formatNumber } = useTranslation();

    return (
        <div className="flex flex-col gap-3">
            <Breadcrumb>
                <BreadcrumbList className="text-[0.8125rem]">
                    <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href={route('dashboard')} />}>{t('nav.dashboard')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    {breadcrumbs.map((crumb) => (
                        <Fragment key={crumb.label}>
                            <BreadcrumbSeparator className="rtl:rotate-180" />
                            <BreadcrumbItem className="min-w-0">
                                {crumb.href ? (
                                    <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage className="truncate" dir="auto">{crumb.label}</BreadcrumbPage>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
                        <span dir="auto" className="min-w-0 break-words">{title}</span>
                        {count !== undefined && count !== null && (
                            <Badge variant="outline" className="h-6 rounded-md bg-surface px-2 text-[0.8125rem] font-medium text-muted-foreground tabular-nums">
                                {formatNumber(count)}
                            </Badge>
                        )}
                        {badge}
                    </h1>
                    {description && <div className="max-w-3xl text-sm text-pretty text-muted-foreground">{description}</div>}
                </div>
                {actions && <div className={cn('flex shrink-0 flex-wrap items-center gap-2', actionsClassName)}>{actions}</div>}
            </div>
        </div>
    );
}
