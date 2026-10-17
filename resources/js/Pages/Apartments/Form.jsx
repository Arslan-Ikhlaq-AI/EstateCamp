import { FormSection, TextField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import {
    InputGroup,
    InputGroupAddon,
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
import ApartmentCard from './Partials/ApartmentCard';
import NumberStepper from './Partials/NumberStepper';
import { AMENITY_ICONS, FURNISHING_ICONS, STATUS_ICONS } from './Partials/apartmentOptions';

function initialData(apartment, propertyId) {
    return {
        property_id: apartment?.property_id ?? propertyId ?? null,
        apartment_number: apartment?.apartment_number ?? '',
        block: apartment?.block ?? '',
        floor_number: apartment?.floor_number ?? '',
        bedrooms: apartment?.bedrooms ?? 1,
        bathrooms: apartment?.bathrooms ?? 1,
        area_sqm: apartment?.area_sqm ?? '',
        furnishing_status: apartment?.furnishing_status ?? '',
        max_occupants: apartment?.max_occupants ?? '',
        amenities: apartment?.amenities ?? [],
        monthly_rent: apartment?.monthly_rent ?? '',
        security_deposit: apartment?.security_deposit ?? '',
        utility_account_number: apartment?.utility_account_number ?? '',
        status: apartment?.status ?? 'vacant',
        notes: apartment?.notes ?? '',
    };
}

function MoneyField({ id, label, value, onChange, error, currency, placeholder, suffix }) {
    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
                <InputGroupAddon>
                    <InputGroupText>{currency}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={50}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    placeholder={placeholder}
                    className="tabular-nums"
                />
                {suffix && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupText>{suffix}</InputGroupText>
                    </InputGroupAddon>
                )}
            </InputGroup>
            <FieldError>{error}</FieldError>
        </Field>
    );
}

function RentSummary({ rent, deposit, currency }) {
    const { t, formatCurrency } = useTranslation();
    const rows = [
        { label: t('apartmentForm.annual'), value: rent * 12, note: t('apartmentForm.annualNote') },
        { label: t('apartmentForm.moveIn'), value: rent + deposit, note: t('apartmentForm.moveInNote') },
    ];

    return (
        <dl className="grid grid-cols-2 gap-3">
            {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-0.5 rounded-lg bg-muted/60 p-3">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="text-base font-semibold tabular-nums">{formatCurrency(row.value, currency)}</dd>
                    <dd className="text-xs text-muted-foreground">{row.note}</dd>
                </div>
            ))}
        </dl>
    );
}

