import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BedDoubleIcon, Building2Icon, CheckIcon, DoorOpenIcon, HouseIcon, PlusIcon, StoreIcon } from 'lucide-react';
import { useState } from 'react';

const KINDS = {
    rooms: DoorOpenIcon,
    apartments: HouseIcon,
    shops: StoreIcon,
};

/**
 * Beds of a room already on this form's lines: a whole room takes them all.
 */
export function bedsOnForm(room, lines) {
    return lines
        .filter((line) => line.room_id === room.id)
        .reduce((sum, line) => sum + (line.unit_type === 'room' ? room.capacity : Number(line.quantity) || 0), 0);
}

/**
 * Beds of a room still free: not held by another live contract, nor
 * already on this form.
 */
export function freeBeds(room, lines) {
    return Math.max(room.capacity - room.contracted - bedsOnForm(room, lines), 0);
}

function RoomTile({ room, lines, onAddBed, onAddRoom }) {
    const { t, tOr, formatNumber } = useTranslation();
    const free = freeBeds(room, lines);
    const onForm = bedsOnForm(room, lines);
    const isInService = room.status === 'active';
    const canTakeWhole = isInService && room.contracted === 0 && onForm === 0;
    const takenPercent = room.capacity > 0 ? ((room.capacity - free - onForm) / room.capacity) * 100 : 0;
    const onFormPercent = room.capacity > 0 ? (onForm / room.capacity) * 100 : 0;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl bg-surface p-3.5 ring-1 transition-shadow',
                onForm > 0 ? 'shadow-(--raised-shadow) ring-2 ring-brand-cyan' : 'ring-foreground/10',
                !isInService && 'opacity-70',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="text-sm font-semibold">{t('leasing.lines.roomName', { room: room.number })}</span>
                    <span className="truncate text-xs text-muted-foreground">
                        {[room.type && tOr(`roomTypes.${room.type.slug}`, room.type.name), room.genderPolicy && t(`gender.${room.genderPolicy}`)]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </div>
                {onForm > 0 ? (
                    <Badge variant="info">
                        <CheckIcon data-icon="inline-start" />
                        {t('common.beds', { count: onForm })}
                    </Badge>
                ) : !isInService ? (
                    <Badge variant="secondary">{t(`status.${room.status}`)}</Badge>
                ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
                <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-success/20">
                    <span className="h-full bg-chart-3" style={{ width: `${takenPercent}%` }} />
                    <span className="h-full bg-brand-cyan" style={{ width: `${onFormPercent}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {t('leasing.contracts.form.picker.bedsFree', { free: formatNumber(free), total: formatNumber(room.capacity) })}
                </span>
            </div>

            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" disabled={!isInService || free === 0} onClick={() => onAddBed(room)}>
                    <BedDoubleIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.picker.addBed')}
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" disabled={!canTakeWhole} onClick={() => onAddRoom(room)}>
                    <DoorOpenIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.picker.wholeRoom')}
                </Button>
            </div>
        </div>
    );
}

function UnitTile({ kind, unit, isOnForm, onAdd, currency }) {
    const { t, formatMoney } = useTranslation();
    const label = kind === 'apartments' ? t('leasing.lines.apartment', { number: unit.number }) : t('leasing.lines.shop', { number: unit.number });
    const isTaken = unit.held;
    const Icon = KINDS[kind];

    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-xl bg-surface p-3.5 ring-1 transition-shadow',
                isOnForm ? 'shadow-(--raised-shadow) ring-2 ring-brand-cyan' : 'ring-foreground/10',
                isTaken && 'opacity-70',
            )}
        >
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', isTaken ? 'bg-muted text-muted-foreground' : 'bg-brand-cyan/10 text-brand-ink')}>
                <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold">{label}</span>
                <span className="truncate text-xs text-muted-foreground">
                    {isTaken ? t('leasing.contracts.form.picker.taken') : unit.rate ? formatMoney(unit.rate, currency) : t(`leasing.unitStatus.${unit.status}`)}
                </span>
            </div>
            {isOnForm ? (
                <Badge variant="info">
                    <CheckIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.picker.added')}
                </Badge>
            ) : (
                <Button type="button" variant="outline" size="sm" disabled={isTaken} onClick={() => onAdd(unit)}>
                    <PlusIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.picker.add')}
                </Button>
            )}
        </div>
    );
}

/**
 * Every property with its rooms, apartments and shops, showing what is free.
 * A room can be taken whole or a bed at a time (each click adds a bed); an
 * apartment or shop is added once. `onAdd` receives the line to add, with
 * its property, unit and list price.
 */
export default function UnitPicker({ properties, lines, onAdd, currency }) {
    const { t, formatNumber } = useTranslation();
    const [propertyId, setPropertyId] = useState(() => lines.find((line) => line.property_id)?.property_id ?? properties[0]?.id);
    const [kind, setKind] = useState('rooms');
    const property = properties.find((item) => item.id === propertyId);

    if (!property) {
        return <p className="text-sm text-muted-foreground">{t('leasing.contracts.form.picker.noProperties')}</p>;
    }

    const propertyFreeBeds = (item) => item.rooms.filter((room) => room.status === 'active').reduce((sum, room) => sum + freeBeds(room, lines), 0);

    const line = (patch) => ({ property_id: property.id, room_id: null, apartment_id: null, shop_id: null, quantity: 1, ...patch });

    return (
        <div className="flex flex-col gap-4">
            <div role="tablist" aria-label={t('leasing.common.property')} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {properties.map((item) => {
                    const isCurrent = item.id === property.id;
                    const onForm = lines.filter((entry) => entry.property_id === item.id).length;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={isCurrent}
                            onClick={() => setPropertyId(item.id)}
                            className={cn(
                                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-start ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                                isCurrent ? 'bg-primary text-primary-foreground ring-primary' : 'bg-surface ring-foreground/10 hover:bg-accent',
                            )}
                        >
                            <Building2Icon className={cn('size-4 shrink-0', isCurrent ? 'text-brand-cyan' : 'text-muted-foreground')} />
                            <span className="flex flex-col leading-tight">
                                <span dir="auto" className="text-[0.8125rem] font-semibold whitespace-nowrap">{item.name}</span>
                                <span className={cn('text-[0.6875rem] whitespace-nowrap', isCurrent ? 'text-white/70' : 'text-muted-foreground')}>
                                    {t('leasing.contracts.form.picker.freeBeds', { count: propertyFreeBeds(item) })}
                                </span>
                            </span>
                            {onForm > 0 && (
                                <span className="rounded-full bg-gold px-1.5 text-[0.6875rem] leading-4 font-bold text-brand-navy tabular-nums">{formatNumber(onForm)}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <ToggleGroup variant="outline" spacing={0} value={[kind]} onValueChange={([value]) => value && setKind(value)} aria-label={t('leasing.contracts.form.picker.title')}>
                    {Object.entries(KINDS).map(([key, Icon]) => (
                        <ToggleGroupItem key={key} value={key} className="gap-2 px-3.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                            <Icon data-icon="inline-start" />
                            {t(`leasing.contracts.form.picker.${key}`)}
                            <span className="text-xs opacity-70 tabular-nums">{formatNumber(property[key].length)}</span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                {kind === 'rooms' && property.rooms.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="text-brand-ink" onClick={() => onAdd(line({ unit_type: 'bed', monthly_rate: '' }))}>
                        <PlusIcon data-icon="inline-start" />
                        {t('leasing.contracts.form.picker.anywhere')}
                    </Button>
                )}
            </div>

            {property[kind].length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                    {t(`leasing.contracts.form.picker.none.${kind}`)}
                </p>
            ) : kind === 'rooms' ? (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {property.rooms.map((room) => (
                        <RoomTile
                            key={room.id}
                            room={room}
                            lines={lines}
                            onAddBed={() => onAdd(line({ unit_type: 'bed', room_id: room.id, monthly_rate: room.rate ?? '' }))}
                            onAddRoom={() => onAdd(line({ unit_type: 'room', room_id: room.id, monthly_rate: room.rate ? room.rate * room.capacity : '' }))}
                        />
                    ))}
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {property[kind].map((unit) => {
                        const column = kind === 'apartments' ? 'apartment_id' : 'shop_id';

                        return (
                            <UnitTile
                                key={unit.id}
                                kind={kind}
                                unit={unit}
                                currency={currency}
                                isOnForm={lines.some((entry) => entry[column] === unit.id)}
                                onAdd={() =>
                                    onAdd(
                                        line({
                                            unit_type: kind === 'apartments' ? 'apartment' : 'shop',
                                            [column]: unit.id,
                                            monthly_rate: unit.rate ?? '',
                                        }),
                                    )
                                }
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
