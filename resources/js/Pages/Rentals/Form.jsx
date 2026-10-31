import { METHOD_ICONS, useRentalPlace } from '@/Components/FinanceBadges';
import { ChoiceField, FormSection, MoneyField, SelectField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { addMonths, todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { addDays } from '@/lib/cheques';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { Building2Icon, CheckIcon, ClockIcon, DoorOpenIcon, InfoIcon, LayersIcon, ListChecksIcon, LockIcon, MinusIcon, PlusIcon, UserIcon, WalletIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

const amount = (value) => Number.parseFloat(value) || 0;

const RENTER_ICONS = { company: Building2Icon, individual: UserIcon };

/**
 * Quick picks offered when a property has more free rooms than this.
 */
const FIRST_ROOMS = [5, 10];

/**
 * Months of the payment schedule listed beside the form; the rest are counted.
 */
const SCHEDULE_ROWS = 6;

/**
 * How many whole months the stay is, or 0 while the field is not a number.
 */
const stayMonths = (value) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0);

/**
 * The last day of a stay of `months` months from `start` (both ISO dates),
 * the way the server works it out.
 */
function stayEnd(start, months) {
    return start && months > 0 ? addDays(addMonths(start, months), -1) : null;
}

/**
 * The standard rent of the chosen rooms together, or '' when none has one.
 */
function standardRent(rooms) {
    const rents = rooms.map((room) => room.rent).filter((rent) => rent !== null);

    return rents.length > 0 ? rents.reduce((sum, rent) => sum + rent, 0) : '';
}

/**
 * The months of the stay, each with the day its rent falls due.
 */
function paymentSchedule(start, months) {
    return start ? Array.from({ length: months }, (_, index) => addMonths(start, index)) : [];
}

/**
 * What the renter pays now and month by month, and when the stay ends.
 */
function AtAGlance({ data, currency, isEdit }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const rent = amount(data.monthly_rent);
    const deposit = amount(data.security_deposit);
    const months = stayMonths(data.months);
    const endsOn = stayEnd(data.start_date, months);
    const isPaidNow = !isEdit && data.first_payment === 'now';
    const schedule = paymentSchedule(data.start_date, months);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('finance.rentals.form.summary.title')}</CardTitle>
                <CardDescription>{endsOn ? t('finance.rentals.form.summary.endsOn', { date: formatDate(endsOn) }) : t('finance.rentals.form.summary.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <dl className="flex flex-col gap-1.5 rounded-xl bg-brand-cyan/[0.06] p-4 text-sm ring-1 ring-brand-cyan/15">
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{t('finance.rentals.form.summary.firstMonth')}</dt>
                        <dd className="tabular-nums">{formatMoney(rent, currency)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{t('finance.rentals.form.deposit')}</dt>
                        <dd className="tabular-nums">{formatMoney(deposit, currency)}</dd>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 border-t border-brand-cyan/15 pt-2.5">
                        <dt className="font-medium">{isPaidNow ? t('finance.rentals.form.summary.paidNow') : t('finance.rentals.form.summary.toMoveIn')}</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums">{formatMoney(rent + deposit, currency)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{t('finance.rentals.form.summary.wholeTerm', { count: months })}</dt>
                        <dd className="tabular-nums">{formatMoney(rent * months, currency)}</dd>
                    </div>
                </dl>

                {schedule.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">{t('finance.rentals.form.summary.schedule')}</p>
                        <ol className="flex flex-col divide-y divide-border rounded-xl text-[0.8125rem] ring-1 ring-foreground/10">
                            {schedule.slice(0, SCHEDULE_ROWS).map((dueOn, index) => (
                                <li key={dueOn} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <span className="flex flex-col leading-tight">
                                        <span className="font-medium">{t('finance.rentals.form.summary.month', { count: index + 1 })}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">{t('finance.rentals.form.summary.dueOn', { date: formatDate(dueOn) })}</span>
                                    </span>
                                    <span className="flex flex-col items-end leading-tight">
                                        <span className="tabular-nums">{formatMoney(rent, currency)}</span>
                                        {index === 0 && isPaidNow && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                                <CheckIcon className="size-3" />
                                                {t('finance.rentals.form.payment.now')}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                            {schedule.length > SCHEDULE_ROWS && (
                                <li className="px-3 py-2 text-xs text-muted-foreground">{t('finance.rentals.form.summary.more', { count: schedule.length - SCHEDULE_ROWS })}</li>
                            )}
                        </ol>
                    </div>
                )}

                <ul className="flex flex-col gap-2 text-[0.8125rem] text-pretty text-muted-foreground">
                    <li>{t('finance.rentals.form.summary.grace')}</li>
                    <li>{t('finance.rentals.form.summary.partial')}</li>
                </ul>
            </CardContent>
        </Card>
    );
}

/**
 * How many months the renter stays, typed or stepped one at a time, with
 * the day the stay ends.
 */
function MonthsField({ value, onChange, max, startDate, error }) {
    const { t, formatDate } = useTranslation();
    const months = stayMonths(value);
    const endsOn = stayEnd(startDate, months);
    const step = (by) => onChange(Math.min(max, Math.max(1, (months || 1) + by)));

    return (
        <Field data-invalid={error ? true : undefined} className="sm:col-span-2">
            <FieldLabel htmlFor="months">{t('finance.rentals.form.months')}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label={t('finance.rentals.form.monthsLess')} disabled={months <= 1} onClick={() => step(-1)}>
                    <MinusIcon />
                </Button>
                <Input
                    id="months"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    className="w-20 text-center text-base font-semibold tabular-nums"
                />
                <Button type="button" variant="outline" size="icon" aria-label={t('finance.rentals.form.monthsMore')} disabled={months >= max} onClick={() => step(1)}>
                    <PlusIcon />
                </Button>
                <span className="text-sm text-muted-foreground">{t('finance.rentals.form.monthsUnit', { count: months })}</span>
            </div>
            {!error && <FieldDescription>{endsOn ? t('finance.rentals.form.monthsHint', { date: formatDate(endsOn) }) : t('finance.rentals.form.monthsEmpty')}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * A room to tap in or out of the rental.
 */
function RoomChoice({ room, isChosen, onToggle, currency }) {
    const { t, formatMoney } = useTranslation();

    return (
        <button
            type="button"
            aria-pressed={isChosen}
            onClick={onToggle}
            className={cn(
                'flex items-center gap-3 rounded-xl p-3 text-start ring-1 transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-3.5',
                isChosen ? 'bg-brand-cyan/[0.06] shadow-(--raised-shadow) ring-2 ring-brand-cyan' : 'bg-surface ring-foreground/10 hover:bg-accent',
            )}
        >
            <span
                className={cn(
                    'hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex',
                    isChosen ? 'bg-brand-cyan text-brand-navy' : 'bg-brand-cyan/10 text-brand-ink',
                )}
            >
                {isChosen ? <CheckIcon className="size-4" /> : <DoorOpenIcon className="size-4" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="flex items-center gap-1 truncate text-sm font-semibold">
                    {isChosen && <CheckIcon className="size-3.5 shrink-0 text-brand-ink sm:hidden" />}
                    {t('leasing.lines.roomName', { room: room.number })}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="block sm:inline">{t('common.sleeps', { count: room.capacity })}</span>
                    <span className="hidden sm:inline"> · </span>
                    <span className="block sm:inline">{room.rent !== null ? formatMoney(room.rent, currency) : t('finance.rentals.form.rooms.noRate')}</span>
                </span>
            </span>
        </button>
    );
}

/**
 * Buttons that choose many rooms at once: all of them, the first few, or a
 * whole floor; and one that clears the choice.
 */
function QuickPicks({ rooms, roomIds, onRoomsChange }) {
    const { t } = useTranslation();
    const floors = [...new Set(rooms.map((room) => room.floor).filter((floor) => floor !== null))].sort((a, b) => a - b);
    const pick = (picked) => onRoomsChange(picked.map((room) => room.id));
    const isPicked = (picked) => picked.length === roomIds.length && picked.every((room) => roomIds.includes(room.id));

    const options = [
        { key: 'all', label: t('finance.rentals.form.rooms.quick.all', { count: rooms.length }), rooms, icon: ListChecksIcon },
        ...FIRST_ROOMS.filter((count) => count < rooms.length).map((count) => ({
            key: `first-${count}`,
            label: t('finance.rentals.form.rooms.quick.first', { count }),
            rooms: rooms.slice(0, count),
        })),
        ...(floors.length > 1
            ? floors.map((floor) => ({
                  key: `floor-${floor}`,
                  label: floor === 0 ? t('finance.rentals.form.rooms.quick.ground') : t('finance.rentals.form.rooms.quick.floor', { floor }),
                  rooms: rooms.filter((room) => room.floor === floor),
                  icon: LayersIcon,
              }))
            : []),
    ];

    return (
        <div role="group" aria-label={t('finance.rentals.form.rooms.quick.label')} className="flex flex-wrap items-center gap-2">
            {options.map((option) => (
                <Button
                    key={option.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={isPicked(option.rooms)}
                    onClick={() => pick(option.rooms)}
                    className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                >
                    {option.icon && <option.icon data-icon="inline-start" />}
                    {option.label}
                </Button>
            ))}
            {roomIds.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onRoomsChange([])}>
                    <XIcon data-icon="inline-start" />
                    {t('finance.rentals.form.rooms.quick.clear')}
                </Button>
            )}
        </div>
    );
}

/**
 * The property's free rooms to tap, with a tab for each property and quick
 * picks for choosing many at once.
 */
function RoomPicker({ properties, propertyId, roomIds, onPropertyChange, onRoomsChange, error, currency }) {
    const { t } = useTranslation();
    const property = properties.find((item) => item.id === propertyId) ?? null;
    const toggle = (roomId) => onRoomsChange(roomIds.includes(roomId) ? roomIds.filter((id) => id !== roomId) : [...roomIds, roomId]);

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel id="property_id-label">{t('finance.rentals.form.rooms.property')}</FieldLabel>
            <div role="tablist" aria-labelledby="property_id-label" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                {properties.map((item) => {
                    const isCurrent = item.id === propertyId;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={isCurrent}
                            onClick={() => onPropertyChange(item.id)}
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
                                    {t('finance.rentals.form.rooms.free', { count: item.rooms.length })}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {property && (
                <>
                    <QuickPicks rooms={property.rooms} roomIds={roomIds} onRoomsChange={onRoomsChange} />
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
                        {property.rooms.map((room) => (
                            <RoomChoice key={room.id} room={room} isChosen={roomIds.includes(room.id)} onToggle={() => toggle(room.id)} currency={currency} />
                        ))}
                    </div>
                </>
            )}

            {roomIds.length > 0 && !error && <p className="text-sm font-medium text-brand-ink">{t('finance.rentals.form.rooms.chosen', { count: roomIds.length })}</p>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * Who rents and pays: a company or a person, one already on file or a new
 * one. A new company needs its name and phone; a new person their name,
 * phone and ID.
 */
function RenterSection({ clients, idTypes, data, setData, errors }) {
    const { t } = useTranslation();
    const type = data.client_type;
    const onFile = clients.filter((client) => client.type === type);
    const setNew = (field, value) => setData('new_client', { ...data.new_client, [field]: value });
    const bindNew = (field) => ({
        id: `new_client_${field}`,
        value: data.new_client[field],
        onChange: (value) => setNew(field, value),
        error: errors[`new_client.${field}`],
    });

    const chooseType = (nextType) =>
        setData((current) => ({
            ...current,
            client_type: nextType,
            client_mode: clients.some((client) => client.type === nextType) ? 'existing' : 'new',
            client_id: clients.find((client) => client.id === current.client_id)?.type === nextType ? current.client_id : null,
        }));

    return (
        <FormSection title={t('finance.rentals.form.renter.title')} description={t('finance.rentals.form.renter.description')}>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    id="client_type"
                    label={t('finance.rentals.form.renter.type')}
                    value={type}
                    onChange={chooseType}
                    options={['company', 'individual'].map((value) => ({ value, label: t(`leasing.partyTypes.${value}`), icon: RENTER_ICONS[value] }))}
                    description={data.client_mode === 'new' ? t(`finance.rentals.form.renter.${type}Hint`) : undefined}
                    error={errors.client_type}
                    className="sm:col-span-2"
                />
                {onFile.length > 0 && (
                    <ChoiceField
                        id="client_mode"
                        label={t(`finance.rentals.form.renter.choose.${type}`)}
                        value={data.client_mode}
                        onChange={(mode) => setData('client_mode', mode)}
                        options={[
                            { value: 'existing', label: t(`finance.rentals.form.renter.existing.${type}`), icon: RENTER_ICONS[type] },
                            { value: 'new', label: t(`finance.rentals.form.renter.new.${type}`), icon: PlusIcon },
                        ]}
                        error={errors.client_mode}
                        className="sm:col-span-2"
                    />
                )}
                {data.client_mode === 'existing' ? (
                    <SelectField
                        id="client_id"
                        label={t(`finance.rentals.form.renter.choose.${type}`)}
                        placeholder={t(`finance.rentals.form.renter.choosePlaceholder.${type}`)}
                        value={data.client_id}
                        onChange={(clientId) => setData('client_id', clientId)}
                        items={onFile.map((client) => ({
                            value: client.id,
                            label: [client.name, client.phone, type === 'individual' && client.idNumber].filter(Boolean).join(' · '),
                        }))}
                        error={errors.client_id}
                        className="sm:col-span-2"
                    />
                ) : type === 'individual' ? (
                    <>
                        <TextField {...bindNew('name')} label={t('finance.rentals.form.person.name')} dir="auto" />
                        <TextField {...bindNew('phone')} label={t('finance.rentals.form.phone')} type="tel" inputMode="tel" />
                        <ChoiceField
                            id="new_client_id_type"
                            label={t('finance.rentals.form.person.idType')}
                            value={data.new_client.id_type}
                            onChange={(idType) => setNew('id_type', idType)}
                            options={idTypes.map((idType) => ({ value: idType, label: t(`leasing.idTypes.${idType}`) }))}
                            error={errors['new_client.id_type']}
                        />
                        <TextField {...bindNew('id_number')} label={t('finance.rentals.form.person.idNumber')} inputClassName="font-mono" />
                        <TextField {...bindNew('nationality')} label={t('finance.rentals.form.person.nationality')} dir="auto" optional />
                        <TextField {...bindNew('email')} label={t('finance.rentals.form.email')} type="email" optional />
                    </>
                ) : (
                    <>
                        <TextField {...bindNew('name')} label={t('finance.rentals.form.company.name')} dir="auto" />
                        <TextField {...bindNew('phone')} label={t('finance.rentals.form.phone')} type="tel" inputMode="tel" />
                        <TextField {...bindNew('contact_person_name')} label={t('finance.rentals.form.contact')} dir="auto" optional />
                        <TextField {...bindNew('email')} label={t('finance.rentals.form.email')} type="email" optional />
                        <TextField {...bindNew('trade_license_number')} label={t('finance.rentals.form.company.license')} inputClassName="font-mono" optional />
                        <TextField
                            {...bindNew('tax_registration_number')}
                            label={t('finance.rentals.form.company.trn')}
                            inputMode="numeric"
                            inputClassName="font-mono"
                            description={t('finance.rentals.form.company.trnHint')}
                            optional
                        />
                        <TextField {...bindNew('address')} label={t('finance.rentals.form.company.address')} dir="auto" optional className="sm:col-span-2" />
                    </>
                )}
            </FieldGroup>
        </FormSection>
    );
}

/**
 * Rent whole rooms to a company or a person for a stay of some months
 * without a contract, paid month by month with the first month paid now
 * unless left for later; or change a running rental's stay, start, rent and
 * deposit.
 */
export default function Form({ rental, currency, defaults, clients, idTypes, properties, maxMonths, paymentMethods, banks }) {
    const { t, formatMoney } = useTranslation();
    const place = useRentalPlace();
    const isEdit = rental !== null;
    const initialType = defaults?.client_type ?? 'company';
    const [rentTyped, setRentTyped] = useState(isEdit);

    const form = useForm(
        isEdit
            ? { ...rental.form, security_deposit: rental.form.security_deposit || '' }
            : {
                  client_type: initialType,
                  client_mode: clients.some((client) => client.type === initialType) ? 'existing' : 'new',
                  client_id: defaults?.client_id ?? null,
                  new_client: {
                      name: '',
                      phone: '',
                      contact_person_name: '',
                      email: '',
                      trade_license_number: '',
                      tax_registration_number: '',
                      id_type: idTypes[0] ?? null,
                      id_number: '',
                      nationality: '',
                      address: '',
                  },
                  property_id: defaults?.property_id ?? properties[0]?.id ?? null,
                  room_ids: defaults?.room_ids ?? [],
                  months: 1,
                  start_date: todayIso(),
                  monthly_rent: standardRent(properties.flatMap((property) => property.rooms).filter((room) => defaults?.room_ids?.includes(room.id))),
                  security_deposit: '',
                  first_payment: 'now',
                  payment_method: paymentMethods[0] ?? null,
                  payment_reference: '',
                  cheque_number: '',
                  deposit_cheque_number: '',
                  bank_name: '',
                  cheque_date: todayIso(),
              },
    );
    const { data, setData, errors, processing } = form;
    const title = isEdit ? t('finance.rentals.form.editTitle', { number: rental.number }) : t('finance.rentals.form.title');
    const rooms = properties.find((property) => property.id === data.property_id)?.rooms ?? [];
    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });
    const roomsError = errors.room_ids ?? Object.entries(errors).find(([key]) => key.startsWith('room_ids.'))?.[1];
    const chosenRent = standardRent(rooms.filter((room) => data.room_ids.includes(room.id)));
    const paidNow = amount(data.monthly_rent) + amount(data.security_deposit);
    const hasDeposit = amount(data.security_deposit) > 0;
    const isPaidByCheque = data.payment_method === 'cheque';

    const chooseRooms = (roomIds) =>
        setData((current) => ({
            ...current,
            room_ids: roomIds,
            monthly_rent: rentTyped ? current.monthly_rent : standardRent(rooms.filter((room) => roomIds.includes(room.id))),
        }));

    const chooseProperty = (propertyId) => setData((current) => ({ ...current, property_id: propertyId, room_ids: [], monthly_rent: rentTyped ? current.monthly_rent : '' }));

    const typeRent = (value) => {
        setRentTyped(true);
        setData('monthly_rent', value);
    };

    const submit = () => (isEdit ? form.put(route('rentals.update', rental.id)) : form.post(route('rentals.store')));

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('finance.rentals.title'), href: route('rentals.index') }, { label: title }]}
                title={title}
                description={isEdit ? [rental.tenant?.name, place(rental), rental.property?.name].filter(Boolean).join(' · ') : t('finance.rentals.form.description')}
                cancelHref={isEdit ? route('rentals.show', rental.id) : route('rentals.index')}
                submitLabel={isEdit ? t('finance.rentals.form.saveChanges') : t('finance.rentals.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<AtAGlance data={data} currency={currency} isEdit={isEdit} />}
            >
                {!isEdit && <RenterSection clients={clients} idTypes={idTypes} data={data} setData={setData} errors={errors} />}

                {!isEdit && (
                    <FormSection title={t('finance.rentals.form.rooms.title')} description={t('finance.rentals.form.rooms.description')}>
                        {properties.length === 0 ? (
                            <Alert>
                                <InfoIcon />
                                <AlertDescription>{t('finance.rentals.form.rooms.none')}</AlertDescription>
                            </Alert>
                        ) : (
                            <RoomPicker
                                properties={properties}
                                propertyId={data.property_id}
                                roomIds={data.room_ids}
                                onPropertyChange={chooseProperty}
                                onRoomsChange={chooseRooms}
                                error={errors.property_id ?? roomsError}
                                currency={currency}
                            />
                        )}
                    </FormSection>
                )}

                <FormSection title={t('finance.rentals.form.terms.title')} description={t('finance.rentals.form.terms.description')}>
                    {isEdit && !rental.canChangeRent && (
                        <Alert className="mb-4">
                            <LockIcon />
                            <AlertDescription>{t('finance.rentals.form.terms.locked')}</AlertDescription>
                        </Alert>
                    )}
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} type="date" label={t('finance.rentals.form.startDate')} disabled={isEdit && !rental.canChangeRent} />
                        <MonthsField value={data.months} onChange={(months) => setData('months', months)} max={maxMonths} startDate={data.start_date} error={errors.months} />
                        <MoneyField
                            {...bind('monthly_rent')}
                            onChange={typeRent}
                            label={t('finance.rentals.form.monthlyRent')}
                            currency={currency}
                            suffix={t('finance.rentals.form.perMonth')}
                            description={chosenRent !== '' ? t('finance.rentals.form.rentHint', { amount: formatMoney(chosenRent, currency) }) : undefined}
                        />
                        <MoneyField {...bind('security_deposit')} label={t('finance.rentals.form.deposit')} currency={currency} optional placeholder="0" />
                    </FieldGroup>
                </FormSection>

                {!isEdit && (
                    <FormSection title={t('finance.rentals.form.payment.title')} description={t('finance.rentals.form.payment.description')}>
                        <FieldGroup className="grid gap-4 sm:grid-cols-2">
                            <ChoiceField
                                id="first_payment"
                                label={t('finance.rentals.form.payment.when')}
                                value={data.first_payment}
                                onChange={(when) => setData('first_payment', when)}
                                options={[
                                    { value: 'now', label: t('finance.rentals.form.payment.now'), icon: WalletIcon },
                                    { value: 'later', label: t('finance.rentals.form.payment.later'), icon: ClockIcon },
                                ]}
                                description={
                                    data.first_payment === 'now'
                                        ? t(`finance.rentals.form.payment.${isPaidByCheque ? 'cheque' : 'paid'}${hasDeposit ? 'WithDeposit' : 'RentOnly'}`, { amount: formatMoney(paidNow, currency) })
                                        : t('finance.rentals.form.payment.laterHint')
                                }
                                error={errors.first_payment}
                                className="sm:col-span-2"
                            />
                            {data.first_payment === 'now' && (
                                <>
                                    <ChoiceField
                                        id="payment_method"
                                        label={t('finance.rentals.payment.method')}
                                        value={data.payment_method}
                                        onChange={(method) => setData('payment_method', method)}
                                        options={paymentMethods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`), icon: METHOD_ICONS[method] }))}
                                        description={isPaidByCheque ? t('finance.rentals.form.payment.chequeHint') : undefined}
                                        error={errors.payment_method}
                                        className="sm:col-span-2"
                                    />
                                    {isPaidByCheque ? (
                                        <>
                                            <TextField
                                                {...bind('cheque_number')}
                                                label={hasDeposit ? t('finance.rentals.form.payment.rentChequeNumber') : t('leasing.cheques.fields.number')}
                                                inputClassName="font-mono"
                                                inputMode="numeric"
                                            />
                                            {hasDeposit && (
                                                <TextField
                                                    {...bind('deposit_cheque_number')}
                                                    label={t('finance.rentals.form.payment.depositChequeNumber')}
                                                    inputClassName="font-mono"
                                                    inputMode="numeric"
                                                />
                                            )}
                                            <TextField {...bind('bank_name')} label={t('leasing.cheques.fields.bank')} list="rental-cheque-banks" />
                                            <TextField {...bind('cheque_date')} type="date" label={t('leasing.cheques.fields.chequeDate')} />
                                            <datalist id="rental-cheque-banks">
                                                {banks.map((bank) => (
                                                    <option key={bank} value={bank} />
                                                ))}
                                            </datalist>
                                        </>
                                    ) : (
                                        <TextField
                                            {...bind('payment_reference')}
                                            label={t('finance.rentals.payment.reference')}
                                            placeholder={t('finance.rentals.form.payment.referencePlaceholder')}
                                            optional
                                            className="sm:col-span-2"
                                        />
                                    )}
                                </>
                            )}
                        </FieldGroup>
                    </FormSection>
                )}
            </FormShell>
        </DashboardLayout>
    );
}
