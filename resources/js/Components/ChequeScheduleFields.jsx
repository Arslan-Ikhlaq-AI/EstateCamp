import { ChequeStatusBadge } from '@/Components/LeasingBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { addDays, agreementYear, currentChequeYear, isChequeReady } from '@/lib/cheques';
import { cn } from '@/lib/utils';
import { CameraIcon, ChevronDownIcon, CircleCheckIcon, LockIcon, RefreshCwIcon, ShieldCheckIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';

/**
 * Banks most UAE cheques are drawn on, suggested in the bank field along
 * with the banks the company has used before.
 */
const COMMON_BANKS = [
    'Emirates NBD',
    'First Abu Dhabi Bank',
    'Abu Dhabi Commercial Bank',
    'Dubai Islamic Bank',
    'Mashreq',
    'Commercial Bank of Dubai',
    'Abu Dhabi Islamic Bank',
    'RAKBANK',
    'Emirates Islamic',
    'National Bank of Fujairah',
    'Sharjah Islamic Bank',
    'HSBC',
];

/**
 * A photo of one side of a cheque: a tile to take or choose a picture, then
 * its preview with buttons to replace or remove it. On a phone the picker
 * offers the camera.
 */
export function ChequePhotoInput({ id, label, required, file, url, removed, onFile, onRemove, error, className }) {
    const { t } = useTranslation();
    const preview = useMemo(() => (file ? URL.createObjectURL(file) : removed ? null : url), [file, url, removed]);

    useEffect(() => () => file && preview && URL.revokeObjectURL(preview), [file, preview]);

    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <FieldLabel htmlFor={id} className="text-xs">
                {label}
                {required && <span className="font-normal text-muted-foreground">({t('leasing.cheques.photo.required')})</span>}
            </FieldLabel>
            {preview ? (
                <div className="group/photo relative aspect-[2.2/1] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                    <img src={preview} alt="" className="size-full object-cover" />
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1">
                        <Button variant="secondary" size="xs" nativeButton={false} render={<label htmlFor={id} />} className="cursor-pointer">
                            <RefreshCwIcon data-icon="inline-start" />
                            {t('leasing.cheques.photo.replace')}
                        </Button>
                        <Button type="button" variant="secondary" size="icon-xs" onClick={onRemove} aria-label={t('leasing.cheques.photo.remove')}>
                            <XIcon />
                        </Button>
                    </div>
                </div>
            ) : (
                <label
                    htmlFor={id}
                    className={cn(
                        'flex aspect-[2.2/1] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-brand-cyan hover:bg-brand-cyan/5 hover:text-brand-ink has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                        error && 'border-destructive text-destructive',
                    )}
                >
                    <CameraIcon className="size-5" />
                    {t('leasing.cheques.photo.add')}
                </label>
            )}
            <input
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                    if (event.target.files[0]) {
                        onFile(event.target.files[0]);
                    }

                    event.target.value = '';
                }}
            />
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * Quick buttons that set the end date from the start date: one, two, three
 * or five years.
 */
