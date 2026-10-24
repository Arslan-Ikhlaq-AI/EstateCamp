import { ChoiceField, FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { ArrowDownIcon, ArrowUpIcon, Building2Icon, CircleAlertIcon, DoorOpenIcon, HouseIcon, SirenIcon, StoreIcon } from 'lucide-react';
import CostFields, { costValues } from './Partials/CostFields';
import { MaintenanceStatusBadge, useLookupNames } from '@/Components/MaintenanceBadges';

const UNIT_ICONS = { property: Building2Icon, room: DoorOpenIcon, apartment: HouseIcon, shop: StoreIcon };
const PRIORITY_ICONS = { low: ArrowDownIcon, high: ArrowUpIcon, urgent: SirenIcon };

// The property's list of each kind of unit.
const UNIT_LISTS = { room: 'rooms', apartment: 'apartments', shop: 'shops' };

const initialValues = (job, defaults, statuses, properties) => ({
    property_id: job?.property_id ?? defaults?.property_id ?? (properties.length === 1 ? properties[0].id : null),
    unit_type: job?.unit_type ?? defaults?.unit_type ?? 'property',
    room_id: job?.room_id ?? defaults?.room_id ?? null,
    apartment_id: job?.apartment_id ?? null,
    shop_id: job?.shop_id ?? null,
    location: job?.location ?? '',
    maintenance_category_id: job?.maintenance_category_id ?? null,
    ...(job ? {} : { maintenance_status_id: statuses[0]?.id ?? null }),
    title: job?.title ?? '',
    description: job?.description ?? '',
    priority: job?.priority ?? 'normal',
    reported_on: job?.reported_on ?? todayIso(),
    reported_by: job?.reported_by ?? '',
    vendor_name: job?.vendor_name ?? '',
    vendor_phone: job?.vendor_phone ?? '',
    completed_on: job?.completed_on ?? todayIso(),
    notes: job?.notes ?? '',
    ...costValues(job),
});

/**
 * Report a problem, or correct one: where it is, what is wrong, who fixes
 * it and what it cost. A new job also takes the status it starts in; a
 * finished one needs the amount charged and the invoice.
 */
export default function Form({ job, defaults, properties, categories, statuses, priorities, unitTypes, paymentMethods, currency }) {
    const { t } = useTranslation();
    const { categoryName, statusName } = useLookupNames();
    const isEditing = job !== null;
    const form = useForm(initialValues(job, defaults, statuses, properties));
    const { data, setData, errors, processing } = form;
    const property = properties.find((option) => option.id === data.property_id);
    const status = isEditing ? job.status : statuses.find((option) => option.id === data.maintenance_status_id);
    const isFinished = status?.stage === 'completed';
    const title = isEditing ? t('maintenance.form.editTitle', { number: job.number }) : t('maintenance.form.addTitle');
    const unitList = UNIT_LISTS[data.unit_type];
    const units = unitList ? (property?.[unitList] ?? []) : [];

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const chooseProperty = (propertyId) => {
        const next = properties.find((option) => option.id === propertyId);

        setData((current) => ({
            ...current,
            property_id: propertyId,
            unit_type: current.unit_type === 'property' || next?.[UNIT_LISTS[current.unit_type]]?.length ? current.unit_type : 'property',
            room_id: null,
            apartment_id: null,
            shop_id: null,
        }));
    };

    const submit = () => {
        if (isEditing) {
            form.transform((values) => ({ ...values, _method: 'put' }));
            form.post(route('maintenance.update', job.id), { forceFormData: true });
        } else {
            form.post(route('maintenance.store'), { forceFormData: true });
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('maintenance.title'), href: route('maintenance.index') }, { label: isEditing ? job.number : title }]}
                title={title}
                description={t('maintenance.form.description')}
                cancelHref={isEditing ? route('maintenance.show', job.id) : route('maintenance.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('maintenance.form.save')}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('maintenance.form.where.title')} description={t('maintenance.form.where.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            id="property_id"
                            label={t('maintenance.form.fields.property')}
                            placeholder={t('maintenance.form.fields.chooseProperty')}
                            value={data.property_id}
                            onChange={chooseProperty}
                            items={properties.map((option) => ({ value: option.id, label: `${option.name} · ${option.code}` }))}
                            error={errors.property_id}
                            className="sm:col-span-2"
                        />
                        <ChoiceField
                            id="unit_type"
                            label={t('maintenance.form.fields.unitType')}
                            value={data.unit_type}
                            onChange={(value) => setData('unit_type', value)}
                            options={unitTypes
                                .filter((type) => type === 'property' || type === data.unit_type || property?.[UNIT_LISTS[type]]?.length > 0)
                                .map((type) => ({ value: type, label: t(`maintenance.unitTypes.${type}`), icon: UNIT_ICONS[type] }))}
                            error={errors.unit_type}
                            className="sm:col-span-2"
                        />
                        {unitList && (
                            <SelectField
                                {...bind(`${data.unit_type}_id`)}
                                label={t(`maintenance.form.fields.${data.unit_type}`)}
                                placeholder={t(`maintenance.form.fields.choose${data.unit_type[0].toUpperCase()}${data.unit_type.slice(1)}`)}
                                items={units.map((unit) => ({
                                    value: unit.id,
                                    label: [t(`maintenance.unit.${data.unit_type}`, { number: unit.number }), unit.block].filter(Boolean).join(' · '),
                                }))}
                                description={property && units.length === 0 ? t(`maintenance.form.noUnits.${data.unit_type}`) : undefined}
                                disabled={!property}
                            />
                        )}
                        <TextField
                            {...bind('location')}
                            label={t('maintenance.form.fields.location')}
                            placeholder={t('maintenance.form.fields.locationPlaceholder')}
                            optional
                            dir="auto"
                            className={unitList ? undefined : 'sm:col-span-2'}
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('maintenance.form.problem.title')} description={t('maintenance.form.problem.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('maintenance_category_id')}
                            label={t('maintenance.form.fields.category')}
                            placeholder={t('maintenance.form.fields.chooseCategory')}
                            items={categories.map((category) => ({ value: category.id, label: categoryName(category) }))}
                        />
                        <TextField {...bind('reported_on')} type="date" max={todayIso()} label={t('maintenance.form.fields.reportedOn')} />
                        <TextField
                            {...bind('title')}
                            label={t('maintenance.form.fields.title')}
                            placeholder={t('maintenance.form.fields.titlePlaceholder')}
                            dir="auto"
                            className="sm:col-span-2"
                        />
                        <TextareaField {...bind('description')} label={t('maintenance.form.fields.description')} optional rows={3} className="sm:col-span-2" />
                        <ChoiceField
                            id="priority"
                            label={t('maintenance.form.fields.priority')}
                            value={data.priority}
                            onChange={(value) => setData('priority', value)}
                            options={priorities.map((priority) => ({ value: priority, label: t(`maintenance.priorities.${priority}`), icon: PRIORITY_ICONS[priority] }))}
                            error={errors.priority}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('reported_by')}
                            label={t('maintenance.form.fields.reportedBy')}
                            placeholder={t('maintenance.form.fields.reportedByPlaceholder')}
                            optional
                            dir="auto"
                        />
                        {isEditing ? (
                            <Field>
                                <FieldLabel>{t('maintenance.form.fields.status')}</FieldLabel>
                                <div className="flex h-9 items-center">
                                    <MaintenanceStatusBadge status={job.status} />
                                </div>
                                <FieldDescription>{t('maintenance.form.fields.currentStatus')}</FieldDescription>
                            </Field>
                        ) : (
                            <SelectField
                                {...bind('maintenance_status_id')}
                                label={t('maintenance.form.fields.status')}
                                items={statuses.map((option) => ({ value: option.id, label: statusName(option) }))}
                                description={t('maintenance.form.fields.statusHint')}
                            />
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('maintenance.form.work.title')} description={t('maintenance.form.work.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField
                            {...bind('vendor_name')}
                            label={t('maintenance.form.fields.vendorName')}
                            placeholder={t('maintenance.form.fields.vendorNamePlaceholder')}
                            optional
                            dir="auto"
                        />
                        <TextField {...bind('vendor_phone')} type="tel" label={t('maintenance.form.fields.vendorPhone')} optional />
                        {isFinished && (
                            <TextField
                                {...bind('completed_on')}
                                type="date"
                                min={data.reported_on || undefined}
                                max={todayIso()}
                                label={t('maintenance.form.fields.completedOn')}
                            />
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('maintenance.form.cost.title')} description={t('maintenance.form.cost.description')}>
                    <div className="flex flex-col gap-4">
                        {isFinished && (
                            <p className="flex items-center gap-2 rounded-lg bg-warning/[0.08] px-3 py-2 text-[0.8125rem] text-warning ring-1 ring-warning/25">
                                <CircleAlertIcon className="size-4 shrink-0" />
                                {t('maintenance.form.cost.required')}
                            </p>
                        )}
                        <CostFields
                            idPrefix="job"
                            data={data}
                            setData={setData}
                            errors={errors}
                            currency={currency}
                            paymentMethods={paymentMethods}
                            invoice={job?.invoice_url ? { url: job.invoice_url, name: job.invoice_name } : null}
                            required={isFinished}
                        />
                    </div>
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