export default function Form({ apartment, propertyId, currency, properties, statuses, furnishingStatuses, amenities }) {
    const { t } = useTranslation();
    const isEditing = apartment !== null;
    const form = useForm(initialData(apartment, propertyId));
    const { data, setData, errors, processing } = form;

    const property = properties.find((item) => item.id === data.property_id);
    const title = isEditing ? t('apartmentForm.editTitle') : t('apartmentForm.addTitle');
    const rent = Number(data.monthly_rent) || 0;
    const deposit = Number(data.security_deposit) || 0;

    const bind = (field) => ({
        id: field,
        value: data[field],
        onChange: (value) => setData(field, value),
        error: errors[field],
    });

    const previewApartment = {
        number: data.apartment_number,
        block: data.block,
        floor: data.floor_number,
        property: property ? { name: property.name } : null,
        bedrooms: Number(data.bedrooms) || 0,
        bathrooms: Number(data.bathrooms) || 0,
        areaSqm: Number(data.area_sqm) || null,
        furnishing: data.furnishing_status || null,
        amenities: data.amenities,
        monthlyRent: data.monthly_rent === '' ? null : rent,
        status: data.status,
    };

    const submit = (event) => {
        event.preventDefault();

        if (isEditing) {
            form.put(route('apartments.update', apartment.id), { preserveScroll: true });
        } else {
            form.post(route('apartments.store'), { preserveScroll: true });
        }
    };

    const propertyItems = properties.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }));
    const cancelHref = isEditing ? route('apartments.show', apartment.id) : route('apartments.index');

    const actions = (
        <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
                {t('apartmentForm.cancel')}
            </Button>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {isEditing ? t('apartmentForm.saveChanges') : t('apartmentForm.save')}
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
                        { label: t('apartmentList.title'), href: route('apartments.index') },
                        { label: isEditing ? t('apartmentList.apartment', { number: apartment.apartment_number }) : title },
                    ]}
                    title={title}
                    description={
                        isEditing
                            ? t('apartmentForm.editDescription', {
                                  number: apartment.apartment_number,
                                  property: properties.find((item) => item.id === apartment.property_id)?.name ?? '',
                              })
                            : t('apartmentForm.addDescription')
                    }
                    actions={actions}
                    actionsClassName="max-sm:hidden"
                />

                <div className="grid items-start gap-6 xl:grid-cols-3">
                    <div className="flex flex-col gap-6 xl:col-span-2">
                        <FormSection
                            title={t('apartmentForm.sections.placement.title')}
                            description={t('apartmentForm.sections.placement.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-3">
                                <Field data-invalid={errors.property_id ? true : undefined} className="sm:col-span-3">
                                    <FieldLabel htmlFor="property_id">{t('apartmentForm.fields.property')}</FieldLabel>
                                    <Select items={propertyItems} value={data.property_id} onValueChange={(value) => setData('property_id', value)}>
                                        <SelectTrigger id="property_id" className="w-full" aria-invalid={Boolean(errors.property_id)}>
                                            <SelectValue placeholder={t('apartmentForm.fields.propertyPlaceholder')} />
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
                                <TextField {...bind('apartment_number')} label={t('apartmentForm.fields.apartmentNumber')} placeholder="B-301" required />
                                <TextField {...bind('block')} label={t('apartmentForm.fields.block')} placeholder="B" optional />
                                <TextField {...bind('floor_number')} type="number" inputMode="numeric" label={t('apartmentForm.fields.floor')} placeholder="3" optional />
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('apartmentForm.sections.layout.title')}
                            description={t('apartmentForm.sections.layout.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <NumberStepper
                                    id="bedrooms"
                                    label={t('apartmentForm.fields.bedrooms')}
                                    description={Number(data.bedrooms) === 0 ? t('apartmentForm.studioHint') : undefined}
                                    value={data.bedrooms}
                                    onChange={(value) => setData('bedrooms', value)}
                                    min={0}
                                    max={20}
                                    error={errors.bedrooms}
                                />
                                <NumberStepper
                                    id="bathrooms"
                                    label={t('apartmentForm.fields.bathrooms')}
                                    value={data.bathrooms}
                                    onChange={(value) => setData('bathrooms', value)}
                                    min={0}
                                    max={20}
                                    error={errors.bathrooms}
                                />
                                <Field data-invalid={errors.area_sqm ? true : undefined}>
                                    <FieldLabel htmlFor="area_sqm">{t('apartmentForm.fields.area')}</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            id="area_sqm"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            value={data.area_sqm}
                                            onChange={(event) => setData('area_sqm', event.target.value)}
                                            aria-invalid={Boolean(errors.area_sqm)}
                                            placeholder="52"
                                            className="tabular-nums"
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>m²</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldError>{errors.area_sqm}</FieldError>
                                </Field>
                                <TextField
                                    {...bind('max_occupants')}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    label={t('apartmentForm.fields.maxOccupants')}
                                    placeholder="2"
                                    optional
                                />
                                <Field className="sm:col-span-2" data-invalid={errors.furnishing_status ? true : undefined}>
                                    <FieldLabel id="furnishing-label">{t('apartmentForm.fields.furnishing')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="furnishing-label"
                                        variant="outline"
                                        spacing={0}
                                        value={[data.furnishing_status || 'none']}
                                        onValueChange={([value]) => value && setData('furnishing_status', value === 'none' ? '' : value)}
                                    >
                                        <ToggleGroupItem value="none">{t('apartmentForm.fields.notSet')}</ToggleGroupItem>
                                        {furnishingStatuses.map((furnishing) => {
                                            const Icon = FURNISHING_ICONS[furnishing];

                                            return (
                                                <ToggleGroupItem key={furnishing} value={furnishing}>
                                                    {Icon && <Icon data-icon="inline-start" />}
                                                    {t(`furnishing.${furnishing}`)}
                                                </ToggleGroupItem>
                                            );
                                        })}
                                    </ToggleGroup>
                                    <FieldError>{errors.furnishing_status}</FieldError>
                                </Field>
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('apartmentForm.sections.pricing.title')}
                            description={t('apartmentForm.sections.pricing.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <MoneyField
                                    {...bind('monthly_rent')}
                                    label={t('apartmentForm.fields.rent')}
                                    currency={currency}
                                    placeholder="5000"
                                    suffix={t('apartmentForm.perMonth')}
                                />
                                <MoneyField
                                    {...bind('security_deposit')}
                                    label={t('apartmentForm.fields.deposit')}
                                    currency={currency}
                                    placeholder="2500"
                                />
                                <TextField
                                    {...bind('utility_account_number')}
                                    label={t('apartmentForm.fields.utilityAccount')}
                                    description={t('apartmentForm.fields.utilityAccountHint')}
                                    className="sm:col-span-2"
                                    optional
                                />
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('apartmentForm.sections.status.title')}
                            description={t('apartmentForm.sections.status.description')}
                        >
                            <Field data-invalid={errors.status ? true : undefined}>
                                <FieldLabel id="status-label" className="sr-only">
                                    {t('apartmentForm.fields.status')}
                                </FieldLabel>
                                <ToggleGroup
                                    aria-labelledby="status-label"
                                    variant="outline"
                                    value={[data.status]}
                                    onValueChange={([value]) => value && setData('status', value)}
                                    className="w-full flex-wrap"
                                >
                                    {statuses.map((status) => {
                                        const Icon = STATUS_ICONS[status];

                                        return (
                                            <ToggleGroupItem
                                                key={status}
                                                value={status}
                                                className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                                            >
                                                {Icon && <Icon data-icon="inline-start" />}
                                                {t(`apartmentStatus.${status}`)}
                                            </ToggleGroupItem>
                                        );
                                    })}
                                </ToggleGroup>
                                <FieldError>{errors.status}</FieldError>
                            </Field>
                        </FormSection>

                        <FormSection
                            title={t('apartmentForm.sections.amenities.title')}
                            description={t('apartmentForm.sections.amenities.description')}
                        >
                            <ToggleGroup
                                aria-label={t('apartmentForm.sections.amenities.title')}
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
                                            {t(`apartmentAmenities.${amenity}`)}
                                        </ToggleGroupItem>
                                    );
                                })}
                            </ToggleGroup>
                            <FieldError>{errors.amenities}</FieldError>
                        </FormSection>

                        <FormSection title={t('apartmentForm.sections.notes.title')} description={t('apartmentForm.sections.notes.description')}>
                            <Field data-invalid={errors.notes ? true : undefined}>
                                <FieldLabel htmlFor="notes" className="sr-only">
                                    {t('apartmentForm.fields.notes')}
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
                            <h2 className="font-heading text-base font-medium">{t('apartmentForm.sections.preview.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('apartmentForm.sections.preview.description')}</p>
                        </div>
                        <ApartmentCard apartment={previewApartment} currency={currency} />
                        <RentSummary rent={rent} deposit={deposit} currency={currency} />
                    </aside>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
