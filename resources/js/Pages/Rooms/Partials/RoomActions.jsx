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
import { Building2Icon, ListFilterIcon, MoreHorizontalIcon, PencilIcon, WrenchIcon } from 'lucide-react';

/**
 * The "more" menu for one room. `onImage` styles the trigger for use on top
 * of a photo.
 */
export default function RoomActions({ room, onImage = false }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant={onImage ? 'secondary' : 'ghost'}
                        size="icon-sm"
                        aria-label={t('roomList.actions.menu', { number: room.number })}
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
                        {t('roomList.room', { number: room.number })} · {room.property.name}
                    </DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={route('rooms.edit', room.id)} />}>
                        <PencilIcon />
                        {t('roomList.actions.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('maintenance.create', { property: room.property.id, room: room.id })} />}>
                        <WrenchIcon />
                        {t('maintenance.reportProblem')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        render={<Link href={route('rooms.index', { properties: [room.property.code] })} />}
                    >
                        <ListFilterIcon />
                        {t('roomList.actions.sameProperty')}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={route('properties.edit', room.property.id)} />}>
                        <Building2Icon />
                        {t('roomList.actions.property')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
