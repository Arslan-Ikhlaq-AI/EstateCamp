import { ChoiceField, FormSection, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { Building2Icon, UserIcon } from 'lucide-react';

const TYPE_ICONS = { company: Building2Icon, individual: UserIcon };

const FIELDS = [
    'landlord_type', 'name', 'contact_person_name', 'email', 'phone', 'trade_license_number', 'id_number',
    'tax_registration_number', 'bank_name', 'account_name', 'iban', 'address', 'notes',
];

export default function Form({ landlord, types }) {
    const { t } = useTranslation();
    const isEditing = landlord !== null;
    const form = useForm(Object.fromEntries(FIELDS.map((field) => [field, landlord?.[field] ?? (field === 'landlord_type' ? 'company' : '')])));
    const { data, setData, errors, processing } = form;
    const isCompany = data.landlord_type === 'company';
    const title = isEditing ? t('leasing.landlords.form.editTitle') : t('leasing.landlords.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => (isEditing ? form.put(route('landlords.update', landlord.id)) : form.post(route('landlords.store')));

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[
                    { label: t('leasing.landlords.title'), href: route('landlords.index') },
                    { label: isEditing ? landlord.name : title },
                ]}
                title={title}
                description={t('leasing.landlords.form.description')}
                cancelHref={isEditing ? route('landlords.show', landlord.id) : route('landlords.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.landlords.form.save')}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('leasing.landlords.form.identity.title')} description={t('leasing.landlords.form.identity.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ChoiceField
                            id="landlord_type"
                            label={t('leasing.landlords.form.fields.type')}
                            value={data.landlord_type}
                            onChange={(value) => setData('landlord_type', value)}
                            options={types.map((type) => ({ value: type, label: t(`leasing.partyTypes.${type}`), icon: TYPE_ICONS[type] }))}
                            error={errors.landlord_type}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('name')}
                            label={isCompany ? t('leasing.landlords.form.fields.companyName') : t('leasing.landlords.form.fields.fullName')}
                            required
                            className="sm:col-span-2"
                        />
                        {isCompany ? (
                            <TextField {...bind('trade_license_number')} label={t('leasing.landlords.form.fields.tradeLicense')} optional />
                        ) : (
                            <TextField {...bind('id_number')} label={t('leasing.landlords.form.fields.idNumber')} placeholder="784-1975-1234567-1" optional />
                        )}
                        <TextField
                            {...bind('tax_registration_number')}
                            label={t('leasing.landlords.form.fields.trn')}
                            inputMode="numeric"
                            placeholder="100456789000003"
                            optional
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.landlords.form.contact.title')} description={t('leasing.landlords.form.contact.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('contact_person_name')} label={t('leasing.landlords.form.fields.contactPerson')} optional />
                        <TextField {...bind('phone')} type="tel" label={t('leasing.landlords.form.fields.phone')} optional />
                        <TextField {...bind('email')} type="email" label={t('leasing.landlords.form.fields.email')} optional className="sm:col-span-2" />
                        <TextareaField {...bind('address')} label={t('leasing.landlords.form.fields.address')} optional rows={2} className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.landlords.form.bank.title')} description={t('leasing.landlords.form.bank.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('bank_name')} label={t('leasing.landlords.form.fields.bankName')} optional />
                        <TextField {...bind('account_name')} label={t('leasing.landlords.form.fields.accountName')} optional />
                        <TextField
                            {...bind('iban')}
                            label={t('leasing.landlords.form.fields.iban')}
                            placeholder="AE07 0331 2345 6789 0123 456"
                            inputClassName="font-mono uppercase"
                            optional
                            className="sm:col-span-2"
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
