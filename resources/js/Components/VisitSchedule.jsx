import ActionDialog from '@/Components/ActionDialog';
import { amcNavTitle, VISIT_STATUS_ICONS, VisitStatusBadge } from '@/Components/AmcBadges';
import DataTable from '@/Components/DataTable';
import { SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { InvoiceInput } from '@/Pages/Maintenance/Partials/CostFields';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { CalendarSyncIcon, ExternalLinkIcon, FileTextIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon, WandSparklesIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * How far a visit still to happen is from today ("Today", "In 3 days",
 * "2 days overdue"); null once it is done, missed or cancelled.
 */
export function useVisitTiming() {
    const { t } = useTranslation();

    return (visit) => {
        if (!['scheduled', 'confirmed'].includes(visit.status)) {
            return null;
        }

        if (visit.daysAway < 0) {
            return t('amcs.schedule.timing.overdue', { count: -visit.daysAway });
        }

        if (visit.daysAway === 0) {
            return t('amcs.schedule.timing.today');
        }

        return visit.daysAway === 1 ? t('amcs.schedule.timing.tomorrow') : t('amcs.schedule.timing.inDays', { count: visit.daysAway });
    };
}

/**
 * A small red dot that blinks while a visit needs attention, for the eye
 * to find it in a list. Still for those who ask for less motion.
 */
export function AlertPulse({ className }) {
    return (
        <span aria-hidden="true" className={cn('relative flex size-2.5 shrink-0', className)}>
            <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
        </span>
    );
}

/**
 * The visit's day and time, and how far it is from today.
 */
function VisitWhen({ visit }) {
    const { t, formatDate } = useTranslation();
    const timing = useVisitTiming()(visit);

    return (
        <div className="flex items-start gap-2.5">
            {visit.alert ? <AlertPulse className="mt-1.5" /> : <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0" />}
            <div className="flex flex-col">
                <span className="font-semibold whitespace-nowrap tabular-nums">
                    {formatDate(visit.scheduledOn)}
                    {visit.scheduledTime && <span className="font-normal text-muted-foreground"> · {visit.scheduledTime}</span>}
                </span>
                {timing && <span className={cn('text-xs', visit.alert ? 'font-semibold text-destructive' : 'text-muted-foreground')}>{timing}</span>}
                {visit.rescheduledFrom && <span className="text-xs text-muted-foreground">{t('amcs.schedule.movedFrom', { date: formatDate(visit.rescheduledFrom) })}</span>}
            </div>
        </div>
    );
}

/**
 * What was recorded when the visit was done: the day, who came and the service report.
 */
function VisitRecord({ visit }) {
    const { t, formatDate } = useTranslation();

    if (visit.status !== 'done') {
        return visit.notes ? (
            <span dir="auto" className="line-clamp-2 max-w-56 text-xs text-muted-foreground">
                {visit.notes}
            </span>
        ) : (
            <span className="text-muted-foreground">—</span>
        );
    }

    return (
        <div className="flex max-w-60 flex-col text-sm">
            <span className="tabular-nums">{t('amcs.schedule.doneOn', { date: formatDate(visit.completedOn) })}</span>
            {(visit.technician || visit.reportNumber) && (
                <span dir="auto" className="truncate text-xs text-muted-foreground">
                    {[visit.technician, visit.reportNumber && t('amcs.schedule.report', { number: visit.reportNumber })].filter(Boolean).join(' · ')}
                </span>
            )}
            {visit.report && (
                <a href={visit.report.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink underline-offset-4 hover:underline">
                    <FileTextIcon className="size-3.5" />
                    {t('amcs.schedule.viewReport')}
                </a>
            )}
        </div>
    );
}

function VisitActions({ visit, showContract, onOpen }) {
    const { t, formatDate } = useTranslation();
    const label = t('amcs.schedule.actions.menu', { date: formatDate(visit.scheduledOn) });
    const forward = ['done', 'confirmed', 'missed', 'scheduled'].filter((status) => visit.actions.includes(status));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
                    {forward.map((status) => {
                        const Icon = VISIT_STATUS_ICONS[status];

                        return (
                            <DropdownMenuItem key={status} onClick={() => onOpen('status', status)}>
                                <Icon />
                                {t(`amcs.schedule.actions.${status}`)}
                            </DropdownMenuItem>
                        );
                    })}
                    {visit.canReschedule && (
                        <DropdownMenuItem onClick={() => onOpen('reschedule')}>
                            <CalendarSyncIcon />
                            {t('amcs.schedule.actions.reschedule')}
                        </DropdownMenuItem>
                    )}
                    {visit.report && (
                        <DropdownMenuItem render={<a href={visit.report.url} target="_blank" rel="noreferrer" />}>
                            <FileTextIcon />
                            {t('amcs.schedule.viewReport')}
                        </DropdownMenuItem>
                    )}
                    {showContract && (
                        <DropdownMenuItem render={<Link href={visit.contract.url} />}>
                            <ExternalLinkIcon />
                            {t('amcs.schedule.actions.openContract', { number: visit.contract.number })}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                {(visit.actions.includes('cancelled') || visit.canDelete) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {visit.actions.includes('cancelled') && (
                                <DropdownMenuItem variant="destructive" onClick={() => onOpen('status', 'cancelled')}>
                                    <VISIT_STATUS_ICONS.cancelled />
                                    {t('amcs.schedule.actions.cancelled')}
                                </DropdownMenuItem>
                            )}
                            {visit.canDelete && (
                                <DropdownMenuItem variant="destructive" onClick={() => onOpen('remove')}>
                                    <Trash2Icon />
                                    {t('amcs.schedule.actions.remove')}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Move a visit to another status: confirmed, done (with the day, who came
 * and the service report), missed, cancelled or back on the schedule.
 */
export function VisitStatusDialog({ visit, status, open, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const today = todayIso();
    const form = useForm({
        status: status ?? visit.actions[0],
        completed_on: visit.scheduledOn < today ? visit.scheduledOn : today,
        technician_name: visit.technician ?? '',
        report_number: visit.reportNumber ?? '',
        report: null,
        notes: visit.notes ?? '',
    });
    const { data, setData, errors, processing } = form;
    const isDone = data.status === 'done';

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('amcs.visitDialog.statusTitle', { date: formatDate(visit.scheduledOn) })}
            description={visit.contract ? `${visit.contract.property?.name ?? visit.contract.number} · ${visit.contract.vendor}` : undefined}
            submitLabel={t('amcs.visitDialog.save')}
            destructive={data.status === 'cancelled'}
            processing={processing}
            onSubmit={() => form.post(route('amc-visits.status', visit.id), { preserveScroll: true, forceFormData: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4">
                <SelectField
                    id="visit-status"
                    label={t('amcs.visitDialog.status')}
                    value={data.status}
                    onChange={(value) => setData('status', value)}
                    items={visit.actions.map((action) => ({ value: action, label: t(`amcs.visitStatuses.${action}`) }))}
                    error={errors.status}
                    description={t(`amcs.visitDialog.effects.${data.status}`)}
                />
                {isDone && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField
                                id="visit-completed-on"
                                type="date"
                                max={today}
                                label={t('amcs.visitDialog.completedOn')}
                                value={data.completed_on}
                                onChange={(value) => setData('completed_on', value)}
                                error={errors.completed_on}
                            />
                            <TextField
                                id="visit-report-number"
                                label={t('amcs.visitDialog.reportNumber')}
                                value={data.report_number}
                                onChange={(value) => setData('report_number', value)}
                                error={errors.report_number}
                                optional
                            />
                        </div>
                        <TextField
                            id="visit-technician"
                            label={t('amcs.visitDialog.technician')}
                            value={data.technician_name}
                            onChange={(value) => setData('technician_name', value)}
                            error={errors.technician_name}
                            dir="auto"
                            optional
                        />
                        <InvoiceInput
                            id="visit-report"
                            label={t('amcs.visitDialog.report')}
                            addText={t('amcs.visitDialog.addReport')}
                            viewText={t('amcs.schedule.viewReport')}
                            file={data.report}
                            url={visit.report?.url}
                            name={visit.report?.name}
                            onFile={(file) => setData('report', file)}
                            onRemove={() => setData('report', null)}
                            error={errors.report}
                        />
                    </>
                )}
                <TextareaField
                    id="visit-notes"
                    label={t('amcs.visitDialog.notes')}
                    value={data.notes}
                    onChange={(value) => setData('notes', value)}
                    error={errors.notes}
                    optional
                    rows={2}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * Move a visit to another day and time, such as when the contractor asks to come later.
 */
function VisitRescheduleDialog({ visit, open, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const form = useForm({ scheduled_on: visit.scheduledOn, scheduled_time: visit.scheduledTime ?? '', notes: visit.notes ?? '' });
    const { data, setData, errors, processing } = form;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('amcs.visitDialog.rescheduleTitle', { date: formatDate(visit.scheduledOn) })}
            submitLabel={t('amcs.visitDialog.reschedule')}
            processing={processing}
            onSubmit={() => form.put(route('amc-visits.reschedule', visit.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        id="visit-new-date"
                        type="date"
                        label={t('amcs.visitDialog.newDate')}
                        value={data.scheduled_on}
                        onChange={(value) => setData('scheduled_on', value)}
                        error={errors.scheduled_on}
                    />
                    <TextField
                        id="visit-new-time"
                        type="time"
                        label={t('amcs.visitDialog.time')}
                        value={data.scheduled_time}
                        onChange={(value) => setData('scheduled_time', value)}
                        error={errors.scheduled_time}
                        optional
                    />
                </div>
                <TextareaField
                    id="visit-reschedule-notes"
                    label={t('amcs.visitDialog.notes')}
                    value={data.notes}
                    onChange={(value) => setData('notes', value)}
                    error={errors.notes}
                    optional
                    rows={2}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

function VisitRemoveDialog({ visit, open, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const [processing, setProcessing] = useState(false);

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('amcs.visitDialog.removeTitle', { date: formatDate(visit.scheduledOn) })}
            description={t('amcs.visitDialog.removeDescription')}
            submitLabel={t('amcs.visitDialog.remove')}
            destructive
            processing={processing}
            onSubmit={() =>
                router.delete(route('amc-visits.destroy', visit.id), {
                    preserveScroll: true,
                    onStart: () => setProcessing(true),
                    onFinish: () => setProcessing(false),
                    onSuccess: () => onOpenChange(false),
                })
            }
        />
    );
}

const emptyRow = () => ({ scheduled_on: '', scheduled_time: '' });

/**
 * Add the contractor's visit dates to a contract's schedule, typed in one
 * by one or filled at the agreed frequency (the dates still to come that
 * are not on the schedule yet) and then adjusted.
 */
export function AddVisitsDialog({ contract, scheduled, open, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const form = useForm({ visits: [emptyRow()], notes: '' });
    const { data, setData, errors, processing } = form;
    const today = todayIso();
    const suggested = contract.suggestedVisits.filter((date) => date >= today && !scheduled.includes(date));
    const filled = data.visits.filter((row) => row.scheduled_on !== '');

    const patchRow = (index, patch) => setData('visits', data.visits.map((row, position) => (position === index ? { ...row, ...patch } : row)));
    const removeRow = (index) => setData('visits', data.visits.length === 1 ? [emptyRow()] : data.visits.filter((row, position) => position !== index));

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            className="sm:max-w-lg"
            title={t('amcs.visitDialog.addTitle')}
            description={t('amcs.visitDialog.addDescription', { start: formatDate(contract.startDate), end: formatDate(contract.endDate) })}
            submitLabel={filled.length > 0 ? t('amcs.visitDialog.addSubmit', { count: filled.length }) : t('amcs.schedule.add')}
            processing={processing}
            onSubmit={() => {
                form.transform((values) => ({ ...values, visits: values.visits.filter((row) => row.scheduled_on !== '') }));
                form.post(route('amc-visits.store', contract.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) });
            }}
        >
            {suggested.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-cyan/[0.06] px-3 py-2.5 ring-1 ring-brand-cyan/15">
                    <span className="text-[0.8125rem] text-muted-foreground">
                        {t('amcs.visitDialog.fillHint', { frequency: t(`amcs.visitFrequencies.${contract.visitFrequency}`), count: suggested.length })}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setData('visits', suggested.map((date) => ({ scheduled_on: date, scheduled_time: '' })))}>
                        <WandSparklesIcon data-icon="inline-start" />
                        {t('amcs.visitDialog.fill')}
                    </Button>
                </div>
            )}

            {errors.visits && <p className="text-[0.8125rem] text-destructive">{errors.visits}</p>}

            <ol className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pe-1">
                {data.visits.map((row, index) => {
                    const error = errors[`visits.${index}.scheduled_on`] ?? errors[`visits.${index}.scheduled_time`];

                    return (
                        <li key={index} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="w-6 shrink-0 text-end text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                                <Input
                                    type="date"
                                    aria-label={t('amcs.visitDialog.date', { number: index + 1 })}
                                    min={contract.startDate}
                                    max={contract.endDate}
                                    value={row.scheduled_on}
                                    onChange={(event) => patchRow(index, { scheduled_on: event.target.value })}
                                    aria-invalid={Boolean(error)}
                                    className="flex-1"
                                />
                                <Input
                                    type="time"
                                    aria-label={t('amcs.visitDialog.timeOf', { number: index + 1 })}
                                    value={row.scheduled_time}
                                    onChange={(event) => patchRow(index, { scheduled_time: event.target.value })}
                                    className="w-32"
                                />
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeRow(index)} aria-label={t('amcs.visitDialog.removeRow')}>
                                    <XIcon />
                                </Button>
                            </div>
                            {error && <p className="ps-8 text-xs text-destructive">{error}</p>}
                        </li>
                    );
                })}
            </ol>

            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setData('visits', [...data.visits, emptyRow()])}>
                <PlusIcon data-icon="inline-start" />
                {t('amcs.visitDialog.addRow')}
            </Button>

            <TextareaField
                id="visits-notes"
                label={t('amcs.visitDialog.notes')}
                description={t('amcs.visitDialog.notesHint')}
                value={data.notes}
                onChange={(value) => setData('notes', value)}
                error={errors.notes}
                optional
                rows={2}
            />
        </ActionDialog>
    );
}

/**
 * Contractors' visits as a table: when each falls (blinking red while it
 * needs attention), where it stands and what was recorded when it was
 * done, with a menu per visit to confirm it, mark it done, missed or
 * cancelled, move it or remove it. `showContract` adds the property,
 * contractor and kind of contract, for the list across contracts.
 */
export default function VisitSchedule({ visits, showContract = false }) {
    const { t, formatDate } = useTranslation();
    const [dialog, setDialog] = useState(null);
    const close = (open) => !open && setDialog(null);

    const columns = [
        { id: 'when', header: t('amcs.schedule.columns.when'), cell: (visit) => <VisitWhen visit={visit} /> },
        ...(showContract
            ? [
                  {
                      id: 'contract',
                      header: t('amcs.schedule.columns.contract'),
                      cell: (visit) => (
                          <div className="flex max-w-64 flex-col">
                              <Link href={visit.contract.url} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                  {visit.contract.property?.name ?? visit.contract.number}
                              </Link>
                              <span dir="auto" className="truncate text-xs text-muted-foreground">
                                  {t(amcNavTitle(visit.contract.service))} · {visit.contract.vendor}
                              </span>
                          </div>
                      ),
                  },
              ]
            : []),
        {
            id: 'status',
            header: t('amcs.schedule.columns.status'),
            cell: (visit) =>
                visit.actions.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setDialog({ type: 'status', visit })}
                        aria-label={t('amcs.visitDialog.statusTitle', { date: formatDate(visit.scheduledOn) })}
                        className="rounded-full transition hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <VisitStatusBadge status={visit.status} alert={visit.alert} />
                    </button>
                ) : (
                    <VisitStatusBadge status={visit.status} alert={visit.alert} />
                ),
        },
        { id: 'record', header: t('amcs.schedule.columns.done'), cell: (visit) => <VisitRecord visit={visit} /> },
    ];

    return (
        <>
            <DataTable
                columns={columns}
                rows={visits}
                actions={(visit) => <VisitActions visit={visit} showContract={showContract} onOpen={(type, status) => setDialog({ type, visit, status })} />}
            />

            {dialog?.type === 'status' && (
                <VisitStatusDialog key={`${dialog.visit.id}-${dialog.status ?? 'any'}`} visit={dialog.visit} status={dialog.status} open onOpenChange={close} />
            )}
            {dialog?.type === 'reschedule' && <VisitRescheduleDialog key={dialog.visit.id} visit={dialog.visit} open onOpenChange={close} />}
            {dialog?.type === 'remove' && <VisitRemoveDialog key={dialog.visit.id} visit={dialog.visit} open onOpenChange={close} />}
        </>
    );
}
