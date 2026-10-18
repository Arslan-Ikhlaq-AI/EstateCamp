import { ChoiceField, SelectField, TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Building2Icon, UserIcon, UserPlusIcon, UsersIcon } from 'lucide-react';

export const emptyLandlord = () => ({
    landlord_type: 'company',
    name: '',
    contact_person_name: '',
    phone: '',
    email: '',
});

/**
 * Who a leased property is rented from: one of the company's landlords, or a
 * new landlord entered here, which is saved with the property.
 * `data` holds `landlord_mode` ('existing' or 'new'), `landlord_id` and
 * `new_landlord`.
 */
export default function LandlordPicker({ landlords, data, setData, errors }) {
    const { t } = useTranslation();
    const isNew = data.landlord_mode === 'new';
    const landlord = data.new_landlord;
    const setLandlord = (field) => (value) => setData('new_landlord', { ...landlord, [field]: value });

    if (!isNew) {
        return (
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-start">
                <SelectField
                    id="landlord_id"
                    className="flex-1"
                    label={t('propertyForm.landlord.label')}
                    value={data.landlord_id}
                    onChange={(value) => setData('landlord_id', value)}
                    items={landlords.map((item) => ({ value: item.id, label: item.name }))}
                    placeholder={t('propertyForm.landlord.choose')}
                    error={errors.landlord_id}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="sm:mt-[1.875rem]"
                    onClick={() => setData((current) => ({ ...current, landlord_mode: 'new', landlord_id: null }))}
                >
                    <UserPlusIcon data-icon="inline-start" />
                    {t('propertyForm.landlord.create')}
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
                        <span className="text-sm font-semibold">{t('propertyForm.landlord.newTitle')}</span>
                        <span className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.landlord.newDescription')}</span>
                    </div>
                </div>
                {landlords.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setData('landlord_mode', 'existing')}>
                        <UsersIcon data-icon="inline-start" />
                        {t('propertyForm.landlord.useExisting')}
                    </Button>
                )}
            </div>

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    id="new_landlord_type"
                    className="sm:col-span-2"
                    label={t('propertyForm.landlord.type')}
                    value={landlord.landlord_type}
                    onChange={setLandlord('landlord_type')}
                    error={errors['new_landlord.landlord_type']}
                    options={[
                        { value: 'company', label: t('leasing.partyTypes.company'), icon: Building2Icon },
                        { value: 'individual', label: t('leasing.partyTypes.individual'), icon: UserIcon },
                    ]}
                />
                <TextField
                    id="new_landlord_name"
                    label={t('propertyForm.fields.landlordName')}
                    value={landlord.name}
                    onChange={setLandlord('name')}
                    error={errors['new_landlord.name']}
                    required
                />
                {landlord.landlord_type === 'company' && (
                    <TextField
                        id="new_landlord_contact"
                        label={t('propertyForm.landlord.contact')}
                        value={landlord.contact_person_name}
                        onChange={setLandlord('contact_person_name')}
                        error={errors['new_landlord.contact_person_name']}
                        optional
                    />
                )}
                <TextField
                    id="new_landlord_phone"
                    type="tel"
                    label={t('propertyForm.fields.landlordPhone')}
                    value={landlord.phone}
                    onChange={setLandlord('phone')}
                    error={errors['new_landlord.phone']}
                    placeholder="+971 4 000 0000"
                    optional
                />
                <TextField
                    id="new_landlord_email"
                    type="email"
                    label={t('propertyForm.landlord.email')}
                    value={landlord.email}
                    onChange={setLandlord('email')}
                    error={errors['new_landlord.email']}
                    optional
                />
            </FieldGroup>
        </div>
    );
}
