import ActionDialog from '@/Components/ActionDialog';
import FlashMessages from '@/Components/FlashMessages';
import { TextField } from '@/Components/FormFields';
import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { CircleCheckIcon, CirclePauseIcon, ContactRoundIcon, LockIcon, MapPinIcon, MapPinnedIcon, MoreHorizontalIcon, PencilIcon, PhoneIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

const officeValues = (office) => ({
    name: office?.name ?? '',
    code: office?.code ?? '',
    city: office?.city ?? '',
    address: office?.address ?? '',
    phone: office?.phone ?? '',
    is_active: office?.is_active ?? true,
});

/**
 * The add/edit dialog for one office.
 */
function OfficeDialog({ office, open, onOpenChange }) {
    const { t } = useTranslation();
    const isEditing = Boolean(office);
    const form = useForm(officeValues(office));
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `office-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: () => onOpenChange(false) };

        if (isEditing) {
            form.put(route('configuration.regional-offices.update', office.id), options);
        } else {
            form.post(route('configuration.regional-offices.store'), options);
        }
    };

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={isEditing ? t('staff.offices.editTitle', { name: office.name }) : t('staff.offices.add')}
            description={t('staff.offices.dialogDescription')}
            submitLabel={isEditing ? t('staff.offices.save') : t('staff.offices.add')}
            onSubmit={submit}
            processing={processing}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <TextField {...bind('name')} label={t('staff.offices.fields.name')} placeholder={t('staff.offices.fields.namePlaceholder')} dir="auto" />
                <TextField {...bind('code')} label={t('staff.offices.fields.code')} placeholder={t('staff.offices.fields.codePlaceholder')} optional inputClassName="uppercase" />
                <TextField {...bind('city')} label={t('staff.offices.fields.city')} optional dir="auto" />
                <TextField {...bind('phone')} type="tel" label={t('staff.offices.fields.phone')} optional />
                <TextField {...bind('address')} label={t('staff.offices.fields.address')} optional dir="auto" className="sm:col-span-2" />
                <Field orientation="horizontal" className="sm:col-span-2">
                    <Checkbox id="office-active" checked={data.is_active} onCheckedChange={(checked) => setData('is_active', Boolean(checked))} />
                    <FieldLabel htmlFor="office-active" className="font-normal">
                        {t('staff.offices.fields.active')}
                    </FieldLabel>
                </Field>
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * One office in the list: its name and code, where it is, how many staff
 * work there, whether it is offered, and its actions.
 */
function OfficeRow({ office, onEdit, onDelete }) {
    const { t } = useTranslation();

    return (
        <li className={cn('flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5 lg:px-6', !office.is_active && 'bg-muted/30')}>
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    office.is_active ? 'bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm' : 'bg-muted text-muted-foreground',
                )}
            >
                <MapPinnedIcon className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                    <span dir="auto" className="text-sm font-semibold">
                        {office.name}
                    </span>
                    {office.code && <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">{office.code}</code>}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem] text-muted-foreground">
                    {(office.city || office.address) && (
                        <span className="flex items-center gap-1" dir="auto">
                            <MapPinIcon className="size-3.5" />
                            {[office.address, office.city].filter(Boolean).join(', ')}
                        </span>
                    )}
                    {office.phone && (
                        <span className="flex items-center gap-1 tabular-nums">
                            <PhoneIcon className="size-3.5" />
                            {office.phone}
                        </span>
                    )}
                </span>
            </div>
            <Link
                href={route('staff.index', { workplace: [`office:${office.id}`] })}
                className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-ink tabular-nums underline-offset-4 hover:underline"
            >
                <ContactRoundIcon className="size-4" />
                {t('staff.offices.staff', { count: office.staffCount })}
            </Link>
            {office.is_active ? (
                <Badge variant="success">
                    <CircleCheckIcon data-icon="inline-start" />
                    {t('staff.offices.active')}
                </Badge>
            ) : (
                <Badge variant="secondary">
                    <CirclePauseIcon data-icon="inline-start" />
                    {t('staff.offices.off')}
                </Badge>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('staff.offices.actions', { name: office.name })} />}>
                    <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => onEdit(office)}>
                            <PencilIcon />
                            {t('staff.offices.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                router.put(route('configuration.regional-offices.update', office.id), { ...officeValues(office), is_active: !office.is_active }, { preserveScroll: true })
                            }
                        >
                            {office.is_active ? <CirclePauseIcon /> : <CircleCheckIcon />}
                            {t(office.is_active ? 'staff.offices.switchOff' : 'staff.offices.switchOn')}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" disabled={office.inUse} onClick={() => onDelete(office)}>
                        {office.inUse ? <LockIcon /> : <Trash2Icon />}
                        {t(office.inUse ? 'staff.offices.inUse' : 'staff.offices.delete')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

/**
 * The company's regional offices: the figures, the list, and adding,
 * editing, switching off and deleting them. Each company keeps its own, so
 * any member of the company can manage them.
 */
export default function RegionalOffices({ company, offices }) {
    const { t, formatNumber } = useTranslation();
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const title = t('staff.offices.title');

    const addButton = (
        <Button variant="brand" onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('staff.offices.add')}
        </Button>
    );

    const confirmDelete = () =>
        router.delete(route('configuration.regional-offices.destroy', deleting.id), {
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
                count={company ? offices.length : undefined}
                description={t('staff.offices.description')}
                actions={company && addButton}
            />

            <FlashMessages errorKeys={['office']} />

            {company === null ? (
                <NoCompany icon={MapPinnedIcon} />
            ) : (
                <>
                    <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                        <StatCard icon={MapPinnedIcon} label={t('staff.offices.stats.total')} value={formatNumber(offices.length)} detail={t('staff.offices.stats.totalDetail')} />
                        <StatCard
                            icon={CircleCheckIcon}
                            tone="success"
                            label={t('staff.offices.stats.active')}
                            value={formatNumber(offices.filter((office) => office.is_active).length)}
                            detail={t('staff.offices.stats.activeDetail')}
                        />
                        <StatCard
                            icon={ContactRoundIcon}
                            tone="gold"
                            label={t('staff.offices.stats.staff')}
                            value={formatNumber(offices.reduce((total, office) => total + office.staffCount, 0))}
                            detail={t('staff.offices.stats.staffDetail')}
                            href={route('staff.index', { level: ['regional'] })}
                        />
                    </section>

                    <Card className="gap-0 overflow-hidden py-0">
                        {offices.length === 0 ? (
                            <Empty className="py-14">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <MapPinnedIcon />
                                    </EmptyMedia>
                                    <EmptyTitle>{t('staff.offices.empty.title')}</EmptyTitle>
                                    <EmptyDescription>{t('staff.offices.empty.description')}</EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>{addButton}</EmptyContent>
                            </Empty>
                        ) : (
                            <ul className="flex flex-col divide-y">
                                {offices.map((office) => (
                                    <OfficeRow key={office.id} office={office} onEdit={setEditing} onDelete={setDeleting} />
                                ))}
                            </ul>
                        )}
                    </Card>
                </>
            )}

            {editing && (
                <OfficeDialog key={editing === 'new' ? 'new' : editing.id} office={editing === 'new' ? null : editing} open onOpenChange={(open) => !open && setEditing(null)} />
            )}

            {deleting && (
                <ActionDialog
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={t('staff.offices.deleteTitle', { name: deleting.name })}
                    description={t('staff.offices.deleteDescription')}
                    submitLabel={t('staff.offices.delete')}
                    onSubmit={confirmDelete}
                    processing={deleteProcessing}
                    destructive
                />
            )}
        </DashboardLayout>
    );
}
