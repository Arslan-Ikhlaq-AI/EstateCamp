import { useRentalPlace } from '@/Components/FinanceBadges';
import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { BedSingleIcon, DoorClosedIcon, InfoIcon, LockIcon, MarsIcon, UserPlusIcon, UsersIcon, VenusIcon } from 'lucide-react';

const amount = (value) => Number.parseFloat(value) || 0;

/**
 * The rent a room suggests: its rate per bed, times its beds for a whole room.
 */
function suggestedRent(room, unitType) {
    if (!room?.rentPerBed) {
        return '';
    }

    return unitType === 'room' ? room.rentPerBed * room.capacity : room.rentPerBed;
}

/**
 * What the tenant pays to move in, and how the rent works from then on.
 */
function MoveInSummary({ data, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const rent = amount(data.monthly_rent);
    const deposit = amount(data.security_deposit);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('finance.rentals.form.summary.title')}</CardTitle>
                <CardDescription>{t('finance.rentals.form.summary.description')}</CardDescription>
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
                        <dt className="font-medium">{t('finance.rentals.form.summary.toMoveIn')}</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums">{formatMoney(rent + deposit, currency)}</dd>
                    </div>
                </dl>
                <ul className="flex flex-col gap-2 text-[0.8125rem] text-pretty text-muted-foreground">
                    <li>{data.start_date ? t('finance.rentals.form.summary.dueEach', { date: formatDate(data.start_date) }) : t('finance.rentals.form.summary.dueMonthly')}</li>
                    <li>{t('finance.rentals.form.summary.grace')}</li>
                    <li>{t('finance.rentals.form.summary.partial')}</li>
                </ul>
            </CardContent>
        </Card>
    );
}

/**
 * Rent a bed or a whole room to an individual without a contract, or
 * change a running rental's terms.
 */
