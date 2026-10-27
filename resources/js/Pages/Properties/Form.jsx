import ChequeScheduleFields, { ChequeCountPicker, ChequePlanCard, TermPicker } from '@/Components/ChequeScheduleFields';
import { MoneyField, TextareaField, TextField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { chequePayload, emptyChequeEntry, initialChequeEntries, planLeaseCheques, scheduleRows } from '@/lib/cheques';
import { shrinkImage } from '@/lib/images';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    Building2Icon,
    BriefcaseBusinessIcon,
    ChevronDownIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    FilePlusIcon,
    FileTextIcon,
    HandshakeIcon,
    HardHatIcon,
    HouseIcon,
    KeyRoundIcon,
    LayoutGridIcon,
    MapPinIcon,
    PhoneIcon,
    ScrollTextIcon,
    WalletCardsIcon,
    WrenchIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BuildingSize from './Partials/BuildingSize';
import CoverDropzone from './Partials/CoverDropzone';
import DocumentFields from './Partials/DocumentFields';
import { ChoiceCards, StepBar, StepSection, useCurrentStep } from './Partials/FormSteps';
import LandlordPicker, { emptyLandlord } from './Partials/LandlordPicker';
import PropertyPreview from './Partials/PropertyPreview';
import RequiredDocuments, { hasFile } from './Partials/RequiredDocuments';
import UnitBatches, { emptyUnits, unitCount, unitNumbers } from './Partials/UnitBatches';

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
    landlord_id: null,
    lease_start_date: '',
    lease_end_date: '',
    notes: '',
    total_floors: '',
    total_units: '',
    ejari_number: '',
    annual_rent: '',
    payments_per_year: 4,
    security_deposit: '',
    notice_period_days: 90,
};

const emptyDocument = () => ({
    id: null,
    document_type: 'title_deed',
    title: '',
    document_number: '',
    issued_on: '',
    expires_on: '',
    notes: '',
    file: null,
    file_url: null,
});

/**
 * The lease terms in the shape the cheque planner reads.
 */
const leaseTerms = (values) => ({
    start_date: values.lease_start_date,
    end_date: values.lease_end_date,
    annual_rent: values.annual_rent,
    payments_per_year: values.payments_per_year,
    security_deposit: values.security_deposit,
});

/**
 * The form's starting values: the property being edited (nulls become
 * empty strings for the inputs), or the defaults for a new one. Each
 * required document type gets a place in the list, empty until uploaded.
 */
function initialData(property, landlords, requiredTypes) {
    const data = {
        ...PROPERTY_FIELDS,
        cover_image: null,
        documents: [],
        cheques: {},
        landlord_mode: property?.landlord_id || landlords.length > 0 ? 'existing' : 'new',
        new_landlord: emptyLandlord(),
        units: emptyUnits(),
    };

    const withRequired = (documents) => [
        ...documents,
        ...requiredTypes
            .filter((type) => !documents.some((document) => document.document_type === type))
            .map((type) => ({ ...emptyDocument(), document_type: type })),
    ];

    if (!property) {
        return { ...data, documents: withRequired([]) };
    }

    Object.keys(PROPERTY_FIELDS).forEach((key) => {
        data[key] = property[key] ?? PROPERTY_FIELDS[key] ?? '';
    });

    data.documents = withRequired(
        property.documents.map((document) => ({
            ...emptyDocument(),
            ...Object.fromEntries(Object.entries(document).map(([key, value]) => [key, value ?? ''])),
            id: document.id,
            file_url: document.file_url,
        })),
    );
    data.cheques = initialChequeEntries(property.lease?.cheques ?? [], planLeaseCheques(leaseTerms(data)));

    return data;
}

/**
 * The form's steps, in order. Units are optional; the lease and its
 * cheques only apply to leased properties.
 */
const STEPS = [
    { key: 'basics', icon: Building2Icon },
    { key: 'location', icon: MapPinIcon },
    { key: 'units', icon: LayoutGridIcon, optional: true },
    { key: 'ownership', icon: KeyRoundIcon },
    { key: 'documents', icon: FileTextIcon },
    { key: 'lease', icon: WalletCardsIcon, leasedOnly: true },
];

