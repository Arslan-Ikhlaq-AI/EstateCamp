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
import { TagIcon } from 'lucide-react';
import ShopCard from './Partials/ShopCard';
import {
    AMENITY_ICONS,
    STATUS_ICONS,
    TYPE_ICONS,
    useShopTypeLabel,
} from './Partials/shopOptions';

function initialData(shop, propertyId) {
    return {
        property_id: shop?.property_id ?? propertyId ?? null,
        shop_number: shop?.shop_number ?? '',
        block: shop?.block ?? '',
        // New shops start on the ground floor; an existing shop keeps whatever it has, even if blank.
        floor_number: shop ? (shop.floor_number ?? '') : 0,
        shop_type: shop?.shop_type ?? '',
        area_sqm: shop?.area_sqm ?? '',
        amenities: shop?.amenities ?? [],
        monthly_rent: shop?.monthly_rent ?? '',
        security_deposit: shop?.security_deposit ?? '',
        utility_account_number: shop?.utility_account_number ?? '',
        status: shop?.status ?? 'vacant',
        notes: shop?.notes ?? '',
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
        { label: t('shopForm.annual'), value: rent * 12, note: t('shopForm.annualNote') },
        { label: t('shopForm.moveIn'), value: rent + deposit, note: t('shopForm.moveInNote') },
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

export default function Form({ shop, propertyId, currency, properties, statuses, types, amenities }) {
    const { t } = useTranslation();
    const typeLabel = useShopTypeLabel();
    const isEditing = shop !== null;
    const form = useForm(initialData(shop, propertyId));
    const { data, setData, errors, processing } = form;

    const property = properties.find((item) => item.id === data.property_id);
    const title = isEditing ? t('shopForm.editTitle') : t('shopForm.addTitle');
    const rent = Number(data.monthly_rent) || 0;
    const deposit = Number(data.security_deposit) || 0;

    // A shop saved with a type outside the suggestions keeps it as a choice.
    const typeOptions = data.shop_type && !types.includes(data.shop_type) ? [...types, data.shop_type] : types;

    const bind = (field) => ({
        id: field,
        value: data[field],
        onChange: (value) => setData(field, value),
        error: errors[field],
    });

    const previewShop = {
        number: data.shop_number,
        block: data.block,
        floor: data.floor_number,
        property: property ? { name: property.name } : null,
        type: data.shop_type || null,
        areaSqm: Number(data.area_sqm) || null,
        amenities: data.amenities,
        monthlyRent: data.monthly_rent === '' ? null : rent,
        status: data.status,
    };

    const submit = (event) => {
        event.preventDefault();

        if (isEditing) {
            form.put(route('shops.update', shop.id), { preserveScroll: true });
        } else {
            form.post(route('shops.store'), { preserveScroll: true });
        }
    };

    const propertyItems = properties.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }));
    const cancelHref = isEditing ? route('shops.show', shop.id) : route('shops.index');

    const actions = (
        <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
                {t('shopForm.cancel')}
            </Button>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {isEditing ? t('shopForm.saveChanges') : t('shopForm.save')}
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
                        { label: t('shopList.title'), href: route('shops.index') },
                        { label: isEditing ? t('shopList.shop', { number: shop.shop_number }) : title },
                    ]}
                    title={title}
                    description={
                        isEditing
                            ? t('shopForm.editDescription', {
                                  number: shop.shop_number,
                                  property: properties.find((item) => item.id === shop.property_id)?.name ?? '',
                              })
                            : t('shopForm.addDescription')
                    }
                    actions={actions}
                    actionsClassName="max-sm:hidden"
                />

                <div className="grid items-start gap-6 xl:grid-cols-3">
                    <div className="flex flex-col gap-6 xl:col-span-2">
                        <FormSection
                            title={t('shopForm.sections.placement.title')}
                            description={t('shopForm.sections.placement.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-3">
                                <Field data-invalid={errors.property_id ? true : undefined} className="sm:col-span-3">
                                    <FieldLabel htmlFor="property_id">{t('shopForm.fields.property')}</FieldLabel>
                                    <Select items={propertyItems} value={data.property_id} onValueChange={(value) => setData('property_id', value)}>
                                        <SelectTrigger id="property_id" className="w-full" aria-invalid={Boolean(errors.property_id)}>
                                            <SelectValue placeholder={t('shopForm.fields.propertyPlaceholder')} />
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
                                <TextField {...bind('shop_number')} label={t('shopForm.fields.shopNumber')} placeholder="G-05" required />
                                <TextField {...bind('block')} label={t('shopForm.fields.block')} placeholder="A" optional />
                                <TextField
                                    {...bind('floor_number')}
                                    type="number"
                                    inputMode="numeric"
                                    label={t('shopForm.fields.floor')}
                                    description={t('shopForm.fields.floorHint')}
                                    placeholder="0"
                                    optional
                                />
                            </FieldGroup>
                        </FormSection>

                        <FormSection title={t('shopForm.sections.type.title')} description={t('shopForm.sections.type.description')}>
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <Field className="sm:col-span-2" data-invalid={errors.shop_type ? true : undefined}>
                                    <FieldLabel id="shop-type-label">{t('shopForm.fields.type')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="shop-type-label"
                                        variant="outline"
                                        value={data.shop_type ? [data.shop_type] : []}
                                        onValueChange={([value]) => setData('shop_type', value ?? '')}
                                        className="w-full flex-wrap"
                                    >
                                        {typeOptions.map((type) => {
                                            const Icon = TYPE_ICONS[type] ?? TagIcon;

                                            return (
                                                <ToggleGroupItem
                                                    key={type}
                                                    value={type}
                                                    className="rounded-full aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                                                >
                                                    <Icon data-icon="inline-start" />
                                                    {typeLabel(type)}
                                                </ToggleGroupItem>
                                            );
                                        })}
                                    </ToggleGroup>
                                    <FieldError>{errors.shop_type}</FieldError>
                                </Field>
                                <Field data-invalid={errors.area_sqm ? true : undefined}>
                                    <FieldLabel htmlFor="area_sqm">{t('shopForm.fields.area')}</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            id="area_sqm"
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            value={data.area_sqm}
                                            onChange={(event) => setData('area_sqm', event.target.value)}
                                            aria-invalid={Boolean(errors.area_sqm)}
                                            placeholder="40"
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

                        <FormSection
                            title={t('shopForm.sections.pricing.title')}
                            description={t('shopForm.sections.pricing.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <MoneyField
                                    {...bind('monthly_rent')}
                                    label={t('shopForm.fields.rent')}
                                    currency={currency}
                                    placeholder="5000"
                                    suffix={t('shopForm.perMonth')}
                                />
                                <MoneyField
                                    {...bind('security_deposit')}
                                    label={t('shopForm.fields.deposit')}
                                    currency={currency}
                                    placeholder="2500"
                                />
                                <TextField
                                    {...bind('utility_account_number')}
                                    label={t('shopForm.fields.utilityAccount')}
                                    description={t('shopForm.fields.utilityAccountHint')}
                                    className="sm:col-span-2"
                                    optional
                                />
                            </FieldGroup>
                        </FormSection>

                        <FormSection title={t('shopForm.sections.status.title')} description={t('shopForm.sections.status.description')}>
                            <Field data-invalid={errors.status ? true : undefined}>
                                <FieldLabel id="status-label" className="sr-only">
                                    {t('shopForm.fields.status')}
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
                                                {t(`shopStatus.${status}`)}
                                            </ToggleGroupItem>
                                        );
                                    })}
                                </ToggleGroup>
                                <FieldError>{errors.status}</FieldError>
                            </Field>
                        </FormSection>

                        <FormSection
                            title={t('shopForm.sections.amenities.title')}
                            description={t('shopForm.sections.amenities.description')}
                        >
                            <ToggleGroup
                                aria-label={t('shopForm.sections.amenities.title')}
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
                                            {t(`shopAmenities.${amenity}`)}
                                        </ToggleGroupItem>
                                    );
                                })}
                            </ToggleGroup>
                            <FieldError>{errors.amenities}</FieldError>
                        </FormSection>

                        <FormSection title={t('shopForm.sections.notes.title')} description={t('shopForm.sections.notes.description')}>
                            <Field data-invalid={errors.notes ? true : undefined}>
                                <FieldLabel htmlFor="notes" className="sr-only">
                                    {t('shopForm.fields.notes')}
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
                            <h2 className="font-heading text-base font-medium">{t('shopForm.sections.preview.title')}</h2>
                            <p className="text-sm text-muted-foreground">{t('shopForm.sections.preview.description')}</p>
                        </div>
                        <ShopCard shop={previewShop} currency={currency} />
                        <RentSummary rent={rent} deposit={deposit} currency={currency} />
                    </aside>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
