import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CircleAlertIcon, FilePlusIcon } from 'lucide-react';
import { useEffect } from 'react';
import DocumentFields from '../Properties/Partials/DocumentFields';
import LandlordPicker, { emptyLandlord } from '../Properties/Partials/LandlordPicker';
import RequiredDocuments from '../Properties/Partials/RequiredDocuments';
import DocumentsOnFile from './Partials/DocumentsOnFile';
import SchedulePreview, { useSchedule } from './Partials/SchedulePreview';

const emptyDocument = (documentType = 'other') => ({
    document_type: documentType,
    title: '',
    document_number: '',
    issued_on: '',
    expires_on: '',
    notes: '',
    file: null,
    file_url: null,
});

/**
 * The documents to upload with the lease: what the user already added, plus
 * an empty place for each required type the property is missing. Empty
 * places for types the property now has are dropped.
 */
function withMissingTypes(documents, missingTypes, requiredTypes) {
    const kept = documents.filter((document) => document.file || !requiredTypes.includes(document.document_type) || missingTypes.includes(document.document_type));

    return [
        ...kept,
        ...missingTypes.filter((type) => !kept.some((document) => document.document_type === type)).map((type) => emptyDocument(type)),
    ];
}

function initialData(lease, prefill, landlords) {
    const source = lease ?? prefill ?? {};

    return {
        property_id: source.property_id ?? null,
        landlord_mode: source.landlord_id || landlords.length > 0 ? 'existing' : 'new',
        landlord_id: source.landlord_id ?? null,
        new_landlord: emptyLandlord(),
        documents: [],
        renewed_from_id: source.renewed_from_id ?? null,
        ejari_number: source.ejari_number ?? '',
        start_date: source.start_date ?? '',
        end_date: source.end_date ?? '',
        annual_rent: source.annual_rent ?? '',
        payments_per_year: source.payments_per_year ?? 4,
        security_deposit: source.security_deposit ?? '',
        notice_period_days: source.notice_period_days ?? 90,
        status: source.status ?? 'draft',
        notes: source.notes ?? '',
    };
}

