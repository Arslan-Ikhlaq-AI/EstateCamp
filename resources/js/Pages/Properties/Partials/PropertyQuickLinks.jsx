import { buttonVariants } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { FileSignatureIcon, LayoutPanelLeftIcon, WalletIcon } from 'lucide-react';

/**
 * The pages a property is run from day to day, in the order they are used,
 * with the permission each one needs.
 */
const QUICK_LINKS = [
    { key: 'allocation', routeName: 'properties.allocation', icon: LayoutPanelLeftIcon, permission: 'properties.view' },
    { key: 'tenantContracts', routeName: 'properties.tenant-contracts', icon: FileSignatureIcon, permission: 'contracts.view' },
    { key: 'payments', routeName: 'properties.payments', icon: WalletIcon, permission: 'property_payments.view' },
];

const GRID_COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

/**
 * Links to a property's room allocation, tenant contracts and payments,
 * those the user may open.
 * `compact` shows a row of icons named in tooltips, for table rows;
 * otherwise the links share a bar equally, each with a short label.
 * `children` (such as the "more" menu) join the end of the compact row.
 */
export default function PropertyQuickLinks({ property, compact = false, className, children }) {
    const { t } = useTranslation();
    const can = useCan();
    const links = QUICK_LINKS.filter((link) => can(link.permission));

    if (compact) {
        return (
            <div className={cn('inline-flex items-center gap-0.5 rounded-lg bg-surface p-0.5 shadow-xs ring-1 ring-border', className)}>
                {links.map(({ key, routeName, icon: Icon }) => (
                    <Tooltip key={key}>
                        <TooltipTrigger
                            render={
                                <Link
                                    href={route(routeName, property.id)}
                                    aria-label={`${t(`properties.actions.${key}`)}: ${property.name}`}
                                    className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'text-brand-ink')}
                                />
                            }
                        >
                            <Icon />
                        </TooltipTrigger>
                        <TooltipContent>{t(`properties.actions.${key}`)}</TooltipContent>
                    </Tooltip>
                ))}
                {children}
            </div>
        );
    }

    return (
        <div className={cn('grid divide-x divide-border rtl:divide-x-reverse', GRID_COLUMNS[links.length], className)}>
            {links.map(({ key, routeName, icon: Icon }) => (
                <Link
                    key={key}
                    href={route(routeName, property.id)}
                    aria-label={`${t(`properties.actions.${key}`)}: ${property.name}`}
                    className={cn(
                        buttonVariants({ variant: 'ghost' }),
                        'h-11 min-w-0 gap-1.5 rounded-none px-2 text-[0.8125rem] font-semibold text-foreground/80 hover:bg-brand-cyan/[0.06] hover:text-foreground',
                    )}
                >
                    <Icon className="text-brand-ink" />
                    <span className="truncate">{t(`properties.actions.short.${key}`)}</span>
                </Link>
            ))}
        </div>
    );
}
