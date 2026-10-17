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
 * The "more" menu for one shop. `onImage` styles the trigger for use on top
 * of a coloured banner.
 */
export default function ShopActions({ shop, onImage = false }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant={onImage ? 'secondary' : 'ghost'}
                        size="icon-sm"
                        aria-label={t('shopList.actions.menu', { number: shop.number })}
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
                        {t('shopList.shop', { number: shop.number })} · {shop.property.name}
                    </DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('shops.show', shop.id)} />}>
                        <EyeIcon />
                        {t('shopList.actions.view')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('shops.edit', shop.id)} />}>
                        <PencilIcon />
                        {t('shopList.actions.edit')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href={route('shops.index', { properties: [shop.property.code] })} />}>
                        <ListFilterIcon />
                        {t('shopList.actions.sameProperty')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.edit', shop.property.id)} />}>
                        <Building2Icon />
                        {t('shopList.actions.property')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
