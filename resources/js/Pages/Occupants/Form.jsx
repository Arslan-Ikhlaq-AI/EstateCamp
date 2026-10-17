import { ChoiceField, FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import { MarsIcon, VenusIcon } from 'lucide-react';

const GENDER_ICONS = { male: MarsIcon, female: VenusIcon };

const FIELDS = ['client_id', 'full_name', 'gender', 'nationality', 'id_type', 'id_number', 'phone', 'employee_number', 'notes'];

export default function Form({ occupant, clientId, clients, genders, idTypes }) {
    const { t } = useTranslation();
    const isEditing = occupant !== null;
    const defaults = { client_id: clientId, gender: 'male', id_type: 'passport' };
    const form = useForm(Object.fromEntries(FIELDS.map((field) => [field, occupant?.[field] ?? defaults[field] ?? ''])));
    const { data, setData, errors, processing } = form;
    const title = isEditing ? t('leasing.occupants.form.editTitle') : t('leasing.occupants.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => {
        // An occupant without an ID number keeps no ID type either.
        form.transform((values) => (values.id_number ? values : { ...values, id_type: null }));

        if (isEditing) {
            form.put(route('occupants.update', occupant.id));
        } else {
            form.post(route('occupants.store'));
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('leasing.occupants.title'), href: route('occupants.index') }, { label: isEditing ? occupant.full_name : title }]}
                title={title}
                description={t('leasing.occupants.form.description')}
                cancelHref={isEditing ? route('occupants.show', occupant.id) : route('occupants.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.occupants.form.save')}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('leasing.occupants.form.client.title')} description={t('leasing.occupants.form.client.description')}>
                    <SelectField
                        {...bind('client_id')}
                        label={t('leasing.occupants.columns.client')}
                        placeholder={t('leasing.contracts.form.fields.chooseClient')}
                        items={clients.map((client) => ({ value: client.id, label: `${client.name} · ${t(`leasing.partyTypes.${client.client_type}`)}` }))}
                        description={
                            <Link href={route('clients.create')} className="underline underline-offset-3 hover:text-foreground">
                                {t('leasing.contracts.form.fields.newClient')}
                            </Link>
                        }
                    />
                </FormSection>

                <FormSection title={t('leasing.occupants.form.person.title')} description={t('leasing.occupants.form.person.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('full_name')} label={t('leasing.occupants.form.fields.fullName')} className="sm:col-span-2" />
                        <ChoiceField
                            id="gender"
                            label={t('leasing.occupants.columns.gender')}
                            value={data.gender}
                            onChange={(value) => setData('gender', value)}
                            options={genders.map((gender) => ({ value: gender, label: t(`gender.${gender}`), icon: GENDER_ICONS[gender] }))}
                            description={t('leasing.occupants.form.genderHint')}
                            error={errors.gender}
                        />
                        <TextField {...bind('nationality')} label={t('leasing.clients.form.fields.nationality')} optional />
                        <SelectField
                            {...bind('id_type')}
                            label={t('leasing.clients.form.fields.idType')}
                            items={idTypes.map((type) => ({ value: type, label: t(`leasing.idTypes.${type}`) }))}
                        />
                        <TextField {...bind('id_number')} label={t('leasing.clients.form.fields.idNumber')} inputClassName="font-mono" optional />
                        <TextField {...bind('phone')} type="tel" label={t('leasing.clients.form.fields.phone')} optional />
                        <TextField {...bind('employee_number')} label={t('leasing.occupants.form.fields.employeeNumber')} optional />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