export function TermPicker({ startDate, endDate, onChange }) {
    const { t } = useTranslation();
    const terms = [1, 2, 3, 5];
    const current = startDate && endDate ? terms.find((years) => addDays(addMonths(startDate, 12 * years), -1) === endDate) : undefined;

    return (
        <Field className="sm:col-span-2">
            <FieldLabel id="term-label">{t('leasing.cheques.term.label')}</FieldLabel>
            <ToggleGroup
                aria-labelledby="term-label"
                variant="outline"
                value={current ? [String(current)] : []}
                onValueChange={([years]) => years && startDate && onChange(addDays(addMonths(startDate, 12 * Number(years)), -1))}
                disabled={!startDate}
                className="w-full flex-wrap"
            >
                {terms.map((years) => (
                    <ToggleGroupItem key={years} value={String(years)} className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary">
                        {t('leasing.cheques.term.years', { count: years })}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </Field>
    );
}

function ChequeRow({ row, index, direction, isNeededNow, enforce, optional, banksId, onPatch, errors, currency }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const { entry } = row;
    const error = (field) => (index === null ? undefined : errors[`cheques.${index}.${field}`]);
    const id = (field) => `cheque-${row.key.replace(':', '-')}-${field}`;
    const isReady = isChequeReady(row);
    const label = row.purpose === 'security_deposit' ? t('leasing.cheques.purposes.security_deposit') : `#${row.sequence}`;

    if (row.locked) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-foreground/[0.06]">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <LockIcon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold">
                            {label} · {formatDate(row.chequeDate)}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {[entry.cheque_number && t('leasing.cheques.number', { number: entry.cheque_number }), entry.bank_name, t('leasing.cheques.schedule.locked')].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(row.amount, currency)}</span>
                    <ChequeStatusBadge status={entry.status} direction={direction} chequeStatus={entry.cheque_status} />
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10', isNeededNow && !isReady && enforce && 'ring-warning/40')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={cn(
                            'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-bold',
                            isReady ? 'bg-success/12 text-success' : 'bg-brand-cyan/12 text-brand-ink',
                        )}
                    >
                        {isReady ? <CircleCheckIcon className="size-4" /> : row.purpose === 'security_deposit' ? <ShieldCheckIcon className="size-4" /> : row.sequence}
                    </span>
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="text-sm font-semibold">
                            {row.purpose === 'security_deposit' ? t('leasing.cheques.purposes.security_deposit') : t('leasing.cheques.schedule.chequeNumber', { number: row.sequence })}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {row.periodStart ? t('leasing.cheques.schedule.covers', { start: formatDate(row.periodStart), end: formatDate(row.periodEnd) }) : t('leasing.cheques.schedule.depositHint')}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isNeededNow ? (
                        <Badge variant={isReady ? 'success' : 'warning'}>{isReady ? t('leasing.cheques.schedule.ready') : t('leasing.cheques.schedule.neededNow')}</Badge>
                    ) : (
                        <Badge variant="outline">{t('leasing.cheques.schedule.later')}</Badge>
                    )}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field data-invalid={error('cheque_date') ? true : undefined}>
                    <FieldLabel htmlFor={id('date')} className="text-xs">{t('leasing.cheques.fields.chequeDate')}</FieldLabel>
                    <Input id={id('date')} type="date" value={row.chequeDate} onChange={(event) => onPatch({ cheque_date: event.target.value })} aria-invalid={Boolean(error('cheque_date'))} />
                    <FieldError>{error('cheque_date')}</FieldError>
                </Field>
                <Field data-invalid={error('amount') ? true : undefined}>
                    <FieldLabel htmlFor={id('amount')} className="text-xs">{t('leasing.cheques.fields.amount')}</FieldLabel>
                    <InputGroup>
                        <InputGroupAddon>
                            <InputGroupText>{currency}</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                            id={id('amount')}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => onPatch({ amount: event.target.value })}
                            aria-invalid={Boolean(error('amount'))}
                            className="tabular-nums"
                        />
                    </InputGroup>
                    <FieldError>{error('amount')}</FieldError>
                </Field>
                <Field data-invalid={error('cheque_number') ? true : undefined}>
                    <FieldLabel htmlFor={id('number')} className="text-xs">{t('leasing.cheques.fields.number')}</FieldLabel>
                    <Input
                        id={id('number')}
                        value={entry.cheque_number}
                        onChange={(event) => onPatch({ cheque_number: event.target.value })}
                        inputMode="numeric"
                        placeholder="000123"
                        className="font-mono"
                        aria-invalid={Boolean(error('cheque_number'))}
                    />
                    <FieldError>{error('cheque_number')}</FieldError>
                </Field>
                <Field data-invalid={error('bank_name') ? true : undefined}>
                    <FieldLabel htmlFor={id('bank')} className="text-xs">{t('leasing.cheques.fields.bank')}</FieldLabel>
                    <Input
                        id={id('bank')}
                        list={banksId}
                        value={entry.bank_name}
                        onChange={(event) => onPatch({ bank_name: event.target.value })}
                        placeholder="Emirates NBD"
                        aria-invalid={Boolean(error('bank_name'))}
                    />
                    <FieldError>{error('bank_name')}</FieldError>
                </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field>
                    <FieldLabel htmlFor={id('holder')} className="text-xs">
                        {t(`leasing.cheques.fields.holder.${direction}`)}
                        <span className="font-normal text-muted-foreground">({t('propertyForm.optional')})</span>
                    </FieldLabel>
                    <Input id={id('holder')} value={entry.account_holder} onChange={(event) => onPatch({ account_holder: event.target.value })} dir="auto" />
                </Field>
                <ChequePhotoInput
                    id={id('front')}
                    label={t('leasing.cheques.fields.front')}
                    required={isNeededNow && !optional}
                    file={entry.front_image}
                    url={entry.front_image_url}
                    removed={entry.remove_front_image}
                    onFile={(file) => onPatch({ front_image: file, remove_front_image: false })}
                    onRemove={() => onPatch({ front_image: null, remove_front_image: true })}
                    error={error('front_image')}
                />
                <ChequePhotoInput
                    id={id('back')}
                    label={t('leasing.cheques.fields.back')}
                    file={entry.back_image}
                    url={entry.back_image_url}
                    removed={entry.remove_back_image}
                    onFile={(file) => onPatch({ back_image: file, remove_back_image: false })}
                    onRemove={() => onPatch({ back_image: null, remove_back_image: true })}
                    error={error('back_image')}
                />
            </div>
        </div>
    );
}

