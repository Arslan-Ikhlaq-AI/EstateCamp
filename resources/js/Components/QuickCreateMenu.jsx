import { Button } from '@/components/ui/button';
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
import { createActions, useCanOpen } from '@/lib/navigation';
import { Link, usePage } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import { Fragment } from 'react';

/**
 * The header's "Create" menu: a shortcut to every add page the user may
 * open, grouped like the sidebar. Hidden for users without a company, who
 * cannot add records, and for staff who may add nothing.
 */
export default function QuickCreateMenu() {
    const { t } = useTranslation();
    const { company } = usePage().props.auth;
    const canOpenLink = useCanOpen();
    const actions = createActions.filter(canOpenLink);
    const groups = [...new Set(actions.map((action) => action.group))];

    if (!company || actions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="brand"
                        aria-label={t('header.create')}
                        className="max-sm:size-8 max-sm:px-0"
                    />
                }
            >
                <PlusIcon />
                <span className="hidden sm:inline">{t('header.create')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-60">
                {groups.map((group, index) => (
                    <Fragment key={group}>
                        {index > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>{t(group)}</DropdownMenuLabel>
                            {actions
                                .filter((action) => action.group === group)
                                .map((action) => (
                                    <DropdownMenuItem key={action.routeName} render={<Link href={route(action.routeName)} />}>
                                        <action.icon className="text-muted-foreground" />
                                        {t(action.title)}
                                    </DropdownMenuItem>
                                ))}
                        </DropdownMenuGroup>
                    </Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
