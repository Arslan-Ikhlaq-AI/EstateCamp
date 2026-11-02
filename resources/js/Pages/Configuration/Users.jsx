import ActionDialog from '@/Components/ActionDialog';
import FlashMessages from '@/Components/FlashMessages';
import { PasswordField, SelectField, TextField } from '@/Components/FormFields';
import PageHeader from '@/Components/PageHeader';
import { ListEmpty } from '@/Components/RecordList';
import { StaffAvatar } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { Building2Icon, ChevronRightIcon, ContactRoundIcon, CrownIcon, EyeIcon, SlidersHorizontalIcon, UserPlusIcon, UsersRoundIcon } from 'lucide-react';
import { useState } from 'react';
import CampPicker from './Partials/CampPicker';
import { FULL_ACCESS, roleIcon, useAccessName } from './Partials/UserAccess';

/**
 * The add-user dialog: a name, the email and password they sign in with, a
 * role from those the signed-in user may give, and for an area manager or
 * camp boss, their camps.
 */
function AddUserDialog({ roles, properties, open, onOpenChange }) {
    const { t, tOr } = useTranslation();
    const givable = roles.filter((role) => role.givable);
    const form = useForm({ name: '', email: '', password: '', role: givable.find((role) => role.value !== 'super_admin')?.value ?? givable[0]?.value ?? null, property_ids: [] });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `user-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });
    const chosen = roles.find((role) => role.value === data.role);

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('permissions.users.add')}
            description={t('permissions.users.addDescription')}
            submitLabel={t('permissions.users.add')}
            onSubmit={() => {
                form.transform((values) => ({ ...values, property_ids: chosen?.camps ? values.property_ids : [] }));
                form.post(route('configuration.users.store'), { preserveScroll: true });
            }}
            processing={processing}
            className={chosen?.camps ? 'sm:max-w-lg' : undefined}
        >
            <FieldGroup className="gap-4">
                <TextField {...bind('name')} label={t('permissions.users.fields.name')} autoComplete="off" dir="auto" />
                <TextField {...bind('email')} type="email" label={t('permissions.users.fields.email')} autoComplete="off" />
                <PasswordField {...bind('password')} label={t('permissions.users.fields.password')} description={t('permissions.users.fields.passwordHint')} />
                <SelectField
                    {...bind('role')}
                    onChange={(value) => setData((current) => ({ ...current, role: value, property_ids: value === 'camp_boss' ? current.property_ids.slice(0, 1) : current.property_ids }))}
                    label={t('permissions.users.fields.role')}
                    items={givable.map((role) => ({ value: role.value, label: tOr(`permissions.roles.${role.value}.name`, role.name) }))}
                    description={chosen && tOr(`permissions.roles.${chosen.value}.description`, chosen.description)}
                />
                {chosen?.camps && (
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">{t(chosen.campLimit === 1 ? 'permissions.users.chooseCamp' : 'permissions.users.chooseCamps')}</span>
                        <span className="text-xs text-muted-foreground">{t('permissions.users.campsHint')}</span>
                        <CampPicker
                            properties={properties}
                            value={data.property_ids}
                            limit={chosen.campLimit}
                            error={errors.property_ids ?? errors['property_ids.0']}
                            onChange={(ids) => setData('property_ids', ids)}
                        />
                    </div>
                )}
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * One user in the list: who they are, their access and where it comes
 * from, how many permissions they have, and the way to their permissions.
 */
function UserRow({ user, available }) {
    const { t, formatNumber } = useTranslation();
    const accessName = useAccessName();
    const isFull = FULL_ACCESS.includes(user.kind);
    const share = available > 0 ? Math.min(100, (user.permissionCount / available) * 100) : 0;
    const source = isFull ? null : user.custom ? 'custom' : user.kind === 'staff' ? 'fromStaff' : 'fromRole';

    return (
        <li>
            <Link
                href={route('configuration.users.edit', user.id)}
                className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5 lg:px-6"
            >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                    <StaffAvatar name={user.name} />
                    <span className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                            <span dir="auto" className="truncate text-sm font-medium group-hover:text-brand-ink">
                                {user.name}
                            </span>
                            {user.isYou && <Badge variant="info">{t('permissions.users.you')}</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                </span>

                <span className="flex flex-wrap items-center gap-2 sm:w-64 sm:shrink-0">
                    <Badge variant={isFull ? 'warning' : user.kind === 'staff' ? 'secondary' : 'info'}>
                        {(() => {
                            const Icon = isFull ? CrownIcon : user.kind === 'staff' ? ContactRoundIcon : roleIcon(user.role?.slug);

                            return <Icon data-icon="inline-start" />;
                        })()}
                        {accessName(user)}
                    </Badge>
                    {user.camps && (
                        <Badge variant={user.camps.length === 0 ? 'destructive' : 'outline'} title={user.camps.join(', ')}>
                            <Building2Icon data-icon="inline-start" />
                            {user.camps.length === 1 ? user.camps[0] : user.camps.length === 0 ? t('permissions.users.noCamps') : t('permissions.users.camps', { count: user.camps.length })}
                        </Badge>
                    )}
                    {source === 'custom' && (
                        <Badge variant="outline">
                            <SlidersHorizontalIcon data-icon="inline-start" />
                            {t('permissions.users.custom')}
                        </Badge>
                    )}
                </span>

                <span className="flex flex-col gap-1.5 sm:w-44 sm:shrink-0">
                    <span className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium tabular-nums">
                            {isFull ? t('permissions.users.everything') : t('permissions.users.count', { count: formatNumber(user.permissionCount), total: formatNumber(available) })}
                        </span>
                        {source && <span className="text-muted-foreground">{t(`permissions.users.${source}`)}</span>}
                    </span>
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                            className={cn('block h-full rounded-full bg-linear-to-r from-brand-cyan to-brand-navy rtl:bg-linear-to-l', isFull && 'from-brand-sun to-gold')}
                            style={{ width: `${isFull ? 100 : share}%` }}
                        />
                    </span>
                </span>

                <span className="flex items-center gap-1 text-[0.8125rem] font-medium text-brand-ink sm:w-28 sm:justify-end">
                    {user.canEdit ? <SlidersHorizontalIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    {t(user.canEdit ? 'permissions.users.open' : 'permissions.users.view')}
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
            </Link>
        </li>
    );
}

/**
 * The company's users: the figures, everyone who can sign in with their
 * access, and adding a user. Each user's permissions open on their own page.
 */
export default function Users({ users, available, roles, properties }) {
    const { t, formatNumber } = useTranslation();
    const [isAdding, setAdding] = useState(false);
    const title = t('permissions.users.title');
    const count = (...kinds) => users.filter((user) => kinds.includes(user.kind)).length;

    const addButton = (
        <Button variant="brand" onClick={() => setAdding(true)}>
            <UserPlusIcon data-icon="inline-start" />
            {t('permissions.users.add')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.configuration') }, { label: title }]} title={title} count={users.length} description={t('permissions.users.description')} actions={addButton} />

            <FlashMessages />

            <section aria-label={t('permissions.users.stats.users')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard icon={UsersRoundIcon} label={t('permissions.users.stats.users')} value={formatNumber(users.length)} detail={t('permissions.users.stats.usersDetail')} />
                <StatCard
                    icon={CrownIcon}
                    tone="gold"
                    label={t('permissions.users.stats.admins')}
                    value={formatNumber(count('super_admin', 'platform_admin'))}
                    detail={t('permissions.users.stats.adminsDetail')}
                />
                <StatCard
                    icon={SlidersHorizontalIcon}
                    tone="violet"
                    label={t('permissions.users.stats.custom')}
                    value={formatNumber(users.filter((user) => user.custom).length)}
                    detail={t('permissions.users.stats.customDetail')}
                />
                <StatCard icon={ContactRoundIcon} tone="success" label={t('permissions.users.stats.staff')} value={formatNumber(users.filter((user) => user.staffAccess !== null).length)} detail={t('permissions.users.stats.staffDetail')} />
            </section>

            <Card className="gap-0 overflow-hidden py-0">
                {users.length === 0 ? (
                    <ListEmpty icon={UsersRoundIcon} title={t('permissions.users.empty.title')} description={t('permissions.users.empty.description')} action={addButton} />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {users.map((user) => (
                            <UserRow key={user.id} user={user} available={available} />
                        ))}
                    </ul>
                )}
            </Card>

            {isAdding && <AddUserDialog roles={roles} properties={properties} open onOpenChange={setAdding} />}
        </DashboardLayout>
    );
}
