import { FormSection, TextField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import PropertyCover from '@/Components/PropertyCover';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
    ExternalLinkIcon,
    FilePlusIcon,
    FileTextIcon,
    ImageUpIcon,
    Trash2Icon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';

const PROPERTY_FIELDS = {
    name: '',
    code: '',
    property_type_id: null,
    status: 'active',
    country_code: 'AE',
    city: 'Dubai',
    area: '',
    street: '',
    building_name: '',
    plot_number: '',
    makani_number: '',
    po_box: '',
    address: '',
    latitude: '',
    longitude: '',
    map_url: '',
    contact_person_name: '',
    contact_person_phone: '',
    ownership_type: 'owned',
    landlord_name: '',
    landlord_phone: '',
    lease_start_date: '',
    lease_end_date: '',
    notes: '',
};

const emptyDocument = () => ({
    id: null,
    document_type: 'tenancy_contract',
    title: '',
    document_number: '',
    issued_on: '',
    expires_on: '',
    notes: '',
    file: null,
    file_url: null,
});

/**
 * The form's starting values: the property being edited (nulls become
 * empty strings for the inputs), or the defaults for a new one.
 */
function initialData(property) {
    const data = { ...PROPERTY_FIELDS, cover_image: null, documents: [] };

    if (!property) {
        return data;
    }

    Object.keys(PROPERTY_FIELDS).forEach((key) => {
        data[key] = property[key] ?? PROPERTY_FIELDS[key] ?? '';
    });

    data.documents = property.documents.map((document) => ({
        ...emptyDocument(),
        ...Object.fromEntries(Object.entries(document).map(([key, value]) => [key, value ?? ''])),
        id: document.id,
        file_url: document.file_url,
    }));

    return data;
}

function CoverPicker({ currentUrl, file, onChange, error }) {
    const { t } = useTranslation();
    const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : currentUrl), [file, currentUrl]);

    useEffect(() => () => file && URL.revokeObjectURL(previewUrl), [file, previewUrl]);

    return (
        <Field data-invalid={error ? true : undefined}>
            <div className="aspect-[2/1] overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                <PropertyCover key={previewUrl} src={previewUrl} />
            </div>
            <FieldLabel htmlFor="cover_image" className="sr-only">
                {t('propertyForm.sections.cover.title')}
            </FieldLabel>
            <Button variant="outline" nativeButton={false} render={<label htmlFor="cover_image" />}>
                <ImageUpIcon data-icon="inline-start" />
                {previewUrl ? t('propertyForm.cover.change') : t('propertyForm.cover.upload')}
            </Button>
            <input
                id="cover_image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => onChange(event.target.files[0] ?? null)}
            />
            <FieldDescription>{t('propertyForm.cover.hint')}</FieldDescription>
            <FieldError>{error}</FieldError>
        </Field>
    );
}

