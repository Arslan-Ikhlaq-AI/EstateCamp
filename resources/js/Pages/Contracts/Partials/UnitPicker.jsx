import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownToLineIcon, ArrowUpToLineIcon, Building2Icon, CheckIcon, DoorOpenIcon, HouseIcon, ListChecksIcon, LockIcon, StoreIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

const KINDS = {
    rooms: { icon: DoorOpenIcon, column: 'room_id', type: 'room' },
    apartments: { icon: HouseIcon, column: 'apartment_id', type: 'apartment' },
    shops: { icon: StoreIcon, column: 'shop_id', type: 'shop' },
};

/**
 * Apartments and shops in these states cannot be let.
 */
const OUT_OF_SERVICE = ['under_maintenance', 'inactive'];

const byNumber = (a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true });

/**
 * The line on the form that rents this unit, if any.
 */
function lineFor(lines, kind, unit) {
    return lines.find((line) => line[KINDS[kind].column] === unit.id);
}

/**
 * The property's units of one kind this contract can take, in number
 * order: those nobody else holds (another contract or a short-term
 * rental) and that are in service, and those already on the contract.
 */
function choosable(property, kind, lines) {
    const isFree = (unit) => !unit.held && (kind === 'rooms' ? unit.status === 'active' : !OUT_OF_SERVICE.includes(unit.status));

    return property[kind].filter((unit) => lineFor(lines, kind, unit) || isFree(unit)).sort(byNumber);
}

/**
 * A new line renting one whole unit, for the contract's term.
 */
function newLine(property, kind, unit) {
    return {
        id: null,
        unit_type: KINDS[kind].type,
        property_id: property.id,
        room_id: null,
        apartment_id: null,
        shop_id: null,
        [KINDS[kind].column]: unit.id,
        start_date: '',
        end_date: '',
        hasStays: false,
    };
}

/**
 * A unit to tap on or off the contract. One people have stayed in under
 * the contract stays on it.
 */
function UnitChoice({ kind, unit, line, onToggle, currency }) {
    const { t, formatMoney } = useTranslation();
    const isChosen = Boolean(line);
    const isLocked = Boolean(line?.hasStays);
    const Icon = KINDS[kind].icon;
    const label = {
        rooms: t('leasing.lines.roomName', { room: unit.number }),
        apartments: t('leasing.lines.apartment', { number: unit.number }),
        shops: t('leasing.lines.shop', { number: unit.number }),
    }[kind];
    const rent = unit.rate ?? null;

    return (
        <button
            type="button"
            aria-pressed={isChosen}
            disabled={isLocked}
            onClick={onToggle}
            className={cn(
                'flex items-center gap-3 rounded-xl p-3 text-start ring-1 transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed sm:p-3.5',
                isChosen ? 'bg-brand-cyan/[0.06] shadow-(--raised-shadow) ring-2 ring-brand-cyan' : 'bg-surface ring-foreground/10 hover:bg-accent',
            )}
        >
            <span
                className={cn(
                    'hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex',
                    isChosen ? 'bg-brand-cyan text-brand-navy' : 'bg-brand-cyan/10 text-brand-ink',
                )}
            >
                {isLocked ? <LockIcon className="size-4" /> : isChosen ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="flex items-center gap-1 truncate text-sm font-semibold">
                    {isChosen && <CheckIcon className="size-3.5 shrink-0 text-brand-ink sm:hidden" />}
                    {label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {kind === 'rooms' && (
                        <>
                            <span className="block sm:inline">{t('common.sleeps', { count: unit.capacity })}</span>
                            <span className="hidden sm:inline"> · </span>
                        </>
                    )}
                    <span className="block sm:inline">
                        {isLocked ? t('leasing.contracts.form.picker.staying') : rent !== null ? formatMoney(rent, currency) : t('leasing.contracts.form.picker.noRate')}
                    </span>
                </span>
            </span>
        </button>
    );
}

/**
 * Choosing many units at once: all of them, or a typed count taken from
 * the start (as soon as it is typed) or from the end; and clearing them.
 */
function QuickPicks({ units, chosen, onChoose }) {
    const { t } = useTranslation();
    const [count, setCount] = useState('');
    const [from, setFrom] = useState('first');
    const howMany = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 0, 0), units.length);
    const pick = (direction, size) => onChoose(direction === 'first' ? units.slice(0, size) : units.slice(units.length - size));
    const size = howMany(count);

    const changeCount = (value) => {
        setCount(value);

        if (howMany(value) > 0) {
            pick(from, howMany(value));
        }
    };

    const chooseFrom = (direction) => {
        setFrom(direction);
        pick(direction, size);
    };

    const directions = [
        { key: 'first', icon: ArrowUpToLineIcon, label: t('leasing.contracts.form.picker.quick.first', { count: size || '…' }) },
        { key: 'last', icon: ArrowDownToLineIcon, label: t('leasing.contracts.form.picker.quick.last', { count: size || '…' }) },
    ];

    return (
        <div role="group" aria-label={t('leasing.contracts.form.picker.quick.label')} className="flex flex-wrap items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={chosen === units.length}
                onClick={() => {
                    setCount(String(units.length));
                    onChoose(units);
                }}
                className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
            >
                <ListChecksIcon data-icon="inline-start" />
                {t('leasing.contracts.form.picker.quick.all', { count: units.length })}
            </Button>
            <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={units.length}
                value={count}
                onChange={(event) => changeCount(event.target.value)}
                placeholder={t('leasing.contracts.form.picker.quick.count')}
                aria-label={t('leasing.contracts.form.picker.quick.count')}
                className="h-8 w-28 tabular-nums"
            />
            {directions.map((direction) => (
                <Button
                    key={direction.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={size === 0}
                    aria-pressed={size > 0 && from === direction.key}
                    onClick={() => chooseFrom(direction.key)}
                    className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                >
                    <direction.icon data-icon="inline-start" />
                    {direction.label}
                </Button>
            ))}
            {chosen > 0 && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setCount('');
                        onChoose([]);
                    }}
                >
                    <XIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.picker.quick.clear')}
                </Button>
            )}
        </div>
    );
}

