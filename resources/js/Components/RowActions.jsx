import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@inertiajs/react';
import { MoreHorizontalIcon } from 'lucide-react';

/**
 * The "more" menu at the end of a table row. `label` names the record (it
 * heads the menu and labels the button); `items` are `{ label, href, icon }` links.
 */
export default function RowActions({ label, items }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground" />}>
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
                    {items.map((item) => (
                        <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
                            {item.icon && <item.icon />}
                            {item.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
