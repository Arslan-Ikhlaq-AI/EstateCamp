import ActionDialog from '@/Components/ActionDialog';
import FlashMessages from '@/Components/FlashMessages';
import { ChoiceField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { CHEQUE_STAGE_ICONS, ChequeNamedStatusBadge } from '@/Components/LeasingBadges';
import { MaintenanceStatusBadge } from '@/Components/MaintenanceBadges';
import { LEVEL_ICONS } from '@/Components/StaffBadges';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BadgeCheckIcon,
    BedDoubleIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    ClipboardCheckIcon,
    ListChecksIcon,
    LockIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    ShapesIcon,
    TagsIcon,
    Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

/**
 * What differs between the configuration lists: icon, routes, the list each
 * entry's usage links to (and the filter it sets there), the translation
 * group for names, and any extra settings with their defaults.
 */
const KINDS = {
    property: {
        icon: TagsIcon,
        route: 'configuration.property-types',
        usageRoute: 'properties.index',
        usageFilter: 'types',
        names: 'propertyTypes',
    },
    room: {
        icon: BedDoubleIcon,
        route: 'configuration.room-types',
        usageRoute: 'rooms.index',
        usageFilter: 'types',
        names: 'roomTypes',
    },
    maintenanceStatus: {
        icon: ListChecksIcon,
        route: 'configuration.maintenance-statuses',
        usageRoute: 'maintenance.index',
        usageFilter: 'status',
        names: 'maintenance.statusNames',
        extras: { stage: 'open', color: 'cyan' },
    },
    maintenanceCategory: {
        icon: ShapesIcon,
        route: 'configuration.maintenance-categories',
        usageRoute: 'maintenance.index',
        usageFilter: 'category',
        names: 'maintenance.categoryNames',
    },
    chequeStatus: {
        icon: ClipboardCheckIcon,
        route: 'configuration.cheque-statuses',
        usageRoute: 'cheques.index',
        usageFilter: 'status',
        names: 'leasing.cheques.statusNames',
        extras: { stage: 'pending', color: 'cyan' },
    },
    staffRole: {
        icon: BadgeCheckIcon,
        route: 'configuration.staff-roles',
        usageRoute: 'staff.index',
        usageFilter: 'roles',
        names: 'staff.roleNames',
        extras: { level: 'site', staff_access: 'self', app_access: false },
    },
};

const STAGES = ['open', 'in_progress', 'completed', 'cancelled'];

// What a cheque status can mean, in the order a cheque meets them.
const CHEQUE_STAGES = ['pending', 'received', 'issued', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled'];

const LEVELS = ['head_office', 'regional', 'site'];

const ACCESS_LEVELS = ['self', 'supervisor', 'admin'];

// A dot of each colour a maintenance or cheque status can take, for the colour choice.
const SWATCH_CLASSES = { cyan: 'bg-brand-cyan', navy: 'bg-primary', amber: 'bg-warning', green: 'bg-success', red: 'bg-destructive', grey: 'bg-muted-foreground/50' };
const SWATCHES = Object.fromEntries(
    Object.entries(SWATCH_CLASSES).map(([color, className]) => [color, () => <span aria-hidden="true" data-icon="inline-start" className={cn('size-3 rounded-full', className)} />]),
);

const blankType = (kind, order) => ({ name: '', description: '', sort_order: order, is_active: true, ...KINDS[kind].extras });

// What a type's form sends: the shared fields plus its kind's extra settings.
const typeValues = (kind, type) => ({
    name: type.name,
    description: type.description ?? '',
    sort_order: type.sort_order,
    is_active: type.is_active,
    ...Object.fromEntries(Object.keys(KINDS[kind].extras ?? {}).map((field) => [field, type[field]])),
});

/**
 * The add/edit dialog for one type.
 */
function TypeDialog({ kind, type, nextOrder, open, onOpenChange }) {
    const { t } = useTranslation();
    const config = KINDS[kind];
    const isEditing = Boolean(type);
    const form = useForm(isEditing ? typeValues(kind, type) : blankType(kind, nextOrder));
    const { data, setData, errors, processing } = form;

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: () => onOpenChange(false) };

        if (isEditing) {
            form.put(route(`${config.route}.update`, type.id), options);
        } else {
            form.post(route(`${config.route}.store`), options);
        }
    };

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t(isEditing ? `configuration.types.${kind}.editTitle` : `configuration.types.${kind}.addTitle`)}
            description={t('configuration.types.dialogDescription')}
            submitLabel={t(isEditing ? 'configuration.types.save' : 'configuration.types.add')}
            onSubmit={submit}
            processing={processing}
        >
            <FieldGroup className="gap-4">
                <TextField id="type-name" label={t('configuration.types.fields.name')} value={data.name} onChange={(value) => setData('name', value)} error={errors.name} />
                <TextareaField
                    id="type-description"
                    label={t('configuration.types.fields.description')}
                    value={data.description}
                    onChange={(value) => setData('description', value)}
                    error={errors.description}
                    rows={2}
                    optional
                />
                {kind === 'maintenanceStatus' && (
                    <>
                        <SelectField
                            id="type-stage"
                            label={t('configuration.types.fields.stage')}
                            value={data.stage}
                            onChange={(value) => setData('stage', value)}
                            items={STAGES.map((stage) => ({ value: stage, label: t(`configuration.types.stages.${stage}`) }))}
                            description={t('configuration.types.fields.stageHint')}
                            error={errors.stage}
                        />
                        <ChoiceField
                            id="type-color"
                            label={t('configuration.types.fields.color')}
                            value={data.color}
                            onChange={(value) => setData('color', value)}
                            options={Object.keys(SWATCHES).map((color) => ({ value: color, label: t(`configuration.types.colors.${color}`), icon: SWATCHES[color] }))}
                            error={errors.color}
                        />
                    </>
                )}
                {kind === 'chequeStatus' && (
                    <>
                        <SelectField
                            id="type-stage"
                            label={t('configuration.types.fields.stage')}
                            value={data.stage}
                            onChange={(value) => setData('stage', value)}
                            items={CHEQUE_STAGES.map((stage) => ({ value: stage, label: t(`configuration.types.chequeStages.${stage}`) }))}
                            description={t('configuration.types.fields.chequeStageHint')}
                            error={errors.stage}
                        />
                        <ChoiceField
                            id="type-color"
                            label={t('configuration.types.fields.color')}
                            value={data.color}
                            onChange={(value) => setData('color', value)}
                            options={Object.keys(SWATCHES).map((color) => ({ value: color, label: t(`configuration.types.colors.${color}`), icon: SWATCHES[color] }))}
                            error={errors.color}
                        />
                    </>
                )}
                {kind === 'staffRole' && (
                    <ChoiceField
                        id="type-level"
                        label={t('configuration.types.fields.level')}
                        value={data.level}
                        onChange={(value) => setData('level', value)}
                        options={LEVELS.map((level) => ({ value: level, label: t(`staff.levels.${level}`), icon: LEVEL_ICONS[level] }))}
                        description={t('configuration.types.fields.levelHint')}
                        error={errors.level}
                    />
                )}
                {kind === 'staffRole' && (
                    <>
                        <SelectField
                            id="type-staff-access"
                            label={t('configuration.types.fields.staffAccess')}
                            value={data.staff_access}
                            onChange={(value) => setData('staff_access', value)}
                            items={ACCESS_LEVELS.map((level) => ({ value: level, label: t(`staff.access.levels.${level}`) }))}
                            description={`${t(`staff.access.descriptions.${data.staff_access}`)} ${t('configuration.types.fields.staffAccessHint')}`}
                            error={errors.staff_access}
                        />
                        <Field orientation="horizontal">
                            <Checkbox id="type-app-access" checked={data.app_access} onCheckedChange={(checked) => setData('app_access', Boolean(checked))} />
                            <FieldLabel htmlFor="type-app-access" className="font-normal">
                                {t('staff.access.app')}
                            </FieldLabel>
                        </Field>
                    </>
                )}
                <div className="grid grid-cols-[8rem_1fr] items-end gap-4">
                    <TextField
                        id="type-order"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={999}
                        label={t('configuration.types.fields.order')}
                        value={data.sort_order}
                        onChange={(value) => setData('sort_order', value)}
                        error={errors.sort_order}
                    />
                    <Field orientation="horizontal" className="h-9 items-center">
                        <Checkbox id="type-active" checked={data.is_active} onCheckedChange={(checked) => setData('is_active', Boolean(checked))} />
                        <FieldLabel htmlFor="type-active" className="font-normal">
                            {t('configuration.types.fields.active')}
                        </FieldLabel>
                    </Field>
                </div>
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * One type in the list: its order, name, description and slug, how many of
 * the company's records use it, whether it is offered, and its actions.
 */
