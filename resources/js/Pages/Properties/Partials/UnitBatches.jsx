import { MoneyField, SelectField, TextField } from '@/Components/FormFields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { defaultRoomTypeId } from '@/Pages/Rooms/Partials/roomOptions';
import { Link } from '@inertiajs/react';
import { DoorOpenIcon, HouseIcon, PlusIcon, StoreIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

const KINDS = {
    rooms: { icon: DoorOpenIcon, fallback: '101', index: 'rooms.index' },
    shops: { icon: StoreIcon, fallback: 'S-01', index: 'shops.index' },
    apartments: { icon: HouseIcon, fallback: 'A-101', index: 'apartments.index' },
};

/**
 * The most units one batch can hold, the same as the most units a property
 * can have (the server allows no more).
 */
const MAX_BATCH_SIZE = 10000;

export const emptyUnits = () => ({ rooms: [], shops: [], apartments: [] });

/**
 * Numbers counting up from `first`, keeping its prefix and zero padding, as
 * the server does: "101" gives 101, 102, …; "S-09" gives S-09, S-10, ….
 */
export function unitNumbers(first, count) {
    const match = String(first ?? '').trim().match(/^(.*?)(\d+)$/);
    const total = Number(count);

    if (!match || !Number.isInteger(total) || total < 1) {
        return [];
    }

    const [, prefix, digits] = match;

    return Array.from({ length: Math.min(total, MAX_BATCH_SIZE) }, (_, offset) => prefix + String(Number(digits) + offset).padStart(digits.length, '0'));
}

export const unitCount = (batches) => batches.reduce((sum, batch) => sum + unitNumbers(batch.first_number, batch.count).length, 0);

/**
 * Where a new batch starts: after the previous batch, after the property's
 * highest-numbered unit, or at a sensible first number.
 */
function nextFirstNumber(kind, batches, summary) {
    const last = batches[batches.length - 1];
    const numbers = last ? unitNumbers(last.first_number, Number(last.count) + 1) : [];

    return numbers.length > 0 ? numbers[numbers.length - 1] : (summary?.[kind]?.next ?? KINDS[kind].fallback);
}

function newBatch(kind, batches, summary, options) {
    const first_number = nextFirstNumber(kind, batches, summary);

    if (kind === 'rooms') {
        return { count: '1', first_number, room_type_id: defaultRoomTypeId(options.roomTypes), capacity: '4', monthly_rent: '', area_sqm: '', floor_number: '', gender_policy: null };
    }

    if (kind === 'shops') {
        return { count: '1', first_number, shop_type: null, monthly_rent: '', area_sqm: '', floor_number: '' };
    }

    return { count: '1', first_number, bedrooms: '1', bathrooms: '1', furnishing_status: null, monthly_rent: '', area_sqm: '', floor_number: '' };
}

/**
 * One batch's fields. `maxCount` is the most units the batch can hold.
 */
function BatchFields({ kind, batch, index, onChange, errors, options, currency, maxCount }) {
    const { t, tOr } = useTranslation();
    const id = (field) => `units-${kind}-${index}-${field}`;
    const error = (field) => errors[`units.${kind}.${index}.${field}`];
    const bind = (field) => ({ id: id(field), value: batch[field], onChange: (value) => onChange(field, value), error: error(field) });

    return (
        <FieldGroup className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <TextField {...bind('count')} type="number" inputMode="numeric" min={1} max={maxCount} label={t('propertyForm.units.count')} required />
            <TextField {...bind('first_number')} label={t('propertyForm.units.firstNumber')} description={t('propertyForm.units.firstNumberHint')} required />

            {kind === 'rooms' && (
                <>
                    <SelectField
                        {...bind('room_type_id')}
                        label={t('propertyForm.units.roomType')}
                        items={options.roomTypes.map((type) => ({ value: type.id, label: tOr(`roomTypes.${type.slug}`, type.name) }))}
                    />
                    <TextField {...bind('capacity')} type="number" inputMode="numeric" min={1} max={100} label={t('propertyForm.units.capacity')} required />
                    <MoneyField {...bind('monthly_rent')} currency={currency} label={t('propertyForm.units.monthlyRent')} optional />
                    <SelectField
                        {...bind('gender_policy')}
                        label={t('propertyForm.units.gender')}
                        placeholder={t('propertyForm.units.any')}
                        items={options.genderPolicies.map((policy) => ({ value: policy, label: t(`gender.${policy}`) }))}
                        optional
                    />
                </>
            )}

            {kind === 'shops' && (
                <>
                    <SelectField
                        {...bind('shop_type')}
                        label={t('propertyForm.units.shopType')}
                        placeholder={t('propertyForm.units.any')}
                        items={options.shopTypes.map((type) => ({ value: type, label: t(`shopTypes.${type}`) }))}
                        optional
                    />
                    <MoneyField {...bind('monthly_rent')} currency={currency} label={t('propertyForm.units.rent')} optional />
                </>
            )}

            {kind === 'apartments' && (
                <>
                    <TextField {...bind('bedrooms')} type="number" inputMode="numeric" min={0} max={20} label={t('propertyForm.units.bedrooms')} required />
                    <TextField {...bind('bathrooms')} type="number" inputMode="numeric" min={0} max={20} label={t('propertyForm.units.bathrooms')} required />
                    <SelectField
                        {...bind('furnishing_status')}
                        label={t('propertyForm.units.furnishing')}
                        placeholder={t('propertyForm.units.any')}
                        items={options.furnishingStatuses.map((status) => ({ value: status, label: t(`furnishing.${status}`) }))}
                        optional
                    />
                    <MoneyField {...bind('monthly_rent')} currency={currency} label={t('propertyForm.units.rent')} optional />
                </>
            )}

            <TextField {...bind('area_sqm')} type="number" inputMode="decimal" min={0} step="0.01" label={t('propertyForm.units.area')} optional />
            <TextField {...bind('floor_number')} type="number" inputMode="numeric" label={t('propertyForm.units.floor')} optional />
        </FieldGroup>
    );
}

/**
 * Rooms, shops and apartments to create with the property, in batches of
 * alike units (such as five rooms for 4 and three rooms for 6), each batch
 * numbered up from its first number. `summary` lists what the property
 * already has when editing. `remaining` is how many more units fit, or null
 * when the property has no number of units; at zero no batch can be added.
 */
export default function UnitBatches({ units, onChange, errors, options, currency, summary, remaining = null }) {
    const { t, formatNumber } = useTranslation();
    const [kind, setKind] = useState('rooms');
    const batches = units[kind];
    const Icon = KINDS[kind].icon;
    const isFull = remaining !== null && remaining <= 0;

    const setBatches = (next) => onChange({ ...units, [kind]: next });
    const updateBatch = (index, field, value) => setBatches(batches.map((batch, position) => (position === index ? { ...batch, [field]: value } : batch)));

    return (
        <div className="flex flex-col gap-5">
            {summary && (
                <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
                    <span>{t('propertyForm.units.existing')}</span>
                    {Object.entries(KINDS).map(([key, { icon: KindIcon, index }]) => (
                        <Badge key={key} variant="secondary" render={<Link href={route(index)} />} className="h-6 gap-1.5">
                            <KindIcon data-icon="inline-start" />
                            {formatNumber(summary[key].count)} {t(`propertyForm.units.kinds.${key}`)}
                        </Badge>
                    ))}
                </div>
            )}

            <ToggleGroup
                aria-label={t('propertyForm.units.title')}
                variant="outline"
                spacing={0}
                value={[kind]}
                onValueChange={([value]) => value && setKind(value)}
                className="w-full sm:w-fit"
            >
                {Object.entries(KINDS).map(([key, { icon: KindIcon }]) => {
                    const count = unitCount(units[key]);
                    const hasErrors = Object.keys(errors).some((field) => field.startsWith(`units.${key}.`));

                    return (
                        <ToggleGroupItem key={key} value={key} className="flex-1 gap-2 px-4 aria-pressed:bg-primary aria-pressed:text-primary-foreground sm:flex-none">
                            <KindIcon data-icon="inline-start" />
                            {t(`propertyForm.units.kinds.${key}`)}
                            {count > 0 && (
                                <span className="rounded-full bg-gold px-1.5 text-[0.6875rem] leading-4 font-bold text-brand-navy tabular-nums">
                                    +{formatNumber(count)}
                                </span>
                            )}
                            {hasErrors && <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />}
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>

            {batches.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-ink">
                        <Icon className="size-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold">{t(`propertyForm.units.empty.${kind}`)}</p>
                        <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.units.emptyHint')}</p>
                    </div>
                    <Button type="button" variant="outline" disabled={isFull} onClick={() => setBatches([newBatch(kind, batches, summary, options)])}>
                        <PlusIcon data-icon="inline-start" />
                        {t('propertyForm.units.addBatch')}
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {batches.map((batch, index) => {
                        const numbers = unitNumbers(batch.first_number, batch.count);

                        return (
                            <section key={index} className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/[0.08] motion-safe:animate-enter">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan to-brand-navy text-xs font-bold text-white">
                                            {formatNumber(index + 1)}
                                        </span>
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-sm font-semibold">{t('propertyForm.units.batch', { number: index + 1 })}</span>
                                            {numbers.length > 0 && (
                                                <span className="text-[0.8125rem] text-muted-foreground">
                                                    {t('propertyForm.units.preview', { count: numbers.length, first: numbers[0], last: numbers[numbers.length - 1] })}
                                                    {kind === 'rooms' && Number(batch.capacity) > 0 && (
                                                        <> · {t('common.sleeps', { count: numbers.length * Number(batch.capacity) })}</>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t('propertyForm.units.remove')}
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => setBatches(batches.filter((_, position) => position !== index))}
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </div>

                                <BatchFields
                                    kind={kind}
                                    batch={batch}
                                    index={index}
                                    onChange={(field, value) => updateBatch(index, field, value)}
                                    errors={errors}
                                    options={options}
                                    currency={currency}
                                    maxCount={remaining === null ? MAX_BATCH_SIZE : Math.min(Math.max(numbers.length + remaining, 1), MAX_BATCH_SIZE)}
                                />
                            </section>
                        );
                    })}

                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" variant="outline" disabled={isFull} onClick={() => setBatches([...batches, newBatch(kind, batches, summary, options)])}>
                            <PlusIcon data-icon="inline-start" />
                            {t('propertyForm.units.addBatch')}
                        </Button>
                        {isFull && <span className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.size.full')}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}
