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
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Building2Icon, EyeIcon, ListFilterIcon, MoreHorizontalIcon, PencilIcon } from 'lucide-react';

/**
 * The "more" menu for one apartment. `onImage` styles the trigger for use on
 * top of a coloured banner.
 */
export default function ApartmentActions({ apartment, onImage = false }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant={onImage ? 'secondary' : 'ghost'}
                        size="icon-sm"
                        aria-label={t('apartmentList.actions.menu', { number: apartment.number })}
                        className={cn(
                            onImage &&
                                'bg-black/40 text-white backdrop-blur hover:bg-black/60 aria-expanded:bg-black/60 aria-expanded:text-white',
                        )}
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">
                        {t('apartmentList.apartment', { number: apartment.number })} · {apartment.property.name}
                    </DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('apartments.show', apartment.id)} />}>
                        <EyeIcon />
                        {t('apartmentList.actions.view')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('apartments.edit', apartment.id)} />}>
                        <PencilIcon />
                        {t('apartmentList.actions.edit')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        render={<Link href={route('apartments.index', { properties: [apartment.property.code] })} />}
                    >
                        <ListFilterIcon />
                        {t('apartmentList.actions.sameProperty')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.edit', apartment.property.id)} />}>
                        <Building2Icon />
                        {t('apartmentList.actions.property')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
