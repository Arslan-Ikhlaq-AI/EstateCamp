import ActionDialog from '@/Components/ActionDialog';
import FlashMessages from '@/Components/FlashMessages';
import { TextareaField, TextField } from '@/Components/FormFields';
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
    BedDoubleIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    LockIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    TagsIcon,
    Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';

/**
 * What differs between the property-type and room-type pages: icon, routes,
 * the list each type's usage links to and the translation group for names.
 */
const KINDS = {
    property: {
        icon: TagsIcon,
        route: 'configuration.property-types',
        usageRoute: 'properties.index',
        names: 'propertyTypes',
    },
    room: {
        icon: BedDoubleIcon,
        route: 'configuration.room-types',
        usageRoute: 'rooms.index',
        names: 'roomTypes',
    },
};

const blankType = (order) => ({ name: '', description: '', sort_order: order, is_active: true });

/**
 * The add/edit dialog for one type.
 */
function TypeDialog({ kind, type, nextOrder, open, onOpenChange }) {
    const { t } = useTranslation();
    const config = KINDS[kind];
    const isEditing = Boolean(type);
    const form = useForm(isEditing ? { name: type.name, description: type.description ?? '', sort_order: type.sort_order, is_active: type.is_active } : blankType(nextOrder));
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
            <Link
                href={route(config.usageRoute, { types: [type.slug] })}
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
                                    router.put(
                                        route(`${config.route}.update`, type.id),
                                        { name: type.name, description: type.description, sort_order: type.sort_order, is_active: !type.is_active },
                                        { preserveScroll: true },
                                    )
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
 * A configuration page for property or room types: the figures, the list in
 * its order, and (for admins) adding, editing, switching off and deleting.
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
