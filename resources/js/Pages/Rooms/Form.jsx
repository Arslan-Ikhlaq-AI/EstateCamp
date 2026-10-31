import { FormSection, TextField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    DoorOpenIcon,
    ImagePlusIcon,
    MinusIcon,
    PlusIcon,
    StarIcon,
    XIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import RoomCard from './Partials/RoomCard';
import { AMENITY_ICONS, defaultRoomTypeId, GENDER_ICONS, ROOM_TYPE_ICONS } from './Partials/roomOptions';

const MAX_PHOTOS = 10;

// Hides the browser's own number spinners; the steppers replace them.
const NUMBER_INPUT = 'text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function initialData(room, propertyId, roomTypes) {
    return {
        property_id: room?.property_id ?? propertyId ?? null,
        room_number: room?.room_number ?? '',
        block: room?.block ?? '',
        floor_number: room?.floor_number ?? '',
        room_type_id: room?.room_type_id ?? defaultRoomTypeId(roomTypes),
        gender_policy: room?.gender_policy ?? '',
        capacity: room?.capacity ?? 4,
        area_sqm: room?.area_sqm ?? '',
        monthly_rent: room?.monthly_rent ?? '',
        amenities: room?.amenities ?? [],
        status: room?.status ?? 'active',
        notes: room?.notes ?? '',
        photos: [],
        keep_photos: room?.photos.map((photo) => photo.id) ?? [],
    };
}

/**
 * A whole-number input with − and + buttons.
 */
function NumberStepper({ id, label, value, onChange, min, max, error, description }) {
    const { t } = useTranslation();
    const number = Number(value) || 0;

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
                <InputGroupAddon>
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={t('roomForm.decrease', { field: label })}
                        disabled={number <= min}
                        onClick={() => onChange(Math.max(min, number - 1))}
                    >
                        <MinusIcon />
                    </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    className={NUMBER_INPUT}
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={t('roomForm.increase', { field: label })}
                        disabled={number >= max}
                        onClick={() => onChange(Math.min(max, number + 1))}
                    >
                        <PlusIcon />
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * Existing photos that are kept followed by new uploads, with previews.
 * The first one is the cover.
 */
function PhotoPicker({ existing, keepIds, files, onKeepChange, onFilesChange, errors }) {
    const { t } = useTranslation();
    const fileUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

    useEffect(() => () => fileUrls.forEach((url) => URL.revokeObjectURL(url)), [fileUrls]);

    const photos = [
        ...existing
            .filter((photo) => keepIds.includes(photo.id))
            .map((photo) => ({ key: `existing-${photo.id}`, url: photo.url, remove: () => onKeepChange(keepIds.filter((id) => id !== photo.id)) })),
        ...files.map((file, index) => ({
            key: `new-${index}-${file.name}`,
            url: fileUrls[index],
            remove: () => onFilesChange(files.filter((_, position) => position !== index)),
        })),
    ];

    const photoErrors = Object.entries(errors).filter(([key]) => key.startsWith('photos'));

    return (
        <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((photo, index) => (
                    <li key={photo.key} className="group/photo relative aspect-[4/3] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                        <img src={photo.url} alt="" className="size-full object-cover" />
                        {index === 0 && (
                            <span className="absolute start-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[0.75rem] font-medium text-white backdrop-blur">
                                <StarIcon className="size-3 fill-current" />
                                {t('roomForm.photos.cover')}
                            </span>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon-xs"
                            onClick={photo.remove}
                            aria-label={t('roomForm.photos.remove')}
                            className="absolute end-2 top-2 bg-black/55 text-white backdrop-blur hover:bg-black/75"
                        >
                            <XIcon />
                        </Button>
                    </li>
                ))}
                {photos.length < MAX_PHOTOS && (
                    <li>
                        <label
                            htmlFor="room-photos"
                            className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                        >
                            <ImagePlusIcon className="size-5" />
                            {t('roomForm.photos.add')}
                            <input
                                id="room-photos"
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                    onFilesChange([...files, ...event.target.files].slice(0, MAX_PHOTOS - (photos.length - files.length)));
                                    event.target.value = '';
                                }}
                            />
                        </label>
                    </li>
                )}
            </ul>
            <p className="text-sm text-muted-foreground">{t('roomForm.photos.hint')}</p>
            {photoErrors.map(([key, message]) => (
                <FieldError key={key}>{message}</FieldError>
            ))}
        </div>
    );
}