function TypeRow({ kind, type, canManage, onEdit, onDelete }) {
    const { t, tOr, formatNumber } = useTranslation();
    const config = KINDS[kind];
    const translated = tOr(`${config.names}.${type.slug}`, type.name);
    const LevelIcon = kind === 'staffRole' ? LEVEL_ICONS[type.level] : null;
    const ChequeStageIcon = kind === 'chequeStatus' ? CHEQUE_STAGE_ICONS[type.stage] : null;

    return (
        <li className={cn('flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5 lg:px-6', !type.is_active && 'bg-muted/30')}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground tabular-nums">
                {formatNumber(type.sort_order)}
            </span>
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    type.is_active ? 'bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm' : 'bg-muted text-muted-foreground',
                )}
            >
                <config.icon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{type.name}</span>
                    {translated !== type.name && <span className="text-xs text-muted-foreground" dir="auto">{translated}</span>}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">{type.slug}</code>
                </span>
                {type.description && <span className="text-[0.8125rem] text-muted-foreground">{type.description}</span>}
            </div>
            {kind === 'maintenanceStatus' && (
                <span className="flex flex-col items-start gap-1">
                    <MaintenanceStatusBadge status={type} />
                    <span className="text-xs text-muted-foreground">{t(`configuration.types.stages.${type.stage}`)}</span>
                </span>
            )}
            {ChequeStageIcon && (
                <span className="flex flex-col items-start gap-1">
                    <ChequeNamedStatusBadge status={type} />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ChequeStageIcon aria-hidden="true" className="size-3.5" />
                        {t(`configuration.types.chequeStages.${type.stage}`)}
                    </span>
                </span>
            )}
            {LevelIcon && (
                <span className="flex flex-col items-start gap-1">
                    <Badge variant="secondary">
                        <LevelIcon data-icon="inline-start" />
                        {t(`staff.levels.${type.level}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {t(`staff.access.levels.${type.staff_access}`)}
                        {type.app_access && ` · ${t('staff.access.appShort')}`}
                    </span>
                </span>
            )}
            <Link
                href={route(config.usageRoute, { [config.usageFilter]: [type.slug] })}
                className="text-[0.8125rem] font-medium text-brand-ink tabular-nums underline-offset-4 hover:underline"
            >
                {t(`configuration.types.${kind}.usage`, { count: type.usage })}
            </Link>
            {type.is_active ? (
                <Badge variant="success">
                    <CircleCheckIcon data-icon="inline-start" />
                    {t('configuration.types.active')}
                </Badge>
            ) : (
                <Badge variant="secondary">
                    <CirclePauseIcon data-icon="inline-start" />
                    {t('configuration.types.off')}
                </Badge>
            )}
            {canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('configuration.types.actions', { name: type.name })} />}>
                        <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => onEdit(type)}>
                                <PencilIcon />
                                {t('configuration.types.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    router.put(route(`${config.route}.update`, type.id), { ...typeValues(kind, type), is_active: !type.is_active }, { preserveScroll: true })
                                }
                            >
                                {type.is_active ? <CirclePauseIcon /> : <CircleCheckIcon />}
                                {t(type.is_active ? 'configuration.types.switchOff' : 'configuration.types.switchOn')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" disabled={type.inUse} onClick={() => onDelete(type)}>
                            {type.inUse ? <LockIcon /> : <Trash2Icon />}
                            {t(type.inUse ? 'configuration.types.inUse' : 'configuration.types.delete')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </li>
    );
}

/**
 * A configuration page for property or room types, maintenance statuses or
 * categories, cheque statuses, or staff roles: the figures, the list in its
 * order, and (for admins) adding, editing, switching off and deleting.
 */
export default function Types({ kind, types, canManage, errors }) {
    const { t, formatNumber } = useTranslation();
    const config = KINDS[kind];
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const title = t(`configuration.types.${kind}.title`);
    const nextOrder = types.reduce((max, type) => Math.max(max, type.sort_order), 0) + 1;

    const confirmDelete = () =>
        router.delete(route(`${config.route}.destroy`, deleting.id), {
            preserveScroll: true,
            onStart: () => setDeleteProcessing(true),
            onFinish: () => {
                setDeleteProcessing(false);
                setDeleting(null);
            },
        });

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.configuration') }, { label: title }]}
                title={title}
                count={types.length}
                description={t(`configuration.types.${kind}.description`)}
                actions={
                    canManage && (
                        <Button variant="brand" onClick={() => setEditing('new')}>
                            <PlusIcon data-icon="inline-start" />
                            {t(`configuration.types.${kind}.addTitle`)}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {errors?.type && (
                <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{errors.type}</AlertDescription>
                </Alert>
            )}

            <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <StatCard icon={config.icon} label={t('configuration.types.stats.total')} value={formatNumber(types.length)} detail={t('configuration.types.stats.totalDetail')} />
                <StatCard
                    icon={CircleCheckIcon}
                    tone="success"
                    label={t('configuration.types.stats.active')}
                    value={formatNumber(types.filter((type) => type.is_active).length)}
                    detail={t('configuration.types.stats.activeDetail')}
                />
                <StatCard
                    icon={LockIcon}
                    tone="gold"
                    label={t('configuration.types.stats.inUse')}
                    value={formatNumber(types.filter((type) => type.inUse).length)}
                    detail={t('configuration.types.stats.inUseDetail')}
                />
            </section>

            {!canManage && (
                <Alert>
                    <LockIcon />
                    <AlertDescription>{t('configuration.types.readOnly')}</AlertDescription>
                </Alert>
            )}

            <Card className="gap-0 overflow-hidden py-0">
                {types.length === 0 ? (
                    <Empty className="py-14">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <config.icon />
                            </EmptyMedia>
                            <EmptyTitle>{t(`configuration.types.${kind}.empty`)}</EmptyTitle>
                            <EmptyDescription>{t('configuration.types.emptyDescription')}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ul className="flex flex-col divide-y">
                        {types.map((type) => (
                            <TypeRow key={type.id} kind={kind} type={type} canManage={canManage} onEdit={setEditing} onDelete={setDeleting} />
                        ))}
                    </ul>
                )}
            </Card>

            {editing && (
                <TypeDialog
                    key={editing === 'new' ? 'new' : editing.id}
                    kind={kind}
                    type={editing === 'new' ? null : editing}
                    nextOrder={nextOrder}
                    open
                    onOpenChange={(open) => !open && setEditing(null)}
                />
            )}

            {deleting && (
                <ActionDialog
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={t('configuration.types.deleteTitle', { name: deleting.name })}
                    description={t('configuration.types.deleteDescription')}
                    submitLabel={t('configuration.types.delete')}
                    onSubmit={confirmDelete}
                    processing={deleteProcessing}
                    destructive
                />
            )}
        </DashboardLayout>
    );
}
