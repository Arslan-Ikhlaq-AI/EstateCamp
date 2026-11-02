import FlashMessages from '@/Components/FlashMessages';
import { PasswordField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import { StaffAvatar } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useCan } from '@/hooks/use-can';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { Building2Icon, ContactRoundIcon, CrownIcon, ExternalLinkIcon, InfoIcon, LockIcon, PowerOffIcon, RotateCcwIcon, SlidersHorizontalIcon, UserRoundXIcon } from 'lucide-react';
import { useMemo } from 'react';
import CampPicker from './Partials/CampPicker';
import { FULL_ACCESS, roleIcon, useAccessName } from './Partials/UserAccess';

/**
 * The roles on offer as cards, each with what it is for and how many
 * permissions it brings, and for a staff sign-in, no role at all. A role
 * the signed-in user may not give stays shut, unless it is the one the user
 * already has.
 */
function RolePicker({ roles, value, current, allowNone, disabled, error, onChange }) {
    const { t, tOr, formatNumber } = useTranslation();
    const options = allowNone
        ? [{ value: null, name: t('permissions.user.noRole'), description: t('permissions.user.noRoleDescription'), givable: true, permissions: null }, ...roles]
        : roles;

    return (
        <div role="radiogroup" aria-label={t('permissions.user.roleSection')} className="flex flex-col gap-2">
            {options.map((role) => {
                const isChosen = role.value === value;
                const isShut = disabled || (!role.givable && role.value !== current);
                const Icon = role.value === null ? UserRoundXIcon : roleIcon(role.value);

                return (
                    <button
                        key={role.value ?? 'none'}
                        type="button"
                        role="radio"
                        aria-checked={isChosen}
                        disabled={isShut}
                        title={isShut && !disabled ? t('permissions.users.cannotGive') : undefined}
                        onClick={() => onChange(role.value)}
                        className={cn(
                            'flex items-start gap-3 rounded-xl p-3 text-start ring-1 ring-foreground/10 transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted/50 disabled:cursor-not-allowed',
                            isChosen && 'bg-brand-cyan/[0.07] ring-2 ring-brand-cyan/60 enabled:hover:bg-brand-cyan/10',
                            isShut && !isChosen && 'opacity-55',
                        )}
                    >
                        <span
                            className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm',
                                role.value === 'super_admin' ? 'from-brand-sun to-gold text-brand-navy' : role.value === null ? 'from-muted-foreground/60 to-muted-foreground' : 'from-brand-cyan to-brand-navy',
                            )}
                        >
                            <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                                {role.value === null ? role.name : tOr(`permissions.roles.${role.value}.name`, role.name)}
                                {isShut && !isChosen ? (
                                    <LockIcon className="size-3.5 text-muted-foreground" />
                                ) : (
                                    role.permissions && <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatNumber(role.permissions.length)}</span>
                                )}
                            </span>
                            <span className="text-xs text-pretty text-muted-foreground">
                                {role.value === null ? role.description : tOr(`permissions.roles.${role.value}.description`, role.description)}
                            </span>
                        </span>
                    </button>
                );
            })}
            <FieldError>{error}</FieldError>
        </div>
    );
}

/**
 * A staff member's sign-in: its access level and whether it reaches the
 * rest of the app, both kept on their staff record.
 */
function StaffAccess({ staff }) {
    const { t } = useTranslation();
    const can = useCan();

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/[0.06]">
                <span className="text-xs text-muted-foreground">{t('permissions.user.staffLevel')}</span>
                <span className="text-sm font-semibold">{t(`staff.access.levels.${staff.access}`)}</span>
                <span className="text-xs text-pretty text-muted-foreground">{t(`staff.access.descriptions.${staff.access}`)}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/[0.06]">
                <span className="text-xs text-muted-foreground">{t('permissions.user.staffApp')}</span>
                <span className="text-sm font-semibold">{t(staff.appAccess ? 'permissions.user.staffAppYes' : 'permissions.user.staffAppNo')}</span>
            </div>
            <p className="text-xs text-pretty text-muted-foreground">{t('permissions.user.staffReset')}</p>
            {can('staff.view') && !staff.isRemoved && (
                <Button variant="outline" size="sm" className="self-start" render={<Link href={route('staff.show', staff.id)} />} nativeButton={false}>
                    <ExternalLinkIcon data-icon="inline-start" />
                    {t('permissions.user.editStaff')}
                </Button>
            )}
        </div>
    );
}

/**
 * The email the user signs in with, and a new password for them, saved
 * with the rest of the page.
 */