export default function Form({
    lease,
    prefill,
    renewing,
    currency,
    properties,
    landlords,
    statuses,
    paymentsPerYear,
    documentTypes,
    requiredDocumentTypes,
    propertyDocuments,
}) {
    const { t } = useTranslation();
    const isEditing = lease !== null;
    const form = useForm(initialData(lease, prefill, landlords));
    const { data, setData, errors, processing } = form;
    const schedule = useSchedule(data);
    const onFile = propertyDocuments[data.property_id] ?? [];
    const missingTypes = requiredDocumentTypes.filter((type) => !onFile.some((document) => document.document_type === type));
    const slots = missingTypes
        .map((type) => ({ type, index: data.documents.findIndex((document) => document.document_type === type) }))
        .filter((slot) => slot.index >= 0)
        .map((slot) => ({ ...slot, document: data.documents[slot.index] }));
    const extraIndexes = data.documents.map((_, index) => index).filter((index) => !slots.some((slot) => slot.index === index));

    // A different property has different documents on file, so the places for missing ones change.
    useEffect(() => {
        if (data.property_id) {
            setData((current) => ({ ...current, documents: withMissingTypes(current.documents, missingTypes, requiredDocumentTypes) }));
        }
    }, [data.property_id]);

    const updateDocument = (index, field, value) =>
        setData('documents', data.documents.map((document, position) => (position === index ? { ...document, [field]: value } : document)));
    const title = isEditing
        ? t('leasing.headLeases.form.editTitle', { number: lease.lease_number })
        : renewing
          ? t('leasing.headLeases.form.renewTitle', { number: renewing.number })
          : t('leasing.headLeases.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => {
        form.transform((values) => (isEditing ? { ...values, _method: 'put' } : values));
        form.post(isEditing ? route('head-leases.update', lease.id) : route('head-leases.store'), { forceFormData: true });
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[
                    { label: t('leasing.headLeases.title'), href: route('head-leases.index') },
                    { label: isEditing ? lease.lease_number : title },
                ]}
                title={title}
                description={t('leasing.headLeases.form.description')}
                cancelHref={isEditing ? route('head-leases.show', lease.id) : route('head-leases.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.headLeases.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<SchedulePreview schedule={schedule} currency={currency} />}
            >
                {isEditing && lease.hasRecordedPayments && (
                    <Alert>
                        <CircleAlertIcon />
                        <AlertDescription>{t('leasing.headLeases.form.recordedWarning')}</AlertDescription>
                    </Alert>
                )}

                <FormSection title={t('leasing.headLeases.form.parties.title')} description={t('leasing.headLeases.form.parties.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('property_id')}
                            label={t('leasing.common.property')}
                            placeholder={t('leasing.common.chooseProperty')}
                            items={properties.map((property) => ({ value: property.id, label: `${property.name} · ${property.code}` }))}
                        />
                        <TextField {...bind('ejari_number')} label={t('leasing.common.ejariNumber')} optional />
                        <LandlordPicker landlords={landlords} data={data} setData={setData} errors={errors} />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.headLeases.form.terms.title')} description={t('leasing.headLeases.form.terms.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} type="date" label={t('leasing.common.startDate')} />
                        <TextField {...bind('end_date')} type="date" label={t('leasing.common.endDate')} />
                        <MoneyField {...bind('annual_rent')} label={t('leasing.headLeases.form.fields.annualRent')} currency={currency} suffix={t('leasing.common.perYear')} placeholder="780000" />
                        <MoneyField {...bind('security_deposit')} label={t('leasing.common.securityDeposit')} currency={currency} optional />
                        <ChoiceField
                            id="payments_per_year"
                            label={t('leasing.headLeases.form.fields.paymentsPerYear')}
                            value={data.payments_per_year}
                            onChange={(value) => setData('payments_per_year', Number(value))}
                            options={paymentsPerYear.map((count) => ({ value: count, label: t('leasing.headLeases.form.cheques', { count }) }))}
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
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.headLeases.form.documents.title')} description={t('leasing.headLeases.form.documents.description')}>
                    {!data.property_id ? (
                        <p className="text-sm text-muted-foreground">{t('leasing.headLeases.form.documents.choose')}</p>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-3">
                                <h3 className="text-sm font-bold">{t('leasing.headLeases.form.documents.onFile')}</h3>
                                {onFile.length > 0 ? (
                                    <DocumentsOnFile documents={onFile} leaseId={lease?.id} />
                                ) : (
                                    <p className="text-[0.8125rem] text-muted-foreground">{t('leasing.headLeases.form.documents.none')}</p>
                                )}
                            </div>
                            {slots.length > 0 && (
                                <RequiredDocuments
                                    slots={slots}
                                    errors={errors}
                                    onChange={updateDocument}
                                    title={t('leasing.headLeases.form.documents.missingTitle')}
                                    description={t('leasing.headLeases.form.documents.missingDescription')}
                                />
                            )}
                            <section className="flex flex-col gap-4 border-t pt-6">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <h3 className="text-sm font-bold">{t('leasing.headLeases.form.documents.additionalTitle')}</h3>
                                        <p className="text-[0.8125rem] text-muted-foreground">{t('leasing.headLeases.form.documents.additionalDescription')}</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setData('documents', [...data.documents, emptyDocument()])}>
                                        <FilePlusIcon data-icon="inline-start" />
                                        {t('propertyForm.documents.add')}
                                    </Button>
                                </div>
                                {extraIndexes.map((index) => (
                                    <DocumentFields
                                        key={`new-${index}`}
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
                    )}
                </FormSection>

                <FormSection title={t('leasing.common.status')} description={t('leasing.headLeases.form.statusDescription')}>
                    <ChoiceField
                        id="status"
                        label={t('leasing.common.status')}
                        value={data.status}
                        onChange={(value) => setData('status', value)}
                        options={statuses.map((status) => ({ value: status, label: t(`leasing.status.lease.${status}`) }))}
                        error={errors.status}
                    />
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