export default function Form({ room, propertyId, currency, properties, roomTypes, statuses, genderPolicies, amenities }) {
    const { t, tOr } = useTranslation();
    const isEditing = room !== null;
    const form = useForm(initialData(room, propertyId, roomTypes));
    const { data, setData, errors, processing } = form;

    const property = properties.find((item) => item.id === data.property_id);
    const roomType = roomTypes.find((item) => item.id === data.room_type_id);
    const title = isEditing ? t('roomForm.editTitle') : t('roomForm.addTitle');
    const capacity = Math.max(Number(data.capacity) || 0, 0);
    const isOccupied = Boolean(room?.is_occupied);

    const bind = (field) => ({
        id: field,
        value: data[field],
        onChange: (value) => setData(field, value),
        error: errors[field],
    });

    const coverUrl = useMemo(() => {
        const kept = room?.photos.find((photo) => data.keep_photos.includes(photo.id));

        return kept?.url ?? (data.photos[0] ? URL.createObjectURL(data.photos[0]) : null);
    }, [room, data.keep_photos, data.photos]);

    const previewRoom = {
        number: data.room_number,
        block: data.block,
        floor: data.floor_number,
        property: property ? { name: property.name } : null,
        type: roomType?.name,
        typeSlug: roomType?.slug,
        genderPolicy: data.gender_policy || null,
        capacity,
        occupied: isOccupied,
        monthlyRent: data.monthly_rent === '' ? null : Number(data.monthly_rent) || 0,
        areaSqm: Number(data.area_sqm) || null,
        amenities: data.amenities,
        status: data.status,
        photoUrl: coverUrl,
    };

    const submit = (event) => {
        event.preventDefault();

        form.transform((values) => (isEditing ? { ...values, _method: 'put' } : values));
        form.post(isEditing ? route('rooms.update', room.id) : route('rooms.store'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const propertyItems = properties.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }));

    const actions = (
        <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={route('rooms.index')} />}>
                {t('roomForm.cancel')}
            </Button>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {isEditing ? t('roomForm.saveChanges') : t('roomForm.save')}
            </Button>
        </div>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <form onSubmit={submit} className="flex flex-1 flex-col gap-6" noValidate>
                <PageHeader
                    breadcrumbs={[
                        { label: t('nav.properties'), href: route('properties.index') },
                        { label: t('roomList.title'), href: route('rooms.index') },
                        { label: isEditing ? t('roomList.room', { number: room.room_number }) : title },
                    ]}
                    title={title}
                    description={
                        isEditing
                            ? t('roomForm.editDescription', {
                                  number: room.room_number,
                                  property: properties.find((item) => item.id === room.property_id)?.name ?? '',
                              })
                            : t('roomForm.addDescription')
                    }
                    actions={actions}
                    actionsClassName="max-sm:hidden"
                />

                <div className="grid items-start gap-6 xl:grid-cols-3">
                    <div className="flex flex-col gap-6 xl:col-span-2">
                        <FormSection
                            title={t('roomForm.sections.placement.title')}
                            description={t('roomForm.sections.placement.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-3">
                                <Field data-invalid={errors.property_id ? true : undefined} className="sm:col-span-3">
                                    <FieldLabel htmlFor="property_id">{t('roomForm.fields.property')}</FieldLabel>
                                    <Select items={propertyItems} value={data.property_id} onValueChange={(value) => setData('property_id', value)}>
                                        <SelectTrigger id="property_id" className="w-full" aria-invalid={Boolean(errors.property_id)}>
                                            <SelectValue placeholder={t('roomForm.fields.propertyPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {propertyItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <FieldError>{errors.property_id}</FieldError>
                                </Field>
                                <TextField {...bind('room_number')} label={t('roomForm.fields.roomNumber')} placeholder="101" required />
                                <TextField {...bind('block')} label={t('roomForm.fields.block')} placeholder="A" optional />
                                <TextField {...bind('floor_number')} type="number" inputMode="numeric" label={t('roomForm.fields.floor')} placeholder="1" optional />
                            </FieldGroup>
                        </FormSection>

                        <FormSection title={t('roomForm.sections.type.title')} description={t('roomForm.sections.type.description')}>
                            <ToggleGroup
                                aria-label={t('roomForm.sections.type.title')}
                                variant="outline"
                                value={[String(data.room_type_id)]}
                                onValueChange={([value]) => value && setData('room_type_id', Number(value))}
                                className="grid w-full gap-3 sm:grid-cols-3"
                            >
                                {roomTypes.map((type) => {
                                    const Icon = ROOM_TYPE_ICONS[type.slug] ?? DoorOpenIcon;

                                    return (
                                        <ToggleGroupItem
                                            key={type.id}
                                            value={String(type.id)}
                                            className="h-auto flex-col items-start gap-2 rounded-xl p-4 text-start whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:ring-1 aria-pressed:ring-primary"
                                        >
                                            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                <Icon className="size-4.5" />
                                            </span>
                                            <span className="font-semibold">{tOr(`roomTypes.${type.slug}`, type.name)}</span>
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {tOr(`roomForm.typeDescriptions.${type.slug}`, '')}
                                            </span>
                                        </ToggleGroupItem>
                                    );
                                })}
                            </ToggleGroup>
                            <FieldError>{errors.room_type_id}</FieldError>
                        </FormSection>

                        <FormSection
                            title={t('roomForm.sections.capacity.title')}
                            description={t('roomForm.sections.capacity.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <NumberStepper
                                    id="capacity"
                                    label={t('roomForm.fields.capacity')}
                                    value={data.capacity}
                                    onChange={(value) => setData('capacity', value)}
                                    min={1}
                                    max={100}
                                    error={errors.capacity}
                                />
                                {/* Whether the room is taken follows contracts, rentals and check-ins, so it is shown, not edited. */}
                                <Field>
                                    <FieldLabel htmlFor="is_occupied">{t('roomForm.fields.occupied')}</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput id="is_occupied" value={isOccupied ? t('roomList.occupied') : t('roomList.vacant')} readOnly />
                                    </InputGroup>
                                    <FieldDescription>{t('roomForm.fields.occupiedHint')}</FieldDescription>
                                </Field>
                                <Field data-invalid={errors.monthly_rent ? true : undefined}>
                                    <FieldLabel htmlFor="monthly_rent">{t('roomForm.fields.rent')}</FieldLabel>
                                    <InputGroup>
                                        <InputGroupAddon>
                                            <InputGroupText>{currency}</InputGroupText>
                                        </InputGroupAddon>
                                        <InputGroupInput
                                            id="monthly_rent"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step={50}
                                            value={data.monthly_rent}
                                            onChange={(event) => setData('monthly_rent', event.target.value)}
                                            aria-invalid={Boolean(errors.monthly_rent)}
                                            placeholder="2400"
                                            className="tabular-nums"
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>{t('roomForm.perMonth')}</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldError>{errors.monthly_rent}</FieldError>
                                </Field>
                                <Field data-invalid={errors.area_sqm ? true : undefined}>
                                    <FieldLabel htmlFor="area_sqm">{t('roomForm.fields.area')}</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            id="area_sqm"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            value={data.area_sqm}
                                            onChange={(event) => setData('area_sqm', event.target.value)}
                                            aria-invalid={Boolean(errors.area_sqm)}
                                            placeholder="24"
                                            className="tabular-nums"
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>m²</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldError>{errors.area_sqm}</FieldError>
                                </Field>
                            </FieldGroup>
                        </FormSection>

                        <FormSection title={t('roomForm.sections.rules.title')} description={t('roomForm.sections.rules.description')}>
                            <FieldGroup className="grid gap-4 md:grid-cols-2">
                                <Field>
                                    <FieldLabel id="gender-label">{t('roomForm.fields.gender')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="gender-label"
                                        variant="outline"
                                        spacing={0}
                                        value={[data.gender_policy || 'any']}
                                        onValueChange={([value]) => value && setData('gender_policy', value === 'any' ? '' : value)}
                                    >
                                        <ToggleGroupItem value="any">{t('roomForm.fields.anyGender')}</ToggleGroupItem>
                                        {genderPolicies.map((gender) => {
                                            const Icon = GENDER_ICONS[gender];

                                            return (
                                                <ToggleGroupItem key={gender} value={gender}>
                                                    <Icon data-icon="inline-start" />
                                                    {t(`gender.${gender}`)}
                                                </ToggleGroupItem>
                                            );
                                        })}
                                    </ToggleGroup>
                                    <FieldError>{errors.gender_policy}</FieldError>
                                </Field>
                                <Field>
                                    <FieldLabel id="status-label">{t('roomForm.fields.status')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="status-label"
                                        variant="outline"
                                        spacing={0}
                                        value={[data.status]}
                                        onValueChange={([value]) => value && setData('status', value)}
                                    >
                                        {statuses.map((status) => (
                                            <ToggleGroupItem key={status} value={status}>
                                                {status === 'under_maintenance' ? t('properties.status.under_maintenance') : t(`status.${status}`)}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    <FieldError>{errors.status}</FieldError>
                                </Field>
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('roomForm.sections.amenities.title')}
                            description={t('roomForm.sections.amenities.description')}
                        >
                            <ToggleGroup
                                aria-label={t('roomForm.sections.amenities.title')}
                                multiple
                                variant="outline"
                                value={data.amenities}
                                onValueChange={(values) => setData('amenities', values)}
                                className="w-full flex-wrap"
                            >
                                {amenities.map((amenity) => {
                                    const Icon = AMENITY_ICONS[amenity];

                                    return (
                                        <ToggleGroupItem
                                            key={amenity}
                                            value={amenity}
                                            className="rounded-full aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                                        >
                                            {Icon && <Icon data-icon="inline-start" />}
                                            {t(`amenities.${amenity}`)}
                                        </ToggleGroupItem>
                                    );
                                })}
                            </ToggleGroup>
                            <FieldError>{errors.amenities}</FieldError>
                        </FormSection>

                        <FormSection title={t('roomForm.sections.photos.title')} description={t('roomForm.sections.photos.description')}>
                            <PhotoPicker
                                existing={room?.photos ?? []}
                                keepIds={data.keep_photos}
                                files={data.photos}
                                onKeepChange={(ids) => setData('keep_photos', ids)}
                                onFilesChange={(files) => setData('photos', files)}
                                errors={errors}
                            />
                        </FormSection>

                        <FormSection title={t('roomForm.sections.notes.title')} description={t('roomForm.sections.notes.description')}>
                            <Field data-invalid={errors.notes ? true : undefined}>
                                <FieldLabel htmlFor="notes" className="sr-only">
                                    {t('roomForm.fields.notes')}
                                </FieldLabel>
                                <Textarea
                                    id="notes"
                                    rows={4}
                                    value={data.notes}
                                    onChange={(event) => setData('notes', event.target.value)}
                                    aria-invalid={Boolean(errors.notes)}
                                />
                                <FieldError>{errors.notes}</FieldError>
                            </Field>
                        </FormSection>
                    </div>

                    <aside className="flex flex-col gap-3 xl:sticky xl:top-22">
                        <div className="flex flex-col gap-0.5">
                            <h2 className="font-heading text-base font-medium">{t('roomForm.sections.preview.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('roomForm.sections.preview.description')}</p>
                        </div>
                        <RoomCard room={previewRoom} currency={currency} />
                    </aside>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
