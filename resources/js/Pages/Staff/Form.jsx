import { SectionCard } from '@/Components/DetailCards';
import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import { LEVEL_ICONS, StaffAvatar, useStaffNames, Workplace } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { InfoIcon, ShieldCheckIcon, UserRoundIcon, UsersRoundIcon } from 'lucide-react';
import { Fragment } from 'react';

const DOCUMENTS = [
    { number: 'emirates_id_number', expiry: 'emirates_id_expiry', label: 'emiratesId' },
    { number: 'passport_number', expiry: 'passport_expiry', label: 'passport' },
    { number: 'visa_number', expiry: 'visa_expiry', label: 'visa' },
];

const ALLOWANCES = ['housing_allowance', 'transport_allowance', 'other_allowance'];

const LEFT_STATUSES = ['resigned', 'terminated'];

const ACCESS_ICONS = { self: UserRoundIcon, supervisor: UsersRoundIcon, admin: ShieldCheckIcon };

const initialValues = (staff, defaults, offices, properties) => ({
    full_name: staff?.full_name ?? '',
    gender: staff?.gender ?? 'male',
    nationality: staff?.nationality ?? '',
    date_of_birth: staff?.date_of_birth ?? '',
    phone: staff?.phone ?? '',
    email: staff?.email ?? '',
    work_level: staff?.work_level ?? defaults?.work_level ?? 'site',
    staff_role_id: staff?.staff_role_id ?? null,
    regional_office_id: staff?.regional_office_id ?? defaults?.regional_office_id ?? (offices.length === 1 ? offices[0].id : null),
    property_id: staff?.property_id ?? defaults?.property_id ?? (properties.length === 1 ? properties[0].id : null),
    employment_type: staff?.employment_type ?? 'full_time',
    joined_on: staff?.joined_on ?? todayIso(),
    status: staff?.status ?? 'active',
    left_on: staff?.left_on ?? '',
    ...Object.fromEntries(DOCUMENTS.flatMap((document) => [[document.number, staff?.[document.number] ?? ''], [document.expiry, staff?.[document.expiry] ?? '']])),
    basic_salary: staff?.basic_salary ?? '',
    ...Object.fromEntries(ALLOWANCES.map((field) => [field, staff?.[field] ?? ''])),
    salary_payment_method: staff?.salary_payment_method ?? 'bank_transfer',
    bank_name: staff?.bank_name ?? '',
    iban: staff?.iban ?? '',
    can_sign_in: staff?.can_sign_in ?? false,
    access: staff?.access ?? 'self',
    app_access: staff?.app_access ?? false,
    password: '',
    emergency_contact_name: staff?.emergency_contact_name ?? '',
    emergency_contact_phone: staff?.emergency_contact_phone ?? '',
    notes: staff?.notes ?? '',
});

/**
 * The role dropdown, grouped by level with the chosen level first.
 */
