import { ChoiceField, SelectField, TextField } from '@/Components/FormFields';
import { useTranslation } from '@/hooks/use-translation';
import { Building2Icon, UserIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

export const emptyClient = () => ({
    client_type: 'company',
    name: '',
    phone: '',
    contact_person_name: '',
    email: '',
    trade_license_number: '',
    tax_registration_number: '',
    id_type: 'emirates_id',
    id_number: '',
    address: '',
});

/**
 * Who the contract is with, laid out like the short-term rental form: two
 * buttons choose between one of the company's clients and a new client
 * entered here and saved with the contract, and only the chosen one's
 * fields show. `data` holds `client_mode` ('existing' or 'new'), `client_id`
 * and `new_client`. Rendered inside a two-column field grid.
 */
export default function ClientPicker({ clients, clientTypes, idTypes, data, setData, errors }) {
    const { t } = useTranslation();
    const client = data.new_client;
    const isCompany = client.client_type === 'company';
    const bindNew = (field) => ({
        id: `new_client_${field}`,
        value: client[field],
        onChange: (value) => setData('new_client', { ...client, [field]: value }),
        error: errors[`new_client.${field}`],
    });

    return (
        <>
            {clients.length > 0 && (
                <ChoiceField
                    id="client_mode"
                    label={t('leasing.contracts.form.fields.client')}
                    value={data.client_mode}
                    onChange={(mode) => setData('client_mode', mode)}
                    options={[
                        { value: 'existing', label: t('leasing.contracts.form.clientPicker.existing'), icon: UsersIcon },
                        { value: 'new', label: t('leasing.contracts.form.clientPicker.new'), icon: UserPlusIcon },
                    ]}
                    error={errors.client_mode}
                    className="sm:col-span-2"
                />
            )}
            {data.client_mode === 'existing' ? (
                <SelectField
                    id="client_id"
                    label={t('leasing.contracts.form.fields.client')}
                    placeholder={t('leasing.contracts.form.fields.chooseClient')}
                    value={data.client_id}
                    onChange={(clientId) => setData('client_id', clientId)}
                    items={clients.map((item) => ({ value: item.id, label: [item.name, item.phone].filter(Boolean).join(' · ') }))}
                    error={errors.client_id}
                    className="sm:col-span-2"
                />
            ) : (
                <>
                    <ChoiceField
                        {...bindNew('client_type')}
                        label={t('leasing.clients.form.fields.type')}
                        options={clientTypes.map((type) => ({ value: type, label: t(`leasing.partyTypes.${type}`), icon: type === 'company' ? Building2Icon : UserIcon }))}
                        className="sm:col-span-2"
                    />
                    <TextField
                        {...bindNew('name')}
                        label={isCompany ? t('leasing.clients.form.fields.companyName') : t('leasing.clients.form.fields.fullName')}
                        dir="auto"
                    />
                    <TextField {...bindNew('phone')} label={t('leasing.clients.form.fields.phone')} type="tel" inputMode="tel" optional />
                    {isCompany ? (
                        <>
                            <TextField {...bindNew('contact_person_name')} label={t('leasing.clients.form.fields.contactPerson')} dir="auto" optional />
                            <TextField {...bindNew('email')} label={t('leasing.clients.form.fields.email')} type="email" optional />
                            <TextField {...bindNew('trade_license_number')} label={t('leasing.clients.form.fields.tradeLicense')} inputClassName="font-mono" optional />
                            <TextField
                                {...bindNew('tax_registration_number')}
                                label={t('leasing.clients.form.fields.trn')}
                                inputMode="numeric"
                                inputClassName="font-mono"
                                description={t('leasing.contracts.form.clientPicker.trnHint')}
                                optional
                            />
                        </>
                    ) : (
                        <>
                            <SelectField
                                {...bindNew('id_type')}
                                label={t('leasing.clients.form.fields.idType')}
                                items={idTypes.map((type) => ({ value: type, label: t(`leasing.idTypes.${type}`) }))}
                            />
                            <TextField {...bindNew('id_number')} label={t('leasing.clients.form.fields.idNumber')} inputClassName="font-mono" />
                            <TextField {...bindNew('email')} label={t('leasing.clients.form.fields.email')} type="email" optional className="sm:col-span-2" />
                        </>
                    )}
                    <TextField {...bindNew('address')} label={t('leasing.clients.form.fields.address')} dir="auto" optional className="sm:col-span-2" />
                </>
            )}
        </>
    );
}
