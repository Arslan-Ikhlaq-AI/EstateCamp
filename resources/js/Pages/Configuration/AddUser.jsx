import { SectionCard } from '@/Components/DetailCards';
import { FormSection, PasswordField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import { StaffAvatar } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { Building2Icon, InfoIcon } from 'lucide-react';
import CampPicker from './Partials/CampPicker';
import RolePicker from './Partials/RolePicker';
import { roleIcon } from './Partials/UserAccess';

/**
 * Who is being added, their role, how much of the app it opens and their
 * camps, kept up to date while the form is filled in.
 */
function Summary({ data, role, properties, available }) {
    const { t, tOr, formatNumber } = useTranslation();
    const isFull = role?.value === 'super_admin';
    const share = role && available > 0 ? Math.min(100, (role.permissions.length / available) * 100) : 0;
    const camps = properties.filter((property) => data.property_ids.includes(property.id)).map((property) => property.name);
    const Icon = roleIcon(role?.value);

    return (
        <SectionCard title={t('permissions.addUser.summary.title')}>
            <div className="flex flex-col gap-5">
                <div className="flex min-w-0 items-center gap-3">
                    <StaffAvatar name={data.name.trim() || '?'} className="size-11" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span dir="auto" className="truncate font-semibold">
                            {data.name.trim() || '—'}
                        </span>
                        <span className="truncate text-[0.8125rem] text-muted-foreground">{data.email.trim() || t('permissions.addUser.summary.noEmail')}</span>
                    </div>
                </div>

                {role && (
                    <div className="flex flex-col gap-3 rounded-xl bg-brand-cyan/[0.06] p-4 ring-1 ring-brand-cyan/15">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={isFull ? 'warning' : 'info'}>
                                <Icon data-icon="inline-start" />
                                {tOr(`permissions.roles.${role.value}.name`, role.name)}
                            </Badge>
                            {role.camps && (
                                <Badge variant={camps.length === 0 ? 'destructive' : 'outline'} title={camps.join(', ')}>
                                    <Building2Icon data-icon="inline-start" />
                                    {camps.length === 1 ? camps[0] : camps.length === 0 ? t('permissions.users.noCamps') : t('permissions.users.camps', { count: camps.length })}
                                </Badge>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium tabular-nums">
                                {isFull ? t('permissions.users.everything') : t('permissions.users.count', { count: formatNumber(role.permissions.length), total: formatNumber(available) })}
                            </span>
                            <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <span
                                    className={cn('block h-full rounded-full bg-linear-to-r from-brand-cyan to-brand-navy rtl:bg-linear-to-l', isFull && 'from-brand-sun to-gold')}
                                    style={{ width: `${isFull ? 100 : share}%` }}
                                />
                            </span>
                        </div>
                    </div>
                )}

                <p className="flex gap-2 text-[0.8125rem] text-pretty text-muted-foreground">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" />
                    {t('permissions.addUser.summary.next')}
                </p>
            </div>
        </SectionCard>
    );
}

/**
 * Add a user to the company: a name, the email and password they sign in
 * with, a role from those the signed-in user may give, and for an area
 * manager or camp boss, their camps. Saving opens their permissions.
 */
export default function AddUser({ available, roles, properties }) {
    const { t } = useTranslation();
    const givable = roles.filter((role) => role.givable);
    const form = useForm({ name: '', email: '', password: '', role: givable.find((role) => role.value !== 'super_admin')?.value ?? givable[0]?.value ?? null, property_ids: [] });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `user-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });
    const chosen = roles.find((role) => role.value === data.role);
    const listHref = route('configuration.users');
    const title = t('permissions.users.add');

    // A camp boss runs one camp, so choosing the role keeps the first of several.
    const chooseRole = (value) =>
        setData((current) => ({ ...current, role: value, property_ids: value === 'camp_boss' ? current.property_ids.slice(0, 1) : current.property_ids }));

    const submit = () => {
        form.transform((values) => ({ ...values, property_ids: chosen?.camps ? values.property_ids : [] }));
        form.post(route('configuration.users.store'));
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.configuration') }, { label: t('permissions.users.title'), href: listHref }, { label: title }]}
                title={title}
                description={t('permissions.users.addDescription')}
                cancelHref={listHref}
                submitLabel={title}
                processing={processing}
                onSubmit={submit}
                aside={<Summary data={data} role={chosen} properties={properties} available={available} />}
            >
                <FormSection title={t('permissions.addUser.details.title')} description={t('permissions.addUser.details.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('name')} label={t('permissions.users.fields.name')} autoComplete="off" dir="auto" />
                        <TextField {...bind('email')} type="email" label={t('permissions.users.fields.email')} autoComplete="off" />
                        <PasswordField {...bind('password')} label={t('permissions.users.fields.password')} description={t('permissions.users.fields.passwordHint')} className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('permissions.user.roleSection')} description={t('permissions.addUser.roleDescription')}>
                    <RolePicker roles={roles} value={data.role} error={errors.role} onChange={chooseRole} />
                </FormSection>

                {chosen?.camps && (
                    <FormSection title={t('permissions.user.campsSection')} description={t(chosen.campLimit === 1 ? 'permissions.user.campsOneDescription' : 'permissions.user.campsDescription')}>
                        <CampPicker
                            properties={properties}
                            value={data.property_ids}
                            limit={chosen.campLimit}
                            error={errors.property_ids ?? errors['property_ids.0']}
                            onChange={(ids) => setData('property_ids', ids)}
                        />
                    </FormSection>
                )}
            </FormShell>
        </DashboardLayout>
    );
}