/**
 * The cheque schedule on an agreement's form, grouped by agreement year.
 * This year's cheques (and earlier ones) are needed now: their number, bank
 * and front photo; later years can wait until the cheques arrive. `rows`
 * come from scheduleRows(); `onPatch(key, patch)` updates one entry.
 * `enforce` marks whether the cheques needed now are already required (an
 * agreement in force) or only needed to activate it (a draft). `optional`
 * marks agreements whose cheques are never required, with `hint` saying so
 * in place of that explanation.
 */
export default function ChequeScheduleFields({ rows, startDate, endDate, direction, enforce, isKept, onPatch, errors, currency, banks = [], optional = false, hint }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const year = currentChequeYear(startDate, endDate);
    const banksId = 'cheque-banks';
    let submitted = -1;

    const indexed = rows.map((row) => {
        if (!row.locked) {
            submitted++;
        }

        return { row, index: row.locked ? null : submitted, year: row.purpose === 'security_deposit' ? 0 : agreementYear(startDate, row.chequeDate) };
    });

    const years = [...new Set(indexed.map((item) => item.year))].sort((a, b) => a - b);

    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('leasing.cheques.schedule.empty')}</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-brand-cyan/[0.06] px-4 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground ring-1 ring-brand-cyan/15">
                {hint ?? `${t(`leasing.cheques.schedule.requiredHint.${direction}`)} ${enforce ? '' : t('leasing.cheques.schedule.draftHint')}`}
            </p>
            {isKept && <p className="text-[0.8125rem] text-warning">{t('leasing.cheques.schedule.kept')}</p>}
            {errors.cheques && <p className="text-[0.8125rem] text-destructive">{errors.cheques}</p>}

            <datalist id={banksId}>
                {[...new Set([...banks, ...COMMON_BANKS])].map((bank) => (
                    <option key={bank} value={bank} />
                ))}
            </datalist>

            {years.map((number) => {
                const items = indexed.filter((item) => item.year === number);
                const yearStart = addMonths(startDate, 12 * number);
                const yearEnd = addDays(addMonths(startDate, 12 * (number + 1)), -1);
                const isNeededNow = year !== null && yearStart <= year.end;
                const ready = items.filter((item) => isChequeReady(item.row)).length;
                const total = items.reduce((sum, item) => sum + item.row.amount, 0);
                const hasErrors = items.some((item) => item.index !== null && Object.keys(errors).some((key) => key.startsWith(`cheques.${item.index}.`)));

                return (
                    <Collapsible key={number} defaultOpen={isNeededNow || hasErrors} className="flex flex-col gap-3">
                        <CollapsibleTrigger
                            render={
                                <button
                                    type="button"
                                    className="group/year flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-start ring-1 ring-foreground/[0.06] transition-colors hover:bg-muted"
                                />
                            }
                        >
                            <span className="flex min-w-0 items-center gap-3">
                                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/year:rotate-180" />
                                <span className="flex flex-col leading-tight">
                                    <span className="text-sm font-bold">{t('leasing.cheques.schedule.year', { number: number + 1 })}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {t('leasing.cheques.schedule.yearRange', { start: formatDate(yearStart), end: formatDate(yearEnd > endDate ? endDate : yearEnd) })}
                                    </span>
                                </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground tabular-nums">{t('leasing.cheques.schedule.cheques', { count: items.length })} · {formatMoney(total, currency)}</span>
                                {isNeededNow ? (
                                    <Badge variant={ready === items.length ? 'success' : 'warning'}>{t('leasing.cheques.schedule.readyCount', { ready, count: items.length })}</Badge>
                                ) : (
                                    <Badge variant="outline">{t('leasing.cheques.schedule.later')}</Badge>
                                )}
                            </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="flex flex-col gap-3">
                            {items.map(({ row, index }) => (
                                <ChequeRow
                                    key={row.key}
                                    row={row}
                                    index={index}
                                    direction={direction}
                                    isNeededNow={isNeededNow}
                                    enforce={enforce}
                                    optional={optional}
                                    banksId={banksId}
                                    onPatch={(patch) => onPatch(row.key, patch)}
                                    errors={errors}
                                    currency={currency}
                                />
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}
        </div>
    );
}

/**
 * The schedule at a glance, for the form's side column: how many cheques,
 * how many a year, their total and dates, and how many of this year's are ready.
 */
export function ChequePlanCard({ rows, startDate, endDate, perYear, currency }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const year = currentChequeYear(startDate, endDate);
    const rent = rows.filter((row) => row.purpose === 'rent');
    const neededNow = year ? rows.filter((row) => row.chequeDate <= year.end) : [];
    const readyNow = neededNow.filter(isChequeReady).length;
    const total = rows.reduce((sum, row) => sum + row.amount, 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('leasing.cheques.plan.title')}</CardTitle>
                <CardDescription>{t('leasing.cheques.plan.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('leasing.cheques.schedule.empty')}</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-end justify-between gap-3">
                            <div className="flex flex-col">
                                <span className="font-heading text-3xl font-bold tabular-nums">{rows.length}</span>
                                <span className="text-xs text-muted-foreground">{t('leasing.cheques.plan.perYear', { count: perYear })}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-muted-foreground">{t('leasing.cheques.plan.amount')}</span>
                                <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
                            </div>
                        </div>
                        {neededNow.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('leasing.cheques.plan.thisYear')}</span>
                                    <span className="font-semibold tabular-nums">{t('leasing.cheques.schedule.readyCount', { ready: readyNow, count: neededNow.length })}</span>
                                </div>
                                <Progress value={(readyNow / neededNow.length) * 100} aria-label={t('leasing.cheques.plan.thisYear')} />
                            </div>
                        )}
                        <dl className="flex flex-col gap-2 border-t pt-3 text-sm">
                            {rent.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">{t('leasing.cheques.plan.first')}</dt>
                                        <dd className="tabular-nums">{formatDate(rent[0].chequeDate)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">{t('leasing.cheques.plan.last')}</dt>
                                        <dd className="tabular-nums">{formatDate(rent[rent.length - 1].chequeDate)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">{t('leasing.cheques.plan.each')}</dt>
                                        <dd className="tabular-nums">{formatMoney(rent[0].amount, currency)}</dd>
                                    </div>
                                </>
                            )}
                            {rows.some((row) => row.purpose === 'security_deposit') && (
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground">{t('leasing.cheques.purposes.security_deposit')}</dt>
                                    <dd className="tabular-nums">{formatMoney(rows.find((row) => row.purpose === 'security_deposit').amount, currency)}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