/**
 * The fields each step holds, to show a step's errors on its badge.
 */
const STEP_FIELDS = {
    basics: ['name', 'code', 'property_type_id', 'status', 'cover_image'],
    location: [
        'country_code', 'city', 'area', 'street', 'building_name', 'plot_number', 'makani_number', 'po_box', 'address', 'latitude', 'longitude', 'map_url',
        'contact_person_name', 'contact_person_phone', 'notes',
    ],
    ownership: ['ownership_type', 'landlord_mode', 'landlord_id', 'new_landlord'],
    units: ['units', 'total_floors', 'total_units'],
    documents: ['documents'],
    lease: ['lease_start_date', 'lease_end_date', 'ejari_number', 'annual_rent', 'payments_per_year', 'security_deposit', 'notice_period_days', 'cheques'],
};

const EXTRA_LOCATION_FIELDS = ['plot_number', 'makani_number', 'po_box', 'map_url', 'latitude', 'longitude'];

const stepOf = (field) => STEPS.find(({ key }) => STEP_FIELDS[key].some((name) => field === name || field.startsWith(`${name}.`)))?.key;

/**
 * Where each step stands: `error` when one of its fields was rejected,
 * `done` when its required fields are filled (or, for an optional step,
 * when something was added), `started` when something was entered but not
 * all it needs, otherwise `todo`. A field left at its default (such as the
 * country) does not count as entered.
 */
function stepStates(data, errors, requiredTypes) {
    const withErrors = new Set(Object.keys(errors).map(stepOf));
    const isLeased = data.ownership_type === 'leased';
    const hasLandlord = data.landlord_mode === 'new' ? Boolean(data.new_landlord.name) : Boolean(data.landlord_id);
    const isEntered = (fields) => fields.some((field) => ![null, '', PROPERTY_FIELDS[field]].includes(data[field]));
    const isStarted = {
        basics: isEntered(['name', 'code', 'property_type_id', 'status']) || Boolean(data.cover_image),
        location: isEntered(STEP_FIELDS.location),
        ownership: isEntered(['ownership_type', 'landlord_id']) || Boolean(data.new_landlord.name),
        units: Object.values(data.units).some((batches) => batches.length > 0),
        documents: data.documents.some(hasFile) || data.documents.length > requiredTypes.length,
        lease: isEntered(STEP_FIELDS.lease.filter((field) => field !== 'cheques')),
    };
    const isDone = {
        basics: Boolean(data.name && data.code && data.property_type_id),
        location: Boolean(data.country_code && (data.area || data.street || data.building_name || data.address)),
        ownership: !isLeased || hasLandlord,
        units:
            Boolean(data.total_floors || data.total_units) ||
            Object.values(data.units).some((batches) => batches.some((batch) => unitNumbers(batch.first_number, batch.count).length > 0)),
        documents: requiredTypes.every((type) => data.documents.some((document) => document.document_type === type && hasFile(document))),
        lease: !isLeased || Boolean(data.lease_start_date && data.lease_end_date && data.annual_rent !== '' && data.payments_per_year),
    };

    return Object.fromEntries(STEPS.map(({ key }) => [key, withErrors.has(key) ? 'error' : isDone[key] ? 'done' : isStarted[key] ? 'started' : 'todo']));
}

const TYPE_STYLES = {
    worker_accommodation: { icon: HardHatIcon, tone: 'gold' },
    staff_accommodation: { icon: BriefcaseBusinessIcon, tone: 'brand' },
    residential_building: { icon: Building2Icon, tone: 'green' },
};

const STATUS_STYLES = {
    active: { icon: CircleCheckIcon, tone: 'green' },
    inactive: { icon: CirclePauseIcon, tone: 'navy' },
    under_maintenance: { icon: WrenchIcon, tone: 'orange' },
};

/**
 * Whole months the lease covers, counting its last day (1 Jan to 31 Dec is
 * 12 months), or null until both dates are set.
 */
