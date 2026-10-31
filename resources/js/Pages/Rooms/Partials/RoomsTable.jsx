import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, DoorOpenIcon } from 'lucide-react';
import RoomActions from './RoomActions';
import { AmenityIcons, AvailabilityBadge, RoomStatusBadge, useRoomPlacement } from './RoomBits';
import { GENDER_ICONS } from './roomOptions';

/**
 * Table columns in display order. `sort` is the server sort key a header
 * toggles; columns without `hideable: false` can be hidden from the toolbar.
 */
export const ROOM_COLUMNS = [
    { id: 'room', sort: 'room', hideable: false },
    { id: 'property' },
    { id: 'type' },
    { id: 'occupancy', sort: 'occupancy' },
    { id: 'rent', sort: 'rent', align: 'end' },
    { id: 'amenities' },
    { id: 'status' },
];

export const DEFAULT_HIDDEN_ROOM_COLUMNS = [];

// Solid equivalents of the header and hover tints, so the pinned actions
// column matches the row it sits on while the rest of the table scrolls under it.
const HEADER_BACKGROUND = 'bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))]';
const ROW_HOVER_BACKGROUND = 'hover:bg-[color-mix(in_oklab,var(--color-brand-cyan)_7%,var(--card))]';

function SortableHead({ column, query, onSort, className, children }) {
    const isSorted = query.sort === column.sort;
    const isAscending = query.direction === 'asc';
    const SortIcon = !isSorted ? ChevronsUpDownIcon : isAscending ? ArrowUpIcon : ArrowDownIcon;

    return (
        <TableHead
            aria-sort={isSorted ? (isAscending ? 'ascending' : 'descending') : undefined}
            className={cn(column.align === 'end' && 'text-end', className)}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort(column.sort)}
                className={cn(
                    'h-7 px-2 text-muted-foreground',
                    column.align === 'end' ? '-me-2' : '-ms-2',
                    isSorted && 'text-foreground',
                )}
            >
                {children}
                <SortIcon data-icon="inline-end" className={cn(!isSorted && 'opacity-50')} />
            </Button>
        </TableHead>
    );
}

function Cell({ column, room, currency }) {
    const { t, tOr, formatCurrency } = useTranslation();
    const placement = useRoomPlacement();

    switch (column.id) {
        case 'room':
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="size-10 rounded-lg after:rounded-lg">
                        <AvatarImage src={room.photoUrl ?? undefined} alt="" className="rounded-lg object-cover" />
                        <AvatarFallback className="rounded-lg">
                            <DoorOpenIcon className="size-4" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                        <span className="font-medium">{t('roomList.room', { number: room.number })}</span>
                        <span className="truncate text-xs text-muted-foreground">{placement(room) || '—'}</span>
                    </div>
                </div>
            );
        case 'property':
            return (
                <div className="flex max-w-48 flex-col items-start">
                    <span dir="auto" className="max-w-full truncate">{room.property.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{room.property.code}</span>
                </div>
            );
        case 'type': {
            const GenderIcon = GENDER_ICONS[room.genderPolicy];

            return (
                <div className="flex flex-col">
                    <span>{tOr(`roomTypes.${room.typeSlug}`, room.type)}</span>
                    {room.genderPolicy && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {GenderIcon && <GenderIcon className="size-3" />}
                            {t(`gender.${room.genderPolicy}`)}
                        </span>
                    )}
                </div>
            );
        }
        case 'occupancy':
            return (
                <div className="flex w-36 items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{t('common.sleeps', { count: room.capacity })}</span>
                    <AvailabilityBadge room={room} />
                </div>
            );
        case 'rent':
            return room.monthlyRent === null ? (
                <span className="text-xs text-muted-foreground">{t('roomList.noRate')}</span>
            ) : (
                <span className="font-medium tabular-nums">{formatCurrency(room.monthlyRent, currency)}</span>
            );
        case 'amenities':
            return <AmenityIcons amenities={room.amenities} />;
        case 'status':
            return <RoomStatusBadge status={room.status} />;
        default:
            return null;
    }
}

/**
 * Rooms as a table with sortable headers and a menu per row.
 */
export default function RoomsTable({ rooms, currency, query, onSort, hiddenColumns }) {
    const { t } = useTranslation();
    const columns = ROOM_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

    return (
        <Table>
            <TableHeader className={HEADER_BACKGROUND}>
                <TableRow className="hover:bg-transparent">
                    {columns.map((column, index) => {
                        const label = t(`roomList.columns.${column.id}`);
                        const padding = index === 0 && 'ps-4 sm:ps-5 lg:ps-6';

                        return column.sort ? (
                            <SortableHead key={column.id} column={column} query={query} onSort={onSort} className={padding}>
                                {label}
                            </SortableHead>
                        ) : (
                            <TableHead
                                key={column.id}
                                className={cn(padding, column.align === 'end' && 'text-end')}
                            >
                                {label}
                            </TableHead>
                        );
                    })}
                    <TableHead className={cn('sticky end-0 w-12 pe-4 sm:pe-5 lg:pe-6', HEADER_BACKGROUND)}>
                        <span className="sr-only">{t('roomList.columns.actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rooms.map((room) => (
                    <TableRow key={room.id} className={cn('group/row', ROW_HOVER_BACKGROUND)}>
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn('py-3', index === 0 && 'ps-4 sm:ps-5 lg:ps-6', column.align === 'end' && 'text-end')}
                            >
                                <Cell column={column} room={room} currency={currency} />
                            </TableCell>
                        ))}
                        <TableCell className="sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5 lg:pe-6">
                            <RoomActions room={room} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