function DocumentFields({ index, document, documentTypes, errors, onChange, onRemove }) {
    const { t } = useTranslation();
    const prefix = `documents.${index}`;
    const id = (field) => `document-${index}-${field}`;
    const typeItems = documentTypes.map((type) => ({ value: type, label: t(`documentTypes.${type}`) }));

    return (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
                <legend className="flex items-center gap-2 text-sm font-medium">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    {t('propertyForm.documents.heading', { number: index + 1 })}
                </legend>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label={t('propertyForm.documents.remove')}
                >
                    <Trash2Icon />
                </Button>
            </div>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors[`${prefix}.document_type`] ? true : undefined}>
                    <FieldLabel htmlFor={id('type')}>{t('propertyForm.documents.type')}</FieldLabel>
                    <Select
                        items={typeItems}
                        value={document.document_type}
                        onValueChange={(value) => onChange('document_type', value)}
                    >
                        <SelectTrigger id={id('type')} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {typeItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <FieldError>{errors[`${prefix}.document_type`]}</FieldError>
                </Field>
                <TextField
                    id={id('title')}
                    label={t('propertyForm.documents.title')}
                    value={document.title}
                    onChange={(value) => onChange('title', value)}
                    error={errors[`${prefix}.title`]}
                    optional
                />
                <TextField
                    id={id('number')}
                    label={t('propertyForm.documents.number')}
                    value={document.document_number}
                    onChange={(value) => onChange('document_number', value)}
                    error={errors[`${prefix}.document_number`]}
                    optional
                />
                <Field data-invalid={errors[`${prefix}.file`] ? true : undefined}>
                    <FieldLabel htmlFor={id('file')}>{t('propertyForm.documents.file')}</FieldLabel>
                    <Input
                        id={id('file')}
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        onChange={(event) => onChange('file', event.target.files[0] ?? null)}
                        aria-invalid={Boolean(errors[`${prefix}.file`])}
                    />
                    {!errors[`${prefix}.file`] && (
                        <FieldDescription className="flex flex-wrap items-center gap-x-2">
                            {document.file_url ? t('propertyForm.documents.keepFile') : t('propertyForm.documents.fileHint')}
                            {document.file_url && (
                                <a
                                    href={document.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                                >
                                    {t('propertyForm.documents.currentFile')}
                                    <ExternalLinkIcon className="size-3" />
                                </a>
                            )}
                        </FieldDescription>
                    )}
                    <FieldError>{errors[`${prefix}.file`]}</FieldError>
                </Field>
                <TextField
                    id={id('issued')}
                    type="date"
                    label={t('propertyForm.documents.issuedOn')}
                    value={document.issued_on}
                    onChange={(value) => onChange('issued_on', value)}
                    error={errors[`${prefix}.issued_on`]}
                    optional
                />
                <TextField
                    id={id('expires')}
                    type="date"
                    label={t('propertyForm.documents.expiresOn')}
                    value={document.expires_on}
                    onChange={(value) => onChange('expires_on', value)}
                    error={errors[`${prefix}.expires_on`]}
                    optional
                />
                <TextField
                    id={id('notes')}
                    label={t('propertyForm.documents.notes')}
                    value={document.notes}
                    onChange={(value) => onChange('notes', value)}
                    error={errors[`${prefix}.notes`]}
                    optional
                    className="sm:col-span-2"
                />
            </FieldGroup>
        </fieldset>
    );
}

export default function Form({ property, propertyTypes, statuses, documentTypes }) {
    const { t, tOr } = useTranslation();
    const isEditing = property !== null;
    const form = useForm(initialData(property));
    const { data, setData, errors, processing } = form;

    const title = isEditing ? t('propertyForm.editTitle') : t('propertyForm.addTitle');

    // Binds a text input to a form field.
    const bind = (field) => ({
        id: field,
        value: data[field],
        onChange: (value) => setData(field, value),
        error: errors[field],
    });

    const updateDocument = (index, field, value) =>
        setData(
            'documents',
            data.documents.map((document, position) => (position === index ? { ...document, [field]: value } : document)),
        );

    const submit = (event) => {
        event.preventDefault();

        form.transform((values) => (isEditing ? { ...values, _method: 'put' } : values));
        form.post(isEditing ? route('properties.update', property.id) : route('properties.store'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const actions = (
        <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={route('properties.index')} />}>
                {t('propertyForm.cancel')}
            </Button>
            <Button type="submit" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {isEditing ? t('propertyForm.saveChanges') : t('propertyForm.save')}
            </Button>
        </div>
    );

    const typeItems = propertyTypes.map((type) => ({
        value: type.id,
        label: tOr(`propertyTypes.${type.slug}`, type.name),
    }));

    return (
        <DashboardLayout>
            <Head title={title} />

            <form onSubmit={submit} className="flex flex-1 flex-col gap-6" noValidate>
                <PageHeader
                    breadcrumbs={[
                        { label: t('properties.title'), href: route('properties.index') },
                        { label: isEditing ? property.name : title },
                    ]}
                    title={title}
                    description={isEditing ? t('propertyForm.editDescription', { name: property.name }) : t('propertyForm.addDescription')}
                    actions={actions}
                    actionsClassName="max-sm:hidden"
                />

                <div className="grid items-start gap-6 xl:grid-cols-3">
                    <div className="flex flex-col gap-6 xl:col-span-2">
                        <FormSection
                            title={t('propertyForm.sections.details.title')}
                            description={t('propertyForm.sections.details.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <TextField {...bind('name')} label={t('propertyForm.fields.name')} required className="sm:col-span-2" />
                                <TextField
                                    {...bind('code')}
                                    label={t('propertyForm.fields.code')}
                                    description={t('propertyForm.fields.codeHint')}
                                    inputClassName="font-mono"
                                    required
                                />
                                <Field data-invalid={errors.property_type_id ? true : undefined}>
                                    <FieldLabel htmlFor="property_type_id">{t('propertyForm.fields.type')}</FieldLabel>
                                    <Select
                                        items={typeItems}
                                        value={data.property_type_id}
                                        onValueChange={(value) => setData('property_type_id', value)}
                                    >
                                        <SelectTrigger id="property_type_id" className="w-full" aria-invalid={Boolean(errors.property_type_id)}>
                                            <SelectValue placeholder={t('propertyForm.fields.typePlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {typeItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <FieldError>{errors.property_type_id}</FieldError>
                                </Field>
                                <Field data-invalid={errors.status ? true : undefined} className="sm:col-span-2">
                                    <FieldLabel id="status-label">{t('propertyForm.fields.status')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="status-label"
                                        variant="outline"
                                        spacing={0}
                                        value={[data.status]}
                                        onValueChange={([value]) => value && setData('status', value)}
                                    >
                                        {statuses.map((status) => (
                                            <ToggleGroupItem key={status} value={status}>
                                                {t(`status.${status}`)}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    <FieldError>{errors.status}</FieldError>
                                </Field>
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('propertyForm.sections.location.title')}
                            description={t('propertyForm.sections.location.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <TextField {...bind('country_code')} label={t('propertyForm.fields.country')} maxLength={2} inputClassName="uppercase" required />
                                <TextField {...bind('city')} label={t('propertyForm.fields.city')} optional />
                                <TextField {...bind('area')} label={t('propertyForm.fields.area')} optional />
                                <TextField {...bind('street')} label={t('propertyForm.fields.street')} optional />
                                <TextField {...bind('building_name')} label={t('propertyForm.fields.building')} optional />
                                <TextField {...bind('plot_number')} label={t('propertyForm.fields.plot')} optional />
                                <TextField
                                    {...bind('makani_number')}
                                    label={t('propertyForm.fields.makani')}
                                    description={t('propertyForm.fields.makaniHint')}
                                    inputMode="numeric"
                                    maxLength={10}
                                    optional
                                />
                                <TextField {...bind('po_box')} label={t('propertyForm.fields.poBox')} optional />
                                <TextField {...bind('map_url')} type="url" label={t('propertyForm.fields.mapUrl')} placeholder="https://maps.google.com/…" optional />
                                <TextField {...bind('latitude')} label={t('propertyForm.fields.latitude')} inputMode="decimal" placeholder="25.1352" optional />
                                <TextField {...bind('longitude')} label={t('propertyForm.fields.longitude')} inputMode="decimal" placeholder="55.2401" optional />
                                <Field data-invalid={errors.address ? true : undefined} className="sm:col-span-2 lg:col-span-3">
                                    <FieldLabel htmlFor="address">{t('propertyForm.fields.address')}</FieldLabel>
                                    <Textarea
                                        id="address"
                                        rows={2}
                                        value={data.address}
                                        onChange={(event) => setData('address', event.target.value)}
                                        aria-invalid={Boolean(errors.address)}
                                    />
                                    <FieldError>{errors.address}</FieldError>
                                </Field>
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('propertyForm.sections.ownership.title')}
                            description={t('propertyForm.sections.ownership.description')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <Field className="sm:col-span-2">
                                    <FieldLabel id="ownership-label">{t('propertyForm.fields.ownership')}</FieldLabel>
                                    <ToggleGroup
                                        aria-labelledby="ownership-label"
                                        variant="outline"
                                        spacing={0}
                                        value={[data.ownership_type]}
                                        onValueChange={([value]) => value && setData('ownership_type', value)}
                                    >
                                        <ToggleGroupItem value="owned">{t('properties.ownership.owned')}</ToggleGroupItem>
                                        <ToggleGroupItem value="leased">{t('properties.ownership.leased')}</ToggleGroupItem>
                                    </ToggleGroup>
                                </Field>
                                {data.ownership_type === 'leased' && (
                                    <>
                                        <TextField {...bind('landlord_name')} label={t('propertyForm.fields.landlordName')} required />
                                        <TextField {...bind('landlord_phone')} type="tel" label={t('propertyForm.fields.landlordPhone')} optional />
                                        <TextField {...bind('lease_start_date')} type="date" label={t('propertyForm.fields.leaseStart')} required />
                                        <TextField {...bind('lease_end_date')} type="date" label={t('propertyForm.fields.leaseEnd')} required />
                                    </>
                                )}
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('propertyForm.sections.documents.title')}
                            description={t('propertyForm.sections.documents.description')}
                            action={
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setData('documents', [...data.documents, emptyDocument()])}
                                >
                                    <FilePlusIcon data-icon="inline-start" />
                                    {t('propertyForm.documents.add')}
                                </Button>
                            }
                        >
                            {data.documents.length === 0 ? (
                                <Empty className="border py-8">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <FileTextIcon />
                                        </EmptyMedia>
                                        <EmptyTitle>{t('propertyForm.documents.empty')}</EmptyTitle>
                                        <EmptyDescription>{t('propertyForm.documents.emptyDescription')}</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {data.documents.map((document, index) => (
                                        <DocumentFields
                                            key={document.id ?? `new-${index}`}
                                            index={index}
                                            document={document}
                                            documentTypes={documentTypes}
                                            errors={errors}
                                            onChange={(field, value) => updateDocument(index, field, value)}
                                            onRemove={() => setData('documents', data.documents.filter((_, position) => position !== index))}
                                        />
                                    ))}
                                </div>
                            )}
                        </FormSection>
                    </div>

                    <div className="flex flex-col gap-6">
                        <FormSection
                            title={t('propertyForm.sections.cover.title')}
                            description={t('propertyForm.sections.cover.description')}
                        >
                            <CoverPicker
                                currentUrl={property?.cover_image_url}
                                file={data.cover_image}
                                onChange={(file) => setData('cover_image', file)}
                                error={errors.cover_image}
                            />
                        </FormSection>

                        <FormSection
                            title={t('propertyForm.sections.contact.title')}
                            description={t('propertyForm.sections.contact.description')}
                        >
                            <FieldGroup>
                                <TextField {...bind('contact_person_name')} label={t('propertyForm.fields.contactName')} optional />
                                <TextField {...bind('contact_person_phone')} type="tel" label={t('propertyForm.fields.contactPhone')} placeholder="+971 50 123 4567" optional />
                            </FieldGroup>
                        </FormSection>

                        <FormSection
                            title={t('propertyForm.sections.notes.title')}
                            description={t('propertyForm.sections.notes.description')}
                        >
                            <Field data-invalid={errors.notes ? true : undefined}>
                                <FieldLabel htmlFor="notes" className="sr-only">{t('propertyForm.fields.notes')}</FieldLabel>
                                <Textarea
                                    id="notes"
                                    rows={5}
                                    value={data.notes}
                                    onChange={(event) => setData('notes', event.target.value)}
                                    aria-invalid={Boolean(errors.notes)}
                                />
                                <FieldError>{errors.notes}</FieldError>
                            </Field>
                        </FormSection>
                    </div>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
