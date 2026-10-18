import { useBreadcrumbs } from '@/Components/HeaderBreadcrumbs';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { currentPageIcon } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * The page title with an optional count and badge, a line of description,
 * and the page's main actions. The trail from the dashboard shows in the top
 * bar: `breadcrumbs` are `{ label, href? }` after the dashboard, the last one
 * being the current page. `actionsClassName` styles the actions' wrapper,
 * such as hiding it on phones. The title carries the page's icon from the
 * navigation, on the brand gradient like the logo.
 */
export default function PageHeader({ breadcrumbs = [], title, count, badge, description, actions, actionsClassName }) {
    const { formatNumber } = useTranslation();
    const Icon = currentPageIcon();

    useBreadcrumbs(breadcrumbs);

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
                {Icon && (
                    <span
                        aria-hidden="true"
                        className="hidden size-13 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-lg shadow-brand-navy/20 inset-ring inset-ring-white/20 sm:flex rtl:bg-linear-to-bl"
                    >
                        <Icon className="size-6" />
                    </span>
                )}
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-heading text-2xl font-bold tracking-tight sm:text-[1.875rem] sm:leading-10">
                        <span dir="auto" className="min-w-0 break-words">{title}</span>
                        {count !== undefined && count !== null && (
                            <Badge variant="info" className="h-7 rounded-lg px-2.5 text-[0.875rem] font-semibold tabular-nums">
                                {formatNumber(count)}
                            </Badge>
                        )}
                        {badge}
                    </h1>
                    {description && <div className="max-w-3xl text-[0.9375rem] text-pretty text-muted-foreground">{description}</div>}
                </div>
            </div>
            {actions && <div className={cn('flex flex-wrap items-center gap-2 sm:max-w-[60%] sm:justify-end', actionsClassName)}>{actions}</div>}
        </div>
    );
}
