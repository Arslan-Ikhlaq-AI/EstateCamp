import { ChoiceField, SelectField, TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Building2Icon, UserIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

export const emptyClient = () => ({
    client_type: 'company',
    name: '',
    contact_person_name: '',
    phone: '',
    email: '',
    trade_license_number: '',
    id_type: 'emirates_id',
    id_number: '',
});

/**
 * Who the contract is with: one of the company's clients, or a new client
 * entered here and saved with the contract. `data` holds `client_mode`
 * ('existing' or 'new'), `client_id` and `new_client`.
 */
export default function ClientPicker({ clients, clientTypes, idTypes, data, setData, errors }) {
    const { t } = useTranslation();
    const client = data.new_client;
    const setClient = (field) => (value) => setData('new_client', { ...client, [field]: value });
    const isCompany = client.client_type === 'company';

    if (data.client_mode !== 'new') {
        return (
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-start">
                <SelectField
                    id="client_id"
                    className="flex-1"
                    label={t('leasing.contracts.form.fields.client')}
                    placeholder={t('leasing.contracts.form.fields.chooseClient')}
                    value={data.client_id}
                    onChange={(value) => setData('client_id', value)}
                    items={clients.map((item) => ({ value: item.id, label: item.name }))}
                    error={errors.client_id}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="sm:mt-[1.875rem]"
                    onClick={() => setData((current) => ({ ...current, client_mode: 'new', client_id: null }))}
                >
                    <UserPlusIcon data-icon="inline-start" />
                    {t('leasing.contracts.form.clientPicker.create')}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl bg-accent/60 p-4 inset-ring inset-ring-brand-cyan/20 motion-safe:animate-enter sm:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan to-brand-navy text-white">
                        <UserPlusIcon className="size-4" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{t('leasing.contracts.form.clientPicker.newTitle')}</span>
                        <span className="text-[0.8125rem] text-muted-foreground">{t('leasing.contracts.form.clientPicker.newDescription')}</span>
                    </div>
                </div>
                {clients.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setData('client_mode', 'existing')}>
                        <UsersIcon data-icon="inline-start" />
                        {t('leasing.contracts.form.clientPicker.useExisting')}
                    </Button>
                )}
            </div>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    id="new_client_type"
                    className="sm:col-span-2"
                    label={t('leasing.clients.form.fields.type')}
                    value={client.client_type}
                    onChange={setClient('client_type')}
                    error={errors['new_client.client_type']}
                    options={clientTypes.map((type) => ({
                        value: type,
                        label: t(`leasing.partyTypes.${type}`),
                        icon: type === 'company' ? Building2Icon : UserIcon,
                    }))}
                />
                <TextField
                    id="new_client_name"
                    className="sm:col-span-2"
                    label={isCompany ? t('leasing.clients.form.fields.companyName') : t('leasing.clients.form.fields.fullName')}
                    value={client.name}
                    onChange={setClient('name')}
                    error={errors['new_client.name']}
                />
                {isCompany ? (
                    <>
                        <TextField
                            id="new_client_trade_license"
                            label={t('leasing.clients.form.fields.tradeLicense')}
                            value={client.trade_license_number}
                            onChange={setClient('trade_license_number')}
                            error={errors['new_client.trade_license_number']}
                            optional
                        />
                        <TextField
                            id="new_client_contact"
                            label={t('leasing.clients.form.fields.contactPerson')}
                            value={client.contact_person_name}
                            onChange={setClient('contact_person_name')}
                            error={errors['new_client.contact_person_name']}
                            optional
                        />
                    </>
                ) : (
                    <>
                        <SelectField
                            id="new_client_id_type"
                            label={t('leasing.clients.form.fields.idType')}
                            value={client.id_type}
                            onChange={setClient('id_type')}
                            items={idTypes.map((type) => ({ value: type, label: t(`leasing.idTypes.${type}`) }))}
                            error={errors['new_client.id_type']}
                        />
                        <TextField
                            id="new_client_id_number"
                            label={t('leasing.clients.form.fields.idNumber')}
                            value={client.id_number}
                            onChange={setClient('id_number')}
                            error={errors['new_client.id_number']}
                            inputClassName="font-mono"
                        />
                    </>
                )}
                <TextField
                    id="new_client_phone"
                    type="tel"
                    label={t('leasing.clients.form.fields.phone')}
                    value={client.phone}
                    onChange={setClient('phone')}
                    error={errors['new_client.phone']}
                    placeholder="+971 50 000 0000"
                    optional
                />
                <TextField
                    id="new_client_email"
                    type="email"
                    label={t('leasing.clients.form.fields.email')}
                    value={client.email}
                    onChange={setClient('email')}
                    error={errors['new_client.email']}
                    optional
                />
            </FieldGroup>
        </div>
    );
}