/**
 * Every property with the rooms, apartments and shops this contract can
 * take, to tap on or off; units already let elsewhere are not shown. Rooms
 * are let whole. `onChange` receives the contract's new list of lines.
 */
export default function UnitPicker({ properties, lines, onChange, currency }) {
    const { t, formatNumber } = useTranslation();
    const [propertyId, setPropertyId] = useState(() => lines.find((line) => line.property_id)?.property_id ?? properties[0]?.id);
    const [kind, setKind] = useState('rooms');
    const property = properties.find((item) => item.id === propertyId);

    if (!property) {
        return <p className="text-sm text-muted-foreground">{t('leasing.contracts.form.picker.noProperties')}</p>;
    }

    const units = choosable(property, kind, lines);
    const column = KINDS[kind].column;
    const chosen = units.filter((unit) => lineFor(lines, kind, unit)).length;
    const freeIn = (item) => Object.keys(KINDS).reduce((sum, key) => sum + choosable(item, key, lines).filter((unit) => !lineFor(lines, key, unit)).length, 0);

    const toggle = (unit) => {
        const line = lineFor(lines, kind, unit);
        onChange(line ? lines.filter((entry) => entry !== line) : [...lines, newLine(property, kind, unit)]);
    };

    // Picking many replaces what is chosen among these units; ones people have stayed in stay on.
    const choose = (picked) => {
        const pickedIds = new Set(picked.map((unit) => unit.id));
        const shownIds = new Set(units.map((unit) => unit.id));
        const kept = lines.filter((line) => line.property_id !== property.id || !shownIds.has(line[column]) || pickedIds.has(line[column]) || line.hasStays);
        const added = picked.filter((unit) => !lineFor(lines, kind, unit)).map((unit) => newLine(property, kind, unit));

        onChange([...kept, ...added]);
    };

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
                                <span dir="auto" className="text-[0.8125rem] font-semibold whitespace-nowrap">
                                    {item.name}
                                </span>
                                <span className={cn('text-[0.6875rem] whitespace-nowrap', isCurrent ? 'text-white/70' : 'text-muted-foreground')}>
                                    {t('leasing.contracts.form.picker.free', { count: freeIn(item) })}
                                </span>
                            </span>
                            {onForm > 0 && (
                                <span className="rounded-full bg-gold px-1.5 text-[0.6875rem] leading-4 font-bold text-brand-navy tabular-nums">{formatNumber(onForm)}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <ToggleGroup variant="outline" spacing={0} value={[kind]} onValueChange={([value]) => value && setKind(value)} aria-label={t('leasing.contracts.form.picker.title')}>
                {Object.entries(KINDS).map(([key, { icon: Icon }]) => (
                    <ToggleGroupItem key={key} value={key} className="gap-2 px-3.5 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                        <Icon data-icon="inline-start" />
                        {t(`leasing.contracts.form.picker.${key}`)}
                        <span className="text-xs opacity-70 tabular-nums">{formatNumber(choosable(property, key, lines).length)}</span>
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            {units.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t(`leasing.contracts.form.picker.none.${kind}`)}</p>
            ) : (
                <>
                    <QuickPicks key={`${property.id}-${kind}`} units={units} chosen={chosen} onChoose={choose} />
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
                        {units.map((unit) => (
                            <UnitChoice key={unit.id} kind={kind} unit={unit} line={lineFor(lines, kind, unit)} onToggle={() => toggle(unit)} currency={currency} />
                        ))}
                    </div>
                    {chosen > 0 && <p className="text-sm font-medium text-brand-ink">{t('leasing.contracts.form.picker.chosen', { count: chosen })}</p>}
                </>
            )}
        </div>
    );
}