function RoleSelect({ roles, level, value, onChange, error }) {
    const { t } = useTranslation();
    const { roleName } = useStaffNames();
    const levels = [level, ...['head_office', 'regional', 'site'].filter((other) => other !== level)].filter((option) => roles.some((role) => role.level === option));
    const items = roles.map((role) => ({ value: role.id, label: roleName(role) }));

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="staff_role_id">{t('staff.form.fields.role')}</FieldLabel>
            <Select items={items} value={value ?? null} onValueChange={onChange}>
                <SelectTrigger id="staff_role_id" className="w-full" aria-invalid={Boolean(error)}>
                    <SelectValue placeholder={t('staff.form.fields.chooseRole')} />
                </SelectTrigger>
                <SelectContent>
                    {levels.map((option, index) => (
                        <Fragment key={option}>
                            {index > 0 && <SelectSeparator />}
                            <SelectGroup>
                                <SelectLabel>{t(`staff.levels.${option}`)}</SelectLabel>
                                {roles
                                    .filter((role) => role.level === option)
                                    .map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                            {roleName(role)}
                                        </SelectItem>
                                    ))}
                            </SelectGroup>
                        </Fragment>
                    ))}
                </SelectContent>
            </Select>
            {!error && <FieldDescription>{t('staff.form.fields.roleHint')}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * Who is being added, where, and what their salary comes to, kept up to
 * date while the form is filled in.
 */
function Summary({ staff, data, roles, offices, properties, currency }) {
    const { t, formatMoney } = useTranslation();
    const { roleName } = useStaffNames();
    const role = roles.find((option) => option.id === data.staff_role_id);
    const amount = (value) => Number.parseFloat(value) || 0;
    const monthly = amount(data.basic_salary) + ALLOWANCES.reduce((total, field) => total + amount(data[field]), 0);
    const workplace =
        data.work_level === 'regional'
            ? { type: 'office', name: offices.find((office) => office.id === data.regional_office_id)?.name }
            : data.work_level === 'site'
              ? { type: 'property', name: properties.find((property) => property.id === data.property_id)?.name }
              : { type: 'head_office' };

    return (
        <SectionCard title={t('staff.form.summary.title')}>
            <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                    <StaffAvatar name={data.full_name.trim() || '?'} className="size-11" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span dir="auto" className="truncate font-semibold">
                            {data.full_name.trim() || '—'}
                        </span>
                        <span dir="auto" className="truncate text-[0.8125rem] text-muted-foreground">
                            {role ? roleName(role) : t('staff.form.fields.chooseRole')}
                        </span>
                        <Workplace workplace={workplace} className="text-[0.8125rem] text-muted-foreground" />
                    </div>
                </div>
                <div className="flex flex-col gap-1 rounded-xl bg-brand-cyan/[0.06] p-4 ring-1 ring-brand-cyan/15">
                    <span className="text-xs text-muted-foreground">{t('staff.form.summary.monthly')}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatMoney(monthly, currency)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {t('staff.form.summary.daily')} · {formatMoney(monthly / 30, currency)}
                    </span>
                </div>
                <p className="flex gap-2 text-[0.8125rem] text-pretty text-muted-foreground">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    {t('staff.form.summary.explain')}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{staff ? staff.number : t('staff.form.summary.newNumber')}</p>
            </div>
        </SectionCard>
    );
}

/**
 * Add a staff member, or change one: who they are, their role and
 * workplace, their documents and their salary.
 */
export default function Form({ staff, defaults, roles, offices, properties, levels, genders, employmentTypes, statuses, paymentMethods, accessLevels, currency }) {
    const { t } = useTranslation();
    const { roleName } = useStaffNames();
    const isEditing = staff !== null;
    const form = useForm(initialValues(staff, defaults, offices, properties));
    const { data, setData, errors, processing } = form;
    const hasLeft = LEFT_STATUSES.includes(data.status);
    const title = isEditing ? t('staff.form.editTitle', { name: staff.full_name }) : t('staff.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const role = roles.find((option) => option.id === data.staff_role_id);

    // A role chosen from another level moves the person to that level; the level can still be changed after.
    // Until they have a sign-in, what it would allow follows the role too.
    const chooseRole = (roleId) => {
        const next = roles.find((option) => option.id === roleId);

        setData((current) => ({
            ...current,
            staff_role_id: roleId,
            work_level: next?.level ?? current.work_level,
            ...(next && !staff?.has_sign_in ? { access: next.staff_access, app_access: next.app_access } : {}),
        }));
    };

    const submit = () => {
        if (isEditing) {
            form.put(route('staff.update', staff.id));
        } else {
            form.post(route('staff.store'));
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('staff.title'), href: route('staff.index') }, { label: isEditing ? staff.full_name : title }]}
                title={title}
                description={t('staff.form.description')}
                cancelHref={isEditing ? route('staff.show', staff.id) : route('staff.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('staff.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<Summary staff={staff} data={data} roles={roles} offices={offices} properties={properties} currency={currency} />}
            >
                <FormSection title={t('staff.form.personal.title')} description={t('staff.form.personal.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField
                            {...bind('full_name')}
                            label={t('staff.form.fields.fullName')}
                            placeholder={t('staff.form.fields.fullNamePlaceholder')}
                            autoComplete="off"
                            dir="auto"
                            className="sm:col-span-2"
                        />
                        <ChoiceField
                            id="gender"
                            label={t('staff.form.fields.gender')}
                            value={data.gender}
                            onChange={(value) => setData('gender', value)}
                            options={genders.map((gender) => ({ value: gender, label: t(`staff.genders.${gender}`) }))}
                            error={errors.gender}
                        />
                        <TextField
                            {...bind('nationality')}
                            label={t('staff.form.fields.nationality')}
                            placeholder={t('staff.form.fields.nationalityPlaceholder')}
                            optional
                            dir="auto"
                        />
                        <TextField {...bind('date_of_birth')} type="date" max={todayIso()} label={t('staff.form.fields.dateOfBirth')} optional />
                        <TextField {...bind('phone')} type="tel" label={t('staff.form.fields.phone')} optional />
                        <TextField {...bind('email')} type="email" label={t('staff.form.fields.email')} optional={!data.can_sign_in} className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('staff.form.job.title')} description={t('staff.form.job.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ChoiceField
                            id="work_level"
                            label={t('staff.form.fields.level')}
                            value={data.work_level}
                            onChange={(value) => setData('work_level', value)}
                            options={levels.map((level) => ({ value: level, label: t(`staff.levels.${level}`), icon: LEVEL_ICONS[level] }))}
                            error={errors.work_level}
                            className="sm:col-span-2"
                        />
                        <RoleSelect roles={roles} level={data.work_level} value={data.staff_role_id} onChange={chooseRole} error={errors.staff_role_id} />
                        {data.work_level === 'regional' && (
                            <SelectField
                                {...bind('regional_office_id')}
                                label={t('staff.form.fields.office')}
                                placeholder={t('staff.form.fields.chooseOffice')}
                                items={offices.map((office) => ({ value: office.id, label: [office.name, office.city].filter(Boolean).join(' · ') }))}
                                description={offices.length === 0 ? t('staff.form.fields.noOffices') : undefined}
                                disabled={offices.length === 0}
                            />
                        )}
                        {data.work_level === 'site' && (
                            <SelectField
                                {...bind('property_id')}
                                label={t('staff.form.fields.property')}
                                placeholder={t('staff.form.fields.chooseProperty')}
                                items={properties.map((property) => ({ value: property.id, label: `${property.name} · ${property.code}` }))}
                            />
                        )}
                        <ChoiceField
                            id="employment_type"
                            label={t('staff.form.fields.employmentType')}
                            value={data.employment_type}
                            onChange={(value) => setData('employment_type', value)}
                            options={employmentTypes.map((type) => ({ value: type, label: t(`staff.employmentTypes.${type}`) }))}
                            error={errors.employment_type}
                            className="sm:col-span-2"
                        />
                        <TextField {...bind('joined_on')} type="date" label={t('staff.form.fields.joinedOn')} />
                        <SelectField
                            {...bind('status')}
                            label={t('staff.form.fields.status')}
                            items={statuses.map((status) => ({ value: status, label: t(`staff.statuses.${status}`) }))}
                        />
                        {hasLeft && <TextField {...bind('left_on')} type="date" min={data.joined_on || undefined} label={t('staff.form.fields.leftOn')} />}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('staff.form.documents.title')} description={t('staff.form.documents.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        {DOCUMENTS.map((document) => (
                            <Fragment key={document.label}>
                                <TextField
                                    {...bind(document.number)}
                                    label={t(`staff.form.fields.${document.label}Number`)}
                                    optional
                                    autoComplete="off"
                                    inputClassName="font-mono"
                                />
                                <TextField {...bind(document.expiry)} type="date" label={t(`staff.form.fields.${document.label}Expiry`)} optional />
                            </Fragment>
                        ))}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('staff.form.salary.title')} description={t('staff.form.salary.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <MoneyField {...bind('basic_salary')} label={t('staff.form.fields.basicSalary')} currency={currency} suffix={t('leasing.common.perMonth')} />
                        <MoneyField {...bind('housing_allowance')} label={t('staff.form.fields.housingAllowance')} currency={currency} placeholder="0" optional />
                        <MoneyField {...bind('transport_allowance')} label={t('staff.form.fields.transportAllowance')} currency={currency} placeholder="0" optional />
                        <MoneyField {...bind('other_allowance')} label={t('staff.form.fields.otherAllowance')} currency={currency} placeholder="0" optional />
                        <ChoiceField
                            id="salary_payment_method"
                            label={t('staff.form.fields.paymentMethod')}
                            value={data.salary_payment_method}
                            onChange={(value) => setData('salary_payment_method', value)}
                            options={paymentMethods.map((method) => ({ value: method, label: t(`staff.paymentMethods.${method}`) }))}
                            error={errors.salary_payment_method}
                            className="sm:col-span-2"
                        />
                        {data.salary_payment_method === 'bank_transfer' && (
                            <>
                                <TextField {...bind('bank_name')} label={t('staff.form.fields.bankName')} optional dir="auto" />
                                <TextField
                                    {...bind('iban')}
                                    label={t('staff.form.fields.iban')}
                                    placeholder="AE07 0331 2345 6789 0123 456"
                                    optional
                                    autoComplete="off"
                                    inputClassName="font-mono uppercase"
                                />
                            </>
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('staff.form.signIn.title')} description={t('staff.form.signIn.description')}>
                    <FieldGroup className="gap-5">
                        <Field orientation="horizontal">
                            <Checkbox id="can_sign_in" checked={data.can_sign_in} onCheckedChange={(checked) => setData('can_sign_in', Boolean(checked))} />
                            <div className="flex flex-col gap-0.5">
                                <FieldLabel htmlFor="can_sign_in">{t('staff.form.signIn.enable')}</FieldLabel>
                                <FieldDescription>{t('staff.form.signIn.enableHint')}</FieldDescription>
                            </div>
                        </Field>
                        {data.can_sign_in && (
                            <>
                                <ChoiceField
                                    id="access"
                                    label={t('staff.form.signIn.access')}
                                    value={data.access}
                                    onChange={(value) => setData('access', value)}
                                    options={accessLevels.map((level) => ({ value: level, label: t(`staff.access.levels.${level}`), icon: ACCESS_ICONS[level] }))}
                                    description={[t(`staff.access.descriptions.${data.access}`), role && t('staff.form.signIn.roleDefault', { role: roleName(role) })].filter(Boolean).join(' ')}
                                    error={errors.access}
                                />
                                <Field orientation="horizontal" data-invalid={errors.app_access ? true : undefined}>
                                    <Checkbox id="app_access" checked={data.app_access} onCheckedChange={(checked) => setData('app_access', Boolean(checked))} />
                                    <div className="flex flex-col gap-0.5">
                                        <FieldLabel htmlFor="app_access" className="font-normal">
                                            {t('staff.access.app')}
                                        </FieldLabel>
                                        <FieldError>{errors.app_access}</FieldError>
                                    </div>
                                </Field>
                                <TextField
                                    {...bind('password')}
                                    type="password"
                                    autoComplete="new-password"
                                    label={staff?.has_sign_in ? t('staff.form.signIn.newPassword') : t('staff.form.signIn.password')}
                                    description={staff?.has_sign_in ? t('staff.form.signIn.keepPasswordHint') : t('staff.form.signIn.passwordHint')}
                                    optional={staff?.has_sign_in}
                                    className="sm:max-w-sm"
                                />
                            </>
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('staff.form.emergency.title')} description={t('staff.form.emergency.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('emergency_contact_name')} label={t('staff.form.fields.emergencyName')} optional dir="auto" />
                        <TextField {...bind('emergency_contact_phone')} type="tel" label={t('staff.form.fields.emergencyPhone')} optional />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
