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
import { createActions } from '@/lib/navigation';
import { Link, usePage } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import { Fragment } from 'react';

const groups = [...new Set(createActions.map((action) => action.group))];

/**
 * The header's "Create" menu: a shortcut to every add page, grouped like the
 * sidebar. Hidden for users without a company, who cannot add records.
 */
export default function QuickCreateMenu() {
    const { t } = useTranslation();
    const { company } = usePage().props.auth;

    if (!company) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
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
                            {createActions
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