function SignInCard({ email, value, error, onChange }) {
    const { t } = useTranslation();

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('permissions.user.signIn.title')}</CardTitle>
                <CardDescription>{t('permissions.user.signIn.description', { email })}</CardDescription>
            </CardHeader>
            <CardContent>
                <PasswordField id="user-password" label={t('permissions.user.signIn.password')} value={value} onChange={onChange} error={error} description={t('permissions.user.signIn.hint')} />
            </CardContent>
        </Card>
    );
}

/**
 * One top menu's pages, each with its actions to tick. A page the company
 * has switched off, a page about the whole company for someone limited to
 * some camps, and a permission the signed-in user lacks, cannot be ticked.
 */
function ModuleCard({ module, shown, isEditable, mayChange, onToggle, onModule }) {
    const { t, tOr, formatNumber } = useTranslation();
    const keys = module.pages.filter((page) => page.enabled).flatMap((page) => page.actions.map((action) => `${page.key}.${action}`));
    const on = keys.filter((key) => shown.has(key)).length;

    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t(`permissions.modules.${module.key}`)}</CardTitle>
                <CardDescription className="tabular-nums">{t('permissions.user.selected', { count: formatNumber(on), total: formatNumber(keys.length) })}</CardDescription>
                {isEditable && keys.length > 0 && (
                    <CardAction className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => onModule(module, true)}>
                            {t('permissions.user.all')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onModule(module, false)}>
                            {t('permissions.user.none')}
                        </Button>
                    </CardAction>
                )}
            </CardHeader>
            <ul className="flex flex-col divide-y">
                {module.pages.map((page) => (
                    <li key={page.key} className={cn('flex flex-col gap-2.5 px-4 py-3 sm:px-5 md:flex-row md:items-center lg:px-6', !page.enabled && 'bg-muted/30')}>
                        <span className="flex min-w-0 items-center gap-2 md:w-56 md:shrink-0">
                            <span className={cn('text-sm font-medium', !page.enabled && 'text-muted-foreground')}>{t(`permissions.pages.${page.key}`)}</span>
                            {page.lockedBy === 'off' && (
                                <Badge variant="secondary" title={t('permissions.user.off')}>
                                    <PowerOffIcon data-icon="inline-start" />
                                    {t('permissions.user.offShort')}
                                </Badge>
                            )}
                            {page.lockedBy === 'companyWide' && (
                                <Badge variant="secondary" title={t('permissions.user.companyWide')}>
                                    <Building2Icon data-icon="inline-start" />
                                </Badge>
                            )}
                        </span>
                        <span className="flex flex-wrap gap-2">
                            {page.actions.map((action) => {
                                const key = `${page.key}.${action}`;
                                const id = `permission-${key}`;
                                const isLocked = isEditable && page.enabled && !mayChange(page, key);

                                return (
                                    <label
                                        key={key}
                                        htmlFor={id}
                                        title={page.lockedBy ? t(`permissions.user.${page.lockedBy === 'off' ? 'off' : 'companyWide'}`) : isLocked ? t('permissions.user.notYours') : undefined}
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] ring-1 ring-foreground/10 transition-colors select-none',
                                            shown.has(key) && page.enabled && 'bg-primary/[0.06] text-foreground ring-primary/30',
                                            mayChange(page, key) ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default text-muted-foreground',
                                        )}
                                    >
                                        <Checkbox id={id} checked={shown.has(key)} disabled={!mayChange(page, key)} onCheckedChange={(checked) => onToggle(page, action, Boolean(checked))} />
                                        {tOr(`permissions.pageActions.${page.key}.${action}`, t(`permissions.actions.${action}`))}
                                        {isLocked && <LockIcon className="size-3 text-muted-foreground" />}
                                    </label>
                                );
                            })}
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

/**
 * One user's access: their role (and for a staff sign-in, their staff
 * access), the camps of an area manager or camp boss, the switch to choose
 * permissions for them, and every permission page by page under each top
 * menu. Ticking an action on a page ticks seeing it too, and unticking
 * seeing it unticks the rest.
 */