function leaseMonths(start, end) {
    if (!start || !end || end < start) {
        return null;
    }

    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${end}T00:00:00`);
    to.setDate(to.getDate() + 1);

    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);

    return Math.max(months, 1);
}

export default function Form({
    property,
    propertyTypes,
    statuses,
    documentTypes,
    requiredDocumentTypes,
    landlords,
    roomTypes,
    genderPolicies,
    shopTypes,
    furnishingStatuses,
    paymentsPerYear,
    currency,
    banks,
    unitSummary,
}) {
    const { t, tOr } = useTranslation();
    const isEditing = property !== null;
    const form = useForm(initialData(property, landlords, requiredDocumentTypes));
    const { data, setData, errors, processing } = form;
    const isLeased = data.ownership_type === 'leased';
    const steps = STEPS.filter((step) => isLeased || !step.leasedOnly);
    const states = stepStates(data, errors, requiredDocumentTypes);
    const current = useCurrentStep(steps.map((step) => step.key));
    const [showMoreLocation, setShowMoreLocation] = useState(() => EXTRA_LOCATION_FIELDS.some((field) => data[field]));

    const title = isEditing ? t('propertyForm.editTitle') : t('propertyForm.addTitle');
    const months = leaseMonths(data.lease_start_date, data.lease_end_date);
    const isKept = Boolean(property?.lease?.hasLockedCheques);
    const chequeRows = (values) => scheduleRows(planLeaseCheques(leaseTerms(values)), values.cheques, property?.lease?.cheques ?? [], isKept);
    const rows = chequeRows(data);
    const patchCheque = (key, patch) =>
        setData((values) => ({ ...values, cheques: { ...values.cheques, [key]: { ...(values.cheques[key] ?? emptyChequeEntry()), ...patch } } }));

    const slots = requiredDocumentTypes.map((type) => {
        const index = data.documents.findIndex((document) => document.document_type === type);

        return { type, index, document: data.documents[index] };
    });
    const extraIndexes = data.documents.map((_, index) => index).filter((index) => !slots.some((slot) => slot.index === index));

    const savedUnits = unitSummary ? Object.values(unitSummary).reduce((sum, kind) => sum + kind.count, 0) : 0;
    const addingUnits = Object.values(data.units).reduce((sum, batches) => sum + unitCount(batches), 0);
    const remainingUnits = Number(data.total_units) > 0 ? Number(data.total_units) - savedUnits - addingUnits : null;

    const coverUrl = useMemo(
        () => (data.cover_image ? URL.createObjectURL(data.cover_image) : (property?.cover_image_url ?? null)),
        [data.cover_image, property],
    );

    useEffect(() => () => data.cover_image && URL.revokeObjectURL(coverUrl), [coverUrl, data.cover_image]);

    // Rejected location details hide behind the disclosure, so open it for them.
    useEffect(() => {
        if (EXTRA_LOCATION_FIELDS.some((field) => errors[field])) {
            setShowMoreLocation(true);
        }
    }, [errors]);

    // Binds a text input to a form field.
    const bind = (field) => ({
        id: field,
        value: data[field],
        onChange: (value) => setData(field, value),
        error: errors[field],
    });

    const setDocumentField = (index, field, value) =>
        setData((values) => ({
            ...values,
            documents: values.documents.map((document, position) => (position === index ? { ...document, [field]: value } : document)),
        }));

    // Photos of documents go up shrunk; PDFs as they are.
    const updateDocument = (index, field, value) =>
        field === 'file' ? shrinkImage(value).then((file) => setDocumentField(index, field, file)) : setDocumentField(index, field, value);

    const submit = (event) => {
        event.preventDefault();

        form.transform((values) => ({
            ...values,
            cheques: values.ownership_type === 'leased' ? chequePayload(chequeRows(values)) : [],
            ...(isEditing ? { _method: 'put' } : {}),
        }));
        form.post(isEditing ? route('properties.update', property.id) : route('properties.store'), {
            forceFormData: true,
            preserveScroll: true,
            onError: (rejected) => {
                const first = steps.find(({ key }) => Object.keys(rejected).some((field) => stepOf(field) === key));

                document.getElementById(`step-${first?.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
        });
    };

    const actions = (
        <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={route('properties.index')} />}>
                {t('propertyForm.cancel')}
            </Button>
            <Button type="submit" variant="brand" disabled={processing}>
                {processing && <Spinner data-icon="inline-start" />}
                {isEditing ? t('propertyForm.saveChanges') : t('propertyForm.save')}
            </Button>
        </div>
    );

    const section = (key) => ({
        step: steps.find((step) => step.key === key),
        index: steps.findIndex((step) => step.key === key),
        total: steps.length,
        state: states[key],
    });

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

                <StepBar steps={steps} states={states} current={current} />

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <StepSection {...section('basics')}>
                            <FieldGroup className="gap-5">
                                <CoverDropzone
                                    previewUrl={coverUrl}
                                    hasNewFile={Boolean(data.cover_image)}
                                    onChange={(file) => shrinkImage(file).then((smaller) => setData('cover_image', smaller))}
                                    error={errors.cover_image}
                                />
                                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                    <TextField {...bind('name')} label={t('propertyForm.fields.name')} inputClassName="h-11 text-base font-medium" required />
                                    <TextField
                                        {...bind('code')}
                                        label={t('propertyForm.fields.code')}
                                        description={t('propertyForm.fields.codeHint')}
                                        inputClassName="h-11 font-mono uppercase"
                                        required
                                    />
                                </div>
                                <ChoiceCards
                                    name="property_type_id"
                                    label={t('propertyForm.fields.type')}
                                    value={data.property_type_id}
                                    onChange={(value) => setData('property_type_id', Number(value))}
                                    error={errors.property_type_id}
                                    columns={3}
                                    options={propertyTypes.map((type) => ({
                                        value: type.id,
                                        title: tOr(`propertyTypes.${type.slug}`, type.name),
                                        description: tOr(`propertyForm.typeCards.${type.slug}`, t('propertyForm.typeCards.other')),
                                        icon: TYPE_STYLES[type.slug]?.icon ?? HouseIcon,
                                        tone: TYPE_STYLES[type.slug]?.tone ?? 'brand',
                                    }))}
                                />
                                <ChoiceCards
                                    name="status"
                                    label={t('propertyForm.fields.status')}
                                    value={data.status}
                                    onChange={(value) => setData('status', value)}
                                    error={errors.status}
                                    columns={3}
                                    compact
                                    options={statuses.map((status) => ({
                                        value: status,
                                        title: t(`status.${status}`),
                                        description: t(`propertyForm.statusHints.${status}`),
                                        icon: STATUS_STYLES[status]?.icon ?? CircleCheckIcon,
                                        tone: STATUS_STYLES[status]?.tone ?? 'brand',
                                    }))}
                                />
                            </FieldGroup>
                        </StepSection>

                        <StepSection {...section('location')}>
                            <FieldGroup className="gap-5">
                                <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)]">
                                    <TextField {...bind('country_code')} label={t('propertyForm.fields.country')} maxLength={2} inputClassName="uppercase" required />
                                    <TextField {...bind('city')} label={t('propertyForm.fields.city')} optional />
                                    <TextField {...bind('area')} label={t('propertyForm.fields.area')} optional />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <TextField {...bind('street')} label={t('propertyForm.fields.street')} optional />
                                    <TextField {...bind('building_name')} label={t('propertyForm.fields.building')} optional />
                                </div>
                                <TextareaField {...bind('address')} label={t('propertyForm.fields.address')} rows={2} optional />

                                <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/[0.06]">
                                    <div className="flex items-start gap-3">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-ink shadow-sm ring-1 ring-foreground/[0.06]">
                                            <PhoneIcon className="size-4" />
                                        </span>
                                        <div className="flex flex-col gap-0.5">
                                            <h3 className="text-sm font-bold">{t('propertyForm.contact.title')}</h3>
                                            <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.contact.description')}</p>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <TextField {...bind('contact_person_name')} label={t('propertyForm.fields.contactName')} inputClassName="bg-surface" optional />
                                        <TextField
                                            {...bind('contact_person_phone')}
                                            type="tel"
                                            label={t('propertyForm.fields.contactPhone')}
                                            placeholder="+971 50 123 4567"
                                            inputClassName="bg-surface"
                                            optional
                                        />
                                    </div>
                                    <TextareaField {...bind('notes')} label={t('propertyForm.fields.notes')} rows={3} className="[&_textarea]:bg-surface" optional />
                                </div>

                                <Collapsible open={showMoreLocation} onOpenChange={setShowMoreLocation}>
                                    <CollapsibleTrigger
                                        render={<Button type="button" variant="ghost" size="sm" className="group/more -ms-2 text-brand-ink" />}
                                    >
                                        <ChevronDownIcon data-icon="inline-start" className="transition-transform group-data-[panel-open]/more:rotate-180" />
                                        {showMoreLocation ? t('propertyForm.fewerLocation') : t('propertyForm.moreLocation')}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
                                        <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <TextField
                                                {...bind('makani_number')}
                                                label={t('propertyForm.fields.makani')}
                                                description={t('propertyForm.fields.makaniHint')}
                                                inputMode="numeric"
                                                maxLength={10}
                                                optional
                                            />
                                            <TextField {...bind('plot_number')} label={t('propertyForm.fields.plot')} optional />
                                            <TextField {...bind('po_box')} label={t('propertyForm.fields.poBox')} optional />
                                            <TextField {...bind('map_url')} type="url" label={t('propertyForm.fields.mapUrl')} placeholder="https://maps.google.com/…" optional />
                                            <TextField {...bind('latitude')} label={t('propertyForm.fields.latitude')} inputMode="decimal" placeholder="25.1352" optional />
                                            <TextField {...bind('longitude')} label={t('propertyForm.fields.longitude')} inputMode="decimal" placeholder="55.2401" optional />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </FieldGroup>
                        </StepSection>

                        <StepSection {...section('units')}>
                            <div className="flex flex-col gap-6">
                                <BuildingSize
                                    floors={data.total_floors}
                                    units={data.total_units}
                                    onChange={setData}
                                    errors={errors}
                                    saved={savedUnits}
                                    adding={addingUnits}
                                />
                                <UnitBatches
                                    units={data.units}
                                    onChange={(units) => setData('units', units)}
                                    errors={errors}
                                    options={{ roomTypes, genderPolicies, shopTypes, furnishingStatuses }}
                                    currency={currency}
                                    summary={unitSummary}
                                    remaining={remainingUnits}
                                />
                            </div>
                        </StepSection>

                        <StepSection {...section('ownership')}>
                            <FieldGroup className="grid gap-5 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <ChoiceCards
                                        name="ownership_type"
                                        label={t('propertyForm.fields.ownership')}
                                        value={data.ownership_type}
                                        onChange={(value) => setData('ownership_type', value)}
                                        error={errors.ownership_type}
                                        options={[
                                            { value: 'owned', title: t('propertyForm.ownershipCards.owned.title'), description: t('propertyForm.ownershipCards.owned.description'), icon: KeyRoundIcon, tone: 'brand' },
                                            { value: 'leased', title: t('propertyForm.ownershipCards.leased.title'), description: t('propertyForm.ownershipCards.leased.description'), icon: HandshakeIcon, tone: 'gold' },
                                        ]}
                                    />
                                </div>
                                {isLeased && <LandlordPicker landlords={landlords} data={data} setData={setData} errors={errors} />}
                            </FieldGroup>
                        </StepSection>

                        <StepSection {...section('documents')}>
                            <div className="flex flex-col gap-6">
                                {errors.documents && (
                                    <Alert variant="destructive">
                                        <CircleAlertIcon />
                                        <AlertDescription>{errors.documents}</AlertDescription>
                                    </Alert>
                                )}

                                <RequiredDocuments slots={slots} errors={errors} onChange={updateDocument} />

                                <section className="flex flex-col gap-4 border-t pt-6">
                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                        <div className="flex flex-col gap-0.5">
                                            <h3 className="text-sm font-bold">{t('propertyForm.documents.additional.title')}</h3>
                                            <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.documents.additional.description')}</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setData('documents', [...data.documents, emptyDocument()])}>
                                            <FilePlusIcon data-icon="inline-start" />
                                            {t('propertyForm.documents.add')}
                                        </Button>
                                    </div>
                                    {extraIndexes.map((index) => (
                                        <DocumentFields
                                            key={data.documents[index].id ?? `new-${index}`}
                                            index={index}
                                            document={data.documents[index]}
                                            documentTypes={documentTypes}
                                            errors={errors}
                                            onChange={(field, value) => updateDocument(index, field, value)}
                                            onRemove={() => setData('documents', data.documents.filter((_, position) => position !== index))}
                                        />
                                    ))}
                                </section>
                            </div>
                        </StepSection>

                        {isLeased && (
                            <StepSection
                                {...section('lease')}
                                action={
                                    property?.lease && (
                                        <Badge variant="info" render={<Link href={route('head-leases.show', property.lease.id)} />}>
                                            {property.lease.number}
                                        </Badge>
                                    )
                                }
                            >
                                <div className="flex flex-col gap-6">
                                    <FieldGroup className="grid gap-5 sm:grid-cols-2">
                                        <TextField {...bind('lease_start_date')} type="date" label={t('propertyForm.fields.leaseStart')} required />
                                        <TextField {...bind('lease_end_date')} type="date" label={t('propertyForm.fields.leaseEnd')} required />
                                        <TermPicker startDate={data.lease_start_date} endDate={data.lease_end_date} onChange={(value) => setData('lease_end_date', value)} />
                                        {months !== null && (
                                            <p className="-mt-2 text-[0.8125rem] text-muted-foreground sm:col-span-2">{t('propertyForm.leaseLength', { count: months })}</p>
                                        )}
                                        <MoneyField
                                            {...bind('annual_rent')}
                                            label={t('leasing.headLeases.form.fields.annualRent')}
                                            currency={currency}
                                            suffix={t('leasing.common.perYear')}
                                            placeholder="780000"
                                        />
                                        <MoneyField {...bind('security_deposit')} label={t('leasing.common.securityDeposit')} currency={currency} optional />
                                        <ChequeCountPicker
                                            id="payments_per_year"
                                            label={t('leasing.headLeases.form.fields.paymentsPerYear')}
                                            value={data.payments_per_year}
                                            onChange={(value) => setData('payments_per_year', value)}
                                            options={paymentsPerYear}
                                            annualRent={data.annual_rent}
                                            currency={currency}
                                            error={errors.payments_per_year}
                                            className="sm:col-span-2"
                                        />
                                        <TextField
                                            {...bind('notice_period_days')}
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            label={t('leasing.headLeases.form.fields.noticeDays')}
                                            optional
                                        />
                                        <TextField {...bind('ejari_number')} label={t('leasing.common.ejariNumber')} optional />
                                    </FieldGroup>

                                    <section className="flex flex-col gap-4 border-t pt-6">
                                        <div className="flex flex-col gap-0.5">
                                            <h3 className="text-sm font-bold">{t('leasing.cheques.schedule.title')}</h3>
                                            <p className="text-[0.8125rem] text-muted-foreground">{t('leasing.cheques.schedule.formDescription.issued')}</p>
                                        </div>
                                        <ChequeScheduleFields
                                            rows={rows}
                                            startDate={data.lease_start_date}
                                            endDate={data.lease_end_date}
                                            direction="issued"
                                            enforce={false}
                                            optional
                                            isKept={isKept}
                                            onPatch={patchCheque}
                                            errors={errors}
                                            currency={currency}
                                            banks={banks}
                                            hint={t('propertyForm.lease.chequesHint')}
                                        />
                                    </section>

                                    <Alert>
                                        <ScrollTextIcon />
                                        <AlertDescription>{t(property?.lease ? 'propertyForm.lease.updates' : 'propertyForm.lease.creates')}</AlertDescription>
                                    </Alert>
                                </div>
                            </StepSection>
                        )}
                    </div>

                    <aside className="hidden flex-col gap-6 xl:sticky xl:top-40 xl:flex xl:max-h-[calc(100svh-11rem)] xl:overflow-y-auto xl:pb-1 [&>*]:shrink-0">
                        <PropertyPreview data={data} coverUrl={coverUrl} propertyTypes={propertyTypes} landlords={landlords} savedUnits={savedUnits} />
                        {isLeased && (
                            <ChequePlanCard
                                rows={rows}
                                startDate={data.lease_start_date}
                                endDate={data.lease_end_date}
                                perYear={Number(data.payments_per_year)}
                                currency={currency}
                            />
                        )}
                    </aside>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
