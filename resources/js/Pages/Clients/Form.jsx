import { ChoiceField, FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { Building2Icon, UserIcon } from 'lucide-react';

const TYPE_ICONS = { company: Building2Icon, individual: UserIcon };

const FIELDS = [
    'client_type', 'name', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'tax_registration_number',
    'id_type', 'id_number', 'nationality', 'address', 'status', 'notes',
];

const DEFAULTS = { client_type: 'company', status: 'active', id_type: 'passport' };

export default function Form({ client, defaultType = 'company', types, statuses, idTypes }) {
    const { t } = useTranslation();
    const isEditing = client !== null;
    const defaults = { ...DEFAULTS, client_type: defaultType };
    const form = useForm(Object.fromEntries(FIELDS.map((field) => [field, client?.[field] ?? defaults[field] ?? ''])));
    const { data, setData, errors, processing } = form;
    const isCompany = data.client_type === 'company';
    const title = isEditing ? t('leasing.clients.form.editTitle') : t('leasing.clients.form.addTitle');
    const isPersonList = (client?.client_type ?? defaultType) === 'individual';
    const listTitle = isPersonList ? t('leasing.individuals.title') : t('leasing.clients.title');
    const listHref = isPersonList ? route('individuals.index') : route('clients.index');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => (isEditing ? form.put(route('clients.update', client.id)) : form.post(route('clients.store')));

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: listTitle, href: listHref }, { label: isEditing ? client.name : title }]}
                title={title}
                description={t('leasing.clients.form.description')}
                cancelHref={isEditing ? route('clients.show', client.id) : listHref}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.clients.form.save')}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('leasing.clients.form.identity.title')} description={t('leasing.clients.form.identity.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ChoiceField
                            id="client_type"
                            label={t('leasing.clients.form.fields.type')}
                            value={data.client_type}
                            onChange={(value) => setData('client_type', value)}
                            options={types.map((type) => ({ value: type, label: t(`leasing.partyTypes.${type}`), icon: TYPE_ICONS[type] }))}
                            description={t('leasing.clients.form.typeHint')}
                            error={errors.client_type}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('name')}
                            label={isCompany ? t('leasing.clients.form.fields.companyName') : t('leasing.clients.form.fields.fullName')}
                            className="sm:col-span-2"
                        />
                        {isCompany ? (
                            <>
                                <TextField {...bind('trade_license_number')} label={t('leasing.clients.form.fields.tradeLicense')} optional />
                                <TextField {...bind('tax_registration_number')} label={t('leasing.clients.form.fields.trn')} inputMode="numeric" optional />
                            </>
                        ) : (
                            <>
                                <SelectField
                                    {...bind('id_type')}
                                    label={t('leasing.clients.form.fields.idType')}
                                    items={idTypes.map((type) => ({ value: type, label: t(`leasing.idTypes.${type}`) }))}
                                />
                                <TextField {...bind('id_number')} label={t('leasing.clients.form.fields.idNumber')} inputClassName="font-mono" />
                                <TextField {...bind('nationality')} label={t('leasing.clients.form.fields.nationality')} optional />
                            </>
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.clients.form.contact.title')} description={t('leasing.clients.form.contact.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        {isCompany && <TextField {...bind('contact_person_name')} label={t('leasing.clients.form.fields.contactPerson')} optional />}
                        <TextField {...bind('phone')} type="tel" label={t('leasing.clients.form.fields.phone')} optional />
                        <TextField {...bind('email')} type="email" label={t('leasing.clients.form.fields.email')} optional />
                        <TextareaField {...bind('address')} label={t('leasing.clients.form.fields.address')} optional rows={2} className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.common.status')} description={t('leasing.clients.form.statusDescription')}>
                    <ChoiceField
                        id="status"
                        label={t('leasing.common.status')}
                        value={data.status}
                        onChange={(value) => setData('status', value)}
                        options={statuses.map((status) => ({ value: status, label: t(`leasing.status.client.${status}`) }))}
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