export default function UserPermissions({ user, modules, roles, givable, companyWide, properties }) {
    const { t, formatNumber } = useTranslation();
    const accessName = useAccessName();
    const isStaff = user.staff !== null;
    const form = useForm({ role: user.role?.slug ?? null, property_ids: user.propertyIds, custom: user.custom, permissions: user.permissions, password: '' });
    const { data, setData, errors, processing, isDirty } = form;

    const role = roles.find((option) => option.value === data.role);
    const isCampRole = Boolean(role?.camps);

    // Pages the company has switched off, and for a camp role those about the whole company, cannot be given.
    const shownModules = useMemo(
        () =>
            modules.map((module) => ({
                ...module,
                pages: module.pages.map((page) => {
                    const lockedBy = !page.enabled ? 'off' : isCampRole && companyWide.includes(page.key) ? 'companyWide' : null;

                    return { ...page, enabled: lockedBy === null, lockedBy };
                }),
            })),
        [modules, companyWide, isCampRole],
    );

    const givableSet = useMemo(() => new Set(givable), [givable]);
    const allKeys = useMemo(() => modules.flatMap((module) => module.pages.flatMap((page) => page.actions.map((action) => `${page.key}.${action}`))), [modules]);
    const enabledKeys = useMemo(
        () => shownModules.flatMap((module) => module.pages.filter((page) => page.enabled).flatMap((page) => page.actions.map((action) => `${page.key}.${action}`))),
        [shownModules],
    );

    // A super admin made something else here is narrowed from then on.
    const isFull = user.kind === 'platform_admin' || data.role === 'super_admin';
    const defaults = data.role === (user.role?.slug ?? null) ? user.defaults : role ? [...new Set([...role.permissions, ...user.staffPages])] : user.staffDefaults;
    const shown = useMemo(() => new Set(isFull ? allKeys : data.custom ? data.permissions : defaults), [isFull, allKeys, data.custom, data.permissions, defaults]);
    const isEditable = user.canEdit && !isFull && data.custom;
    const mayChange = (page, key) => isEditable && page.enabled && givableSet.has(key);
    const onCount = enabledKeys.filter((key) => shown.has(key)).length;

    const ordered = (keys) => allKeys.filter((key) => keys.has(key));

    const toggle = (page, action, checked) => {
        const next = new Set(data.permissions);
        const key = `${page.key}.${action}`;
        const viewKey = `${page.key}.view`;

        if (checked) {
            next.add(key);

            if (action !== 'view' && page.actions.includes('view') && mayChange(page, viewKey)) {
                next.add(viewKey);
            }
        } else {
            next.delete(key);

            if (action === 'view') {
                page.actions.forEach((other) => mayChange(page, `${page.key}.${other}`) && next.delete(`${page.key}.${other}`));
            }
        }

        setData('permissions', ordered(next));
    };

    const setModule = (module, on) => {
        const next = new Set(data.permissions);

        module.pages.forEach((page) =>
            page.actions.forEach((action) => {
                const key = `${page.key}.${action}`;

                if (mayChange(page, key)) {
                    on ? next.add(key) : next.delete(key);
                }
            }),
        );

        setData('permissions', ordered(next));
    };

    // Choosing starts from what the role gives now.
    const chooseCustom = (checked) => setData((current) => ({ ...current, custom: checked, permissions: checked ? [...defaults] : current.permissions }));

    // A camp boss runs one camp, so choosing the role keeps the first of several.
    const chooseRole = (value) =>
        setData((current) => ({ ...current, role: value, property_ids: value === 'camp_boss' ? current.property_ids.slice(0, 1) : current.property_ids }));

    const submit = (event) => {
        event.preventDefault();
        form.transform((values) => ({ ...values, property_ids: isCampRole ? values.property_ids : [] }));
        // A saved password is not shown again, so the box empties.
        form.put(route('configuration.users.update', user.id), {
            preserveScroll: true,
            onSuccess: () => {
                form.setDefaults({ ...data, password: '' });
                form.setData('password', '');
            },
        });
    };

    const readOnlyReason = user.isYou ? 'readOnlyYou' : FULL_ACCESS.includes(user.kind) ? 'readOnlyFull' : 'readOnly';
    const saveButton = (
        <Button type="submit" variant="brand" disabled={processing || !isDirty}>
            {processing && <Spinner data-icon="inline-start" />}
            {t('permissions.user.save')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={t('permissions.user.title', { name: user.name })} />

            <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-6">
                <PageHeader
                    breadcrumbs={[{ label: t('nav.configuration') }, { label: t('permissions.users.title'), href: route('configuration.users') }, { label: user.name }]}
                    title={t('permissions.user.title', { name: user.name })}
                    description={t('permissions.user.description', { name: user.name })}
                    actions={user.canEdit && saveButton}
                    actionsClassName="max-sm:hidden"
                />

                <FlashMessages errorKeys={['permissions', 'custom']} />

                {!user.canEdit && (
                    <Alert>
                        <InfoIcon />
                        <AlertDescription>{t(`permissions.user.${readOnlyReason}`)}</AlertDescription>
                    </Alert>
                )}

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
                    <aside className="flex flex-col gap-6 xl:sticky xl:top-20 xl:order-last">
                        <Card>
                            <CardContent className="flex flex-col gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <StaffAvatar name={user.name} className="size-11" />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span dir="auto" className="truncate font-semibold">
                                                {user.name}
                                            </span>
                                            {user.isYou && <Badge variant="info">{t('permissions.users.you')}</Badge>}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={FULL_ACCESS.includes(user.kind) ? 'warning' : user.kind === 'staff' ? 'secondary' : 'info'}>
                                        {(() => {
                                            const Icon = FULL_ACCESS.includes(user.kind) ? CrownIcon : user.kind === 'staff' ? ContactRoundIcon : roleIcon(user.role?.slug);

                                            return <Icon data-icon="inline-start" />;
                                        })()}
                                        {accessName(user)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {isFull ? t('permissions.users.everything') : t('permissions.users.count', { count: formatNumber(onCount), total: formatNumber(enabledKeys.length) })}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {user.canEdit && <SignInCard email={user.email} value={data.password} error={errors.password} onChange={(value) => setData('password', value)} />}

                        {isStaff && (
                            <Card>
                                <CardHeader className="border-b">
                                    <CardTitle>{t('permissions.user.staffSection')}</CardTitle>
                                    <CardDescription>{t('permissions.user.staffDescription')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <StaffAccess staff={user.staff} />
                                </CardContent>
                            </Card>
                        )}

                        {user.kind !== 'platform_admin' && (
                            <Card>
                                <CardHeader className="border-b">
                                    <CardTitle>{t('permissions.user.roleSection')}</CardTitle>
                                    <CardDescription>{t('permissions.user.roleDescription')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <RolePicker
                                        roles={roles}
                                        value={data.role}
                                        current={user.role?.slug ?? null}
                                        allowNone={isStaff}
                                        disabled={!user.canEdit}
                                        error={errors.role}
                                        onChange={chooseRole}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {isCampRole && (
                            <Card>
                                <CardHeader className="border-b">
                                    <CardTitle>{t('permissions.user.campsSection')}</CardTitle>
                                    <CardDescription>{t(role.campLimit === 1 ? 'permissions.user.campsOneDescription' : 'permissions.user.campsDescription')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <CampPicker
                                        properties={properties}
                                        value={data.property_ids}
                                        limit={role.campLimit}
                                        disabled={!user.canEdit}
                                        error={errors.property_ids ?? errors['property_ids.0']}
                                        onChange={(ids) => setData('property_ids', ids)}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {user.canEdit && !isFull && (
                            <Card>
                                <CardContent className="flex flex-col gap-3">
                                    <label htmlFor="permissions-custom" className="flex cursor-pointer items-start gap-3">
                                        <Checkbox id="permissions-custom" checked={data.custom} onCheckedChange={(checked) => chooseCustom(Boolean(checked))} className="mt-0.5" />
                                        <span className="flex flex-col gap-0.5">
                                            <span className="text-sm font-semibold">{t('permissions.user.custom')}</span>
                                            <span className="text-xs text-pretty text-muted-foreground">{t('permissions.user.customDescription')}</span>
                                        </span>
                                    </label>
                                    {data.custom && (
                                        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setData('permissions', [...defaults])}>
                                            <RotateCcwIcon data-icon="inline-start" />
                                            {t('permissions.user.reset')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </aside>

                    <section aria-label={t('permissions.user.matrix')} className="flex min-w-0 flex-col gap-4">
                        <div className="flex items-start gap-3 rounded-xl bg-brand-cyan/[0.06] px-4 py-3 text-sm ring-1 ring-brand-cyan/20">
                            <SlidersHorizontalIcon className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                            <span className="text-pretty text-muted-foreground">{t('permissions.user.matrixDescription')}</span>
                        </div>
                        {shownModules.map((module) => (
                            <ModuleCard key={module.key} module={module} shown={shown} isEditable={isEditable} mayChange={mayChange} onToggle={toggle} onModule={setModule} />
                        ))}
                    </section>
                </div>

                {user.canEdit && (
                    <FormActions>
                        <span className="me-auto text-sm text-muted-foreground">{t(isDirty ? 'permissions.user.unsaved' : 'permissions.user.saved')}</span>
                        {saveButton}
                    </FormActions>
                )}
            </form>
        </DashboardLayout>
    );
}