export default function Form({ rental, currency, defaults, tenants, rooms, idTypes }) {
    const { t } = useTranslation();
    const place = useRentalPlace();
    const isEdit = rental !== null;
    const initialRoom = rooms.find((room) => room.id === defaults?.room_id) ?? null;
    const initialTenant = tenants.find((tenant) => tenant.id === defaults?.client_id) ?? null;

    const form = useForm(
        isEdit
            ? { ...rental.form, end_date: rental.form.end_date ?? '', notes: rental.form.notes ?? '', security_deposit: rental.form.security_deposit || '' }
            : {
                  client_mode: tenants.length > 0 ? 'existing' : 'new',
                  client_id: initialTenant?.id ?? null,
                  new_client: { name: '', phone: '', email: '', nationality: '', id_type: idTypes[0], id_number: '' },
                  gender: initialTenant?.gender ?? (initialRoom?.genderPolicy === 'female' ? 'female' : 'male'),
                  room_id: initialRoom?.id ?? null,
                  unit_type: 'bed',
                  bed_id: initialRoom?.beds[0]?.id ?? null,
                  monthly_rent: suggestedRent(initialRoom, 'bed'),
                  security_deposit: '',
                  start_date: todayIso(),
                  end_date: '',
                  notes: '',
              },
    );
    const { data, setData, errors, processing } = form;
    const title = isEdit ? t('finance.rentals.form.editTitle', { number: rental.number }) : t('finance.rentals.form.title');
    const room = rooms.find((candidate) => candidate.id === data.room_id) ?? null;
    const tenant = tenants.find((candidate) => candidate.id === data.client_id) ?? null;
    const genderLocked = !isEdit && data.client_mode === 'existing' && Boolean(tenant?.gender);
    const bindNew = (field) => ({
        id: `new_client_${field}`,
        value: data.new_client[field],
        onChange: (value) => setData('new_client', { ...data.new_client, [field]: value }),
        error: errors[`new_client.${field}`],
    });
    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const chooseRoom = (roomId) => {
        const next = rooms.find((candidate) => candidate.id === roomId);
        const unitType = data.unit_type === 'room' && next?.canRentWhole ? 'room' : 'bed';

        setData((current) => ({
            ...current,
            room_id: roomId,
            unit_type: unitType,
            bed_id: next?.beds[0]?.id ?? null,
            monthly_rent: suggestedRent(next, unitType) || current.monthly_rent,
            gender: genderLocked ? current.gender : next?.genderPolicy === 'female' ? 'female' : next?.genderPolicy === 'male' ? 'male' : current.gender,
        }));
    };

    const chooseUnit = (unitType) => setData((current) => ({ ...current, unit_type: unitType, monthly_rent: suggestedRent(room, unitType) || current.monthly_rent }));

    const chooseTenant = (clientId) => {
        const next = tenants.find((candidate) => candidate.id === clientId);

        setData((current) => ({ ...current, client_id: clientId, gender: next?.gender ?? current.gender }));
    };

    const submit = () => (isEdit ? form.put(route('rentals.update', rental.id)) : form.post(route('rentals.store')));

    const roomItems = rooms.map((candidate) => ({
        value: candidate.id,
        label: `${candidate.property.name} · ${t('finance.rentals.form.roomOption', { room: candidate.number, count: candidate.beds.length })}`,
    }));

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('finance.rentals.title'), href: route('rentals.index') }, { label: title }]}
                title={title}
                description={isEdit ? `${rental.tenant?.name ?? ''} · ${place(rental)} · ${rental.property?.name ?? ''}` : t('finance.rentals.form.description')}
                cancelHref={isEdit ? route('rentals.show', rental.id) : route('rentals.index')}
                submitLabel={isEdit ? t('finance.rentals.form.saveChanges') : t('finance.rentals.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<MoveInSummary data={data} currency={currency} />}
            >
                {!isEdit && (
                    <FormSection title={t('finance.rentals.form.tenant.title')} description={t('finance.rentals.form.tenant.description')}>
                        <FieldGroup className="grid gap-4 sm:grid-cols-2">
                            <ChoiceField
                                id="client_mode"
                                label={t('finance.rentals.form.tenant.who')}
                                value={data.client_mode}
                                onChange={(mode) => setData('client_mode', mode)}
                                options={[
                                    { value: 'existing', label: t('finance.rentals.form.tenant.existing'), icon: UsersIcon },
                                    { value: 'new', label: t('finance.rentals.form.tenant.new'), icon: UserPlusIcon },
                                ]}
                                error={errors.client_mode}
                                className="sm:col-span-2"
                            />
                            {data.client_mode === 'existing' ? (
                                <SelectField
                                    id="client_id"
                                    label={t('finance.rentals.form.tenant.choose')}
                                    placeholder={tenants.length > 0 ? t('finance.rentals.form.tenant.choosePlaceholder') : t('finance.rentals.form.tenant.none')}
                                    value={data.client_id}
                                    onChange={chooseTenant}
                                    items={tenants.map((candidate) => ({ value: candidate.id, label: [candidate.name, candidate.phone].filter(Boolean).join(' · ') }))}
                                    description={t('finance.rentals.form.tenant.chooseHint')}
                                    error={errors.client_id}
                                    disabled={tenants.length === 0}
                                    className="sm:col-span-2"
                                />
                            ) : (
                                <>
                                    <TextField {...bindNew('name')} label={t('finance.rentals.form.name')} dir="auto" className="sm:col-span-2" />
                                    <TextField {...bindNew('phone')} label={t('finance.rentals.form.phone')} type="tel" inputMode="tel" />
                                    <TextField {...bindNew('email')} label={t('finance.rentals.form.email')} type="email" optional />
                                    <SelectField
                                        {...bindNew('id_type')}
                                        label={t('finance.rentals.form.idType')}
                                        items={idTypes.map((type) => ({ value: type, label: t(`leasing.idTypes.${type}`) }))}
                                    />
                                    <TextField {...bindNew('id_number')} label={t('finance.rentals.form.idNumber')} inputClassName="font-mono" />
                                    <TextField {...bindNew('nationality')} label={t('finance.rentals.form.nationality')} optional />
                                </>
                            )}
                            <ChoiceField
                                id="gender"
                                label={t('finance.rentals.form.gender')}
                                value={data.gender}
                                onChange={(gender) => !genderLocked && setData('gender', gender)}
                                options={[
                                    { value: 'male', label: t('finance.rentals.form.genders.male'), icon: genderLocked && data.gender === 'male' ? LockIcon : MarsIcon },
                                    { value: 'female', label: t('finance.rentals.form.genders.female'), icon: genderLocked && data.gender === 'female' ? LockIcon : VenusIcon },
                                ]}
                                description={genderLocked ? t('finance.rentals.form.genderOnFile') : t('finance.rentals.form.genderHint')}
                                error={errors.gender}
                                className={data.client_mode === 'new' ? undefined : 'sm:col-span-2'}
                            />
                        </FieldGroup>
                    </FormSection>
                )}

                {!isEdit && (
                    <FormSection title={t('finance.rentals.form.room.title')} description={t('finance.rentals.form.room.description')}>
                        {rooms.length === 0 ? (
                            <Alert>
                                <InfoIcon />
                                <AlertDescription>{t('finance.rentals.form.room.none')}</AlertDescription>
                            </Alert>
                        ) : (
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <SelectField
                                    id="room_id"
                                    label={t('finance.rentals.form.room.room')}
                                    placeholder={t('finance.rentals.form.room.choose')}
                                    value={data.room_id}
                                    onChange={chooseRoom}
                                    items={roomItems}
                                    error={errors.room_id}
                                    className="sm:col-span-2"
                                    description={
                                        room?.genderPolicy && room.genderPolicy !== 'mixed'
                                            ? t(`finance.rentals.form.room.policy.${room.genderPolicy}`)
                                            : room
                                              ? t('finance.rentals.form.room.policy.mixed')
                                              : undefined
                                    }
                                />
                                {room && (
                                    <>
                                        <ChoiceField
                                            id="unit_type"
                                            label={t('finance.rentals.form.room.what')}
                                            value={data.unit_type}
                                            onChange={(unitType) => (unitType === 'bed' || room.canRentWhole) && chooseUnit(unitType)}
                                            options={[
                                                { value: 'bed', label: t('finance.rentals.units.bed'), icon: BedSingleIcon },
                                                ...(room.canRentWhole ? [{ value: 'room', label: t('finance.rentals.units.room'), icon: DoorClosedIcon }] : []),
                                            ]}
                                            description={room.canRentWhole ? t('finance.rentals.form.room.wholeHint') : t('finance.rentals.form.room.wholeUnavailable')}
                                            error={errors.unit_type}
                                        />
                                        <SelectField
                                            id="bed_id"
                                            label={data.unit_type === 'room' ? t('finance.rentals.form.room.sleepsIn') : t('finance.rentals.form.room.bed')}
                                            value={data.bed_id}
                                            onChange={(bedId) => setData('bed_id', bedId)}
                                            items={room.beds.map((bed) => ({ value: bed.id, label: t('finance.rentals.form.room.bedOption', { bed: bed.label }) }))}
                                            error={errors.bed_id}
                                        />
                                    </>
                                )}
                            </FieldGroup>
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
                        <MoneyField
                            {...bind('monthly_rent')}
                            label={t('finance.rentals.form.monthlyRent')}
                            currency={currency}
                            suffix={t('finance.rentals.form.perMonth')}
                            description={room?.rentPerBed ? t('finance.rentals.form.rentHint', { amount: room.rentPerBed }) : undefined}
                        />
                        <MoneyField {...bind('security_deposit')} label={t('finance.rentals.form.deposit')} currency={currency} optional placeholder="0" />
                        <TextField {...bind('start_date')} type="date" label={t('finance.rentals.form.startDate')} disabled={isEdit && !rental.canChangeRent} />
                        <TextField {...bind('end_date')} type="date" label={t('finance.rentals.form.endDate')} min={data.start_date} optional description={t('finance.rentals.form.endDateHint')} />
                        <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
