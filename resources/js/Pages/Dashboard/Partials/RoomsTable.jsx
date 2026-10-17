import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { DoorOpenIcon, WrenchIcon } from 'lucide-react';
import { Fragment, useState } from 'react';

const ALL_PROPERTIES = 'all';

function RoomStatus({ room }) {
    const { t } = useTranslation();

    if (room.status === 'under_maintenance') {
        return (
            <Badge variant="warning">
                <WrenchIcon data-icon="inline-start" />
                {t('status.under_maintenance')}
            </Badge>
        );
    }

    if (room.status === 'inactive') {
        return <Badge variant="outline">{t('status.inactive')}</Badge>;
    }

    if (room.occupied >= room.capacity) {
        return <Badge variant="secondary">{t('dashboard.rooms.full')}</Badge>;
    }

    return (
        <Badge variant="success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t('status.active')}
        </Badge>
    );
}

export default function RoomsTable({ rooms, properties, currency, className }) {
    const { t, tOr, formatCurrency, formatNumber } = useTranslation();
    const [propertyCode, setPropertyCode] = useState(ALL_PROPERTIES);

    const filterItems = [
        { value: ALL_PROPERTIES, label: t('dashboard.rooms.allProperties') },
        ...properties.map((property) => ({ value: property.code, label: property.name })),
    ];

    const visibleRooms =
        propertyCode === ALL_PROPERTIES
            ? rooms
            : rooms.filter((room) => room.propertyCode === propertyCode);

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.rooms.title')}</CardTitle>
                <CardDescription>{t('dashboard.rooms.description')}</CardDescription>
                {properties.length > 1 && (
                    <CardAction>
                        <Select items={filterItems} value={propertyCode} onValueChange={setPropertyCode}>
                            <SelectTrigger className="w-44" aria-label={t('dashboard.rooms.allProperties')}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {filterItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </CardAction>
                )}
            </CardHeader>

            <CardContent className="-mt-(--card-spacing) px-0">
                {visibleRooms.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <DoorOpenIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.rooms.empty')}</EmptyTitle>
                            <EmptyDescription>{t('dashboard.rooms.emptyDescription')}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="ps-4 sm:ps-5">{t('dashboard.rooms.room')}</TableHead>
                                <TableHead>{t('dashboard.rooms.type')}</TableHead>
                                <TableHead>{t('dashboard.rooms.occupancy')}</TableHead>
                                <TableHead className="text-end">{t('dashboard.rooms.rent')}</TableHead>
                                <TableHead className="pe-4 sm:pe-5">{t('dashboard.rooms.status')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleRooms.map((room, index) => (
                                <Fragment key={room.id}>
                                {room.propertyCode !== visibleRooms[index - 1]?.propertyCode && (
                                    <TableRow className="bg-muted/25 hover:bg-muted/25">
                                        <TableCell colSpan={5} className="py-1.5 ps-4 text-xs font-medium text-muted-foreground sm:ps-5" dir="auto">
                                            {room.property}
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow>
                                    <TableCell className="ps-4 sm:ps-5">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-10 rounded-lg after:rounded-lg">
                                                <AvatarImage
                                                    src={room.photoUrl ?? undefined}
                                                    alt=""
                                                    className="rounded-lg"
                                                />
                                                <AvatarFallback className="rounded-lg">
                                                    <DoorOpenIcon className="size-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="font-medium">{room.number}</span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {[
                                                        room.block && t('dashboard.rooms.block', { block: room.block }),
                                                        room.floor !== null && t('dashboard.rooms.floor', { floor: room.floor }),
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{tOr(`roomTypes.${room.typeSlug}`, room.type)}</span>
                                            {room.genderPolicy && (
                                                <span className="text-xs text-muted-foreground">
                                                    {t(`gender.${room.genderPolicy}`)}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex w-28 flex-col gap-1.5">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {formatNumber(room.occupied)} / {t('common.beds', { count: room.capacity })}
                                            </span>
                                            <Progress
                                                value={(room.occupied / room.capacity) * 100}
                                                aria-label={t('dashboard.rooms.occupancy')}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-end tabular-nums">
                                        {room.rentPerBed === null ? '—' : formatCurrency(room.rentPerBed, currency)}
                                    </TableCell>
                                    <TableCell className="pe-4 sm:pe-5">
                                        <RoomStatus room={room} />
                                    </TableCell>
                                </TableRow>
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
