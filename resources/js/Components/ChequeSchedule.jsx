import ActionDialog from '@/Components/ActionDialog';
import { ChequePhotoInput } from '@/Components/ChequeScheduleFields';
import DataTable from '@/Components/DataTable';
import { MoneyField, TextareaField, TextField } from '@/Components/FormFields';
import { ChequeStatusBadge } from '@/Components/LeasingBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import {
    ArrowDownLeftIcon,
    ArrowUpRightIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ExternalLinkIcon,
    ImageIcon,
    LandmarkIcon,
    MoreHorizontalIcon,
    PencilIcon,
    ReceiptIcon,
    RefreshCwIcon,
    Undo2Icon,
    UndoIcon,
} from 'lucide-react';
import { useState } from 'react';

const ACTION_ICONS = { deposit: LandmarkIcon, clear: CircleCheckIcon, bounce: Undo2Icon, return: UndoIcon, cancel: CircleSlashIcon };

/**
 * "No. 402601", or the cheque's place in the schedule ("#3", "Deposit")
 * before it has a number.
 */
export function useChequeLabel() {
    const { t } = useTranslation();

    return (cheque) =>
        cheque.chequeNumber
            ? t('leasing.cheques.number', { number: cheque.chequeNumber })
            : cheque.purpose === 'security_deposit'
              ? t('leasing.cheques.deposit')
              : `#${cheque.sequence}`;
}

function agreementHref(agreement) {
    return agreement.type === 'contract' ? route('contracts.show', agreement.id) : route('head-leases.show', agreement.id);
}

function partyHref(party) {
    return party.type === 'client' ? route('clients.show', party.id) : route('landlords.show', party.id);
}

/**
 * The date that best describes where a cheque stands, under its status.
 */
function StatusDate({ cheque }) {
    const { t, formatDate } = useTranslation();
    let text = null;

    if (cheque.status === 'cleared' && cheque.clearedOn) {
        text = t('leasing.cheques.clearedOn', { date: formatDate(cheque.clearedOn) });
    } else if (cheque.status === 'bounced' && cheque.bouncedOn) {
        text = [t('leasing.cheques.bouncedOn', { date: formatDate(cheque.bouncedOn) }), cheque.bounceReason].filter(Boolean).join(' · ');
    } else if (cheque.status === 'deposited' && cheque.depositedOn) {
        text = t('leasing.cheques.depositedOn', { date: formatDate(cheque.depositedOn) });
    } else if (['received', 'issued', 'returned'].includes(cheque.status) && cheque.handedOverOn) {
        text = t(`leasing.cheques.handedOverOn.${cheque.status === 'returned' ? 'returned' : cheque.direction}`, { date: formatDate(cheque.handedOverOn) });
    }

    return text ? <span className="max-w-44 truncate text-xs text-muted-foreground">{text}</span> : null;
}

function ChequeActions({ cheque, onOpen }) {
    const { t } = useTranslation();
    const label = useChequeLabel()(cheque);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('leasing.cheques.actions.menu', { label })}
                        className="text-muted-foreground hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground"
                    />
                }
            >
                <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
                    {cheque.canEdit && (
                        <DropdownMenuItem onClick={() => onOpen('details')}>
                            <PencilIcon />
                            {cheque.status === 'pending' ? t('leasing.cheques.actions.record') : t('leasing.cheques.actions.edit')}
                        </DropdownMenuItem>
                    )}
                    {cheque.actions
                        .filter((action) => action !== 'cancel')
                        .map((action) => {
                            const Icon = ACTION_ICONS[action];

                            return (
                                <DropdownMenuItem key={action} onClick={() => onOpen('transition', action)}>
                                    <Icon />
                                    {t(`leasing.cheques.actions.${action}`)}
                                </DropdownMenuItem>
                            );
                        })}
                    {cheque.canReplace && (
                        <DropdownMenuItem onClick={() => onOpen('replace')}>
                            <RefreshCwIcon />
                            {t('leasing.cheques.actions.replace')}
                        </DropdownMenuItem>
                    )}
                    {cheque.frontImageUrl && (
                        <DropdownMenuItem onClick={() => onOpen('photo')}>
                            <ImageIcon />
                            {t('leasing.cheques.actions.viewPhoto')}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                {(cheque.payment || cheque.agreement) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {cheque.payment && (
                                <DropdownMenuItem render={<Link href={route('payments.show', cheque.payment.id)} />}>
                                    <ReceiptIcon />
                                    {t('leasing.cheques.actions.viewPayment')}
                                </DropdownMenuItem>
                            )}
                            {cheque.agreement && (
                                <DropdownMenuItem render={<Link href={agreementHref(cheque.agreement)} />}>
                                    <ExternalLinkIcon />
                                    {t('leasing.cheques.actions.openAgreement', { number: cheque.agreement.number })}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                )}
                {cheque.actions.includes('cancel') && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem variant="destructive" onClick={() => onOpen('transition', 'cancel')}>
                                <CircleSlashIcon />
                                {t('leasing.cheques.actions.cancel')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ChequeDetailsDialog({ cheque, banks, currency, open, onOpenChange }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const label = useChequeLabel()(cheque);
    const form = useForm({
        cheque_date: cheque.chequeDate,
        amount: cheque.amount,
        cheque_number: cheque.chequeNumber ?? '',
        bank_name: cheque.bankName ?? '',
        account_holder: cheque.accountHolder ?? '',
        notes: cheque.notes ?? '',
        front_image: null,
        back_image: null,
        remove_front_image: false,
        remove_back_image: false,
    });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `cheque-details-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.cheques.dialogs.detailsTitle', { label })}
            description={t('leasing.cheques.dialogs.detailsDescription', { amount: formatMoney(cheque.amount, currency), date: formatDate(cheque.chequeDate) })}
            submitLabel={t('leasing.cheques.dialogs.save')}
            processing={processing}
            className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
            onSubmit={() => {
                form.transform((values) => ({ ...values, _method: 'put' }));
                form.post(route('cheques.update', cheque.id), { forceFormData: true, preserveScroll: true, onSuccess: () => onOpenChange(false) });
            }}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField {...bind('cheque_date')} type="date" label={t('leasing.cheques.fields.chequeDate')} />
                <MoneyField {...bind('amount')} label={t('leasing.cheques.fields.amount')} currency={currency} />
                <TextField {...bind('cheque_number')} label={t('leasing.cheques.fields.number')} inputClassName="font-mono" inputMode="numeric" />
                <TextField {...bind('bank_name')} label={t('leasing.cheques.fields.bank')} list="cheque-dialog-banks" />
                <TextField {...bind('account_holder')} label={t(`leasing.cheques.fields.holder.${cheque.direction}`)} optional className="sm:col-span-2" dir="auto" />
                <ChequePhotoInput
                    id="cheque-details-front"
                    label={t('leasing.cheques.fields.front')}
                    required={cheque.isDueNow}
                    file={data.front_image}
                    url={cheque.frontImageUrl}
                    removed={data.remove_front_image}
                    onFile={(file) => setData((current) => ({ ...current, front_image: file, remove_front_image: false }))}
                    onRemove={() => setData((current) => ({ ...current, front_image: null, remove_front_image: true }))}
                    error={errors.front_image}
                />
                <ChequePhotoInput
                    id="cheque-details-back"
                    label={t('leasing.cheques.fields.back')}
                    file={data.back_image}
                    url={cheque.backImageUrl}
                    removed={data.remove_back_image}
                    onFile={(file) => setData((current) => ({ ...current, back_image: file, remove_back_image: false }))}
                    onRemove={() => setData((current) => ({ ...current, back_image: null, remove_back_image: true }))}
                    error={errors.back_image}
                />
                <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional rows={2} className="sm:col-span-2" />
            </FieldGroup>
            <datalist id="cheque-dialog-banks">
                {banks.map((bank) => (
                    <option key={bank} value={bank} />
                ))}
            </datalist>
        </ActionDialog>
    );
}

function ChequeTransitionDialog({ cheque, action, currency, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const label = useChequeLabel()(cheque);
    const form = useForm({ action, date: todayIso(), reason: '', note: '' });
    const { data, setData, errors, processing } = form;
    const descriptionKey = action === 'clear' ? `clear_${cheque.direction}` : action;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t(`leasing.cheques.dialogs.transitionTitle.${action}`, { label })}
            description={`${formatMoney(cheque.amount, currency)} · ${t(`leasing.cheques.dialogs.transitionDescription.${descriptionKey}`)}`}
            submitLabel={t(`leasing.cheques.dialogs.submit.${action}`)}
            destructive={['bounce', 'cancel'].includes(action)}
            processing={processing}
            onSubmit={() => form.post(route('cheques.transition', cheque.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4">
                {errors.action && <p className="text-[0.8125rem] text-destructive">{errors.action}</p>}
                {action !== 'cancel' && (
                    <TextField
                        id="cheque-transition-date"
                        type="date"
                        label={t(`leasing.cheques.dialogs.date.${action}`)}
                        value={data.date}
                        onChange={(value) => setData('date', value)}
                        error={errors.date}
                        max={todayIso()}
                    />
                )}
                {action === 'bounce' && (
                    <TextField
                        id="cheque-transition-reason"
                        label={t('leasing.cheques.dialogs.reason')}
                        value={data.reason}
                        onChange={(value) => setData('reason', value)}
                        error={errors.reason}
                        placeholder={t('leasing.cheques.dialogs.reasonPlaceholder')}
                        optional
                    />
                )}
                {['return', 'cancel'].includes(action) && (
                    <TextareaField
                        id="cheque-transition-note"
                        label={t('leasing.cheques.dialogs.note')}
                        value={data.note}
                        onChange={(value) => setData('note', value)}
                        error={errors.note}
                        optional
                        rows={2}
                    />
                )}
            </FieldGroup>
        </ActionDialog>
    );
}

function ChequeReplaceDialog({ cheque, banks, currency, open, onOpenChange }) {
    const { t } = useTranslation();
    const label = useChequeLabel()(cheque);
    const form = useForm({
        cheque_date: todayIso(),
        amount: cheque.amount,
        cheque_number: '',
        bank_name: cheque.bankName ?? '',
        account_holder: cheque.accountHolder ?? '',
        front_image: null,
        back_image: null,
    });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `cheque-replace-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.cheques.dialogs.replaceTitle', { label })}
            description={t('leasing.cheques.dialogs.replaceDescription')}
            submitLabel={t('leasing.cheques.dialogs.replaceSave')}
            processing={processing}
            className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
            onSubmit={() => form.post(route('cheques.replace', cheque.id), { forceFormData: true, preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField {...bind('cheque_date')} type="date" label={t('leasing.cheques.fields.chequeDate')} />
                <MoneyField {...bind('amount')} label={t('leasing.cheques.fields.amount')} currency={currency} />
                <TextField {...bind('cheque_number')} label={t('leasing.cheques.fields.number')} inputClassName="font-mono" inputMode="numeric" />
                <TextField {...bind('bank_name')} label={t('leasing.cheques.fields.bank')} list="cheque-replace-banks" />
                <TextField {...bind('account_holder')} label={t(`leasing.cheques.fields.holder.${cheque.direction}`)} optional className="sm:col-span-2" dir="auto" />
                <ChequePhotoInput
                    id="cheque-replace-front"
                    label={t('leasing.cheques.fields.front')}
                    required
                    file={data.front_image}
                    onFile={(file) => setData('front_image', file)}
                    onRemove={() => setData('front_image', null)}
                    error={errors.front_image}
                />
                <ChequePhotoInput
                    id="cheque-replace-back"
                    label={t('leasing.cheques.fields.back')}
                    file={data.back_image}
                    onFile={(file) => setData('back_image', file)}
                    onRemove={() => setData('back_image', null)}
                    error={errors.back_image}
                />
            </FieldGroup>
            <datalist id="cheque-replace-banks">
                {banks.map((bank) => (
                    <option key={bank} value={bank} />
                ))}
            </datalist>
        </ActionDialog>
    );
}

function ChequePhotoDialog({ cheque, open, onOpenChange }) {
    const { t } = useTranslation();
    const label = useChequeLabel()(cheque);
    const sides = [
        { key: 'front', url: cheque.frontImageUrl },
        { key: 'back', url: cheque.backImageUrl },
    ].filter((side) => side.url);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{t('leasing.cheques.dialogs.photoTitle', { label })}</DialogTitle>
                    <DialogDescription>{[cheque.bankName, cheque.accountHolder].filter(Boolean).join(' · ') || ' '}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                    {sides.map((side) => (
                        <figure key={side.key} className="flex flex-col gap-1.5">
                            <figcaption className="text-xs font-medium text-muted-foreground">{t(`leasing.cheques.photo.${side.key}`)}</figcaption>
                            <a href={side.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                                <img src={side.url} alt={t('leasing.cheques.photo.view', { label })} className="max-h-[60vh] w-full object-contain" />
                            </a>
                        </figure>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The cheques of an agreement (or the whole register) as a table, with a
 * menu per cheque for what can happen next: record its details, deposit,
 * clear, bounce, hand back, cancel or replace it. `showParty` adds who it
 * is from or to and under which agreement.
 */
export default function ChequeSchedule({ cheques, currency, showParty = false, banks = [] }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const label = useChequeLabel();
    const [dialog, setDialog] = useState(null);
    const close = (open) => !open && setDialog(null);

    const columns = [
        {
            id: 'cheque',
            header: t('leasing.cheques.columns.cheque'),
            cell: (cheque) => (
                <div className="flex items-center gap-3">
                    <span
                        className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-xl',
                            cheque.direction === 'received' ? 'bg-success/10 text-success' : 'bg-brand-cyan/12 text-brand-ink',
                        )}
                        title={t(`leasing.cheques.direction.${cheque.direction}`)}
                    >
                        {cheque.direction === 'received' ? <ArrowDownLeftIcon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <span className="font-medium">
                            {cheque.purpose === 'security_deposit' ? t('leasing.cheques.purposes.security_deposit') : t('leasing.cheques.schedule.chequeNumber', { number: cheque.sequence })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {cheque.replacesId
                                ? t('leasing.cheques.replacementFor')
                                : cheque.periodStart
                                  ? t('leasing.cheques.schedule.covers', { start: formatDate(cheque.periodStart), end: formatDate(cheque.periodEnd) })
                                  : t('leasing.cheques.purposes.security_deposit')}
                        </span>
                    </div>
                </div>
            ),
        },
        ...(showParty
            ? [
                  {
                      id: 'party',
                      header: t('leasing.cheques.columns.party'),
                      cell: (cheque) =>
                          cheque.party ? (
                              <div className="flex max-w-56 flex-col">
                                  <Link href={partyHref(cheque.party)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                                      {cheque.party.name}
                                  </Link>
                                  <Link href={agreementHref(cheque.agreement)} className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                                      {[cheque.agreement.number, cheque.property?.name].filter(Boolean).join(' · ')}
                                  </Link>
                              </div>
                          ) : null,
                  },
              ]
            : []),
        {
            id: 'date',
            header: t('leasing.cheques.columns.date'),
            cell: (cheque) => <span className="font-medium tabular-nums">{formatDate(cheque.chequeDate)}</span>,
        },
        {
            id: 'amount',
            header: t('leasing.common.amount'),
            align: 'end',
            cell: (cheque) => <span className="font-semibold tabular-nums">{formatMoney(cheque.amount, currency)}</span>,
        },
        {
            id: 'details',
            header: t('leasing.cheques.columns.details'),
            cell: (cheque) =>
                cheque.chequeNumber ? (
                    <div className="flex flex-col">
                        <span className="font-mono text-sm">{cheque.chequeNumber}</span>
                        <span className="max-w-40 truncate text-xs text-muted-foreground">{cheque.bankName}</span>
                    </div>
                ) : (
                    <span className={cn('text-xs', cheque.isDueNow ? 'font-medium text-warning' : 'text-muted-foreground')}>
                        {t(`leasing.cheques.notRecorded.${cheque.direction}`)}
                    </span>
                ),
        },
        {
            id: 'photo',
            header: t('leasing.cheques.columns.photo'),
            cell: (cheque) =>
                cheque.frontImageUrl ? (
                    <button
                        type="button"
                        onClick={() => setDialog({ type: 'photo', cheque })}
                        className="block h-9 w-16 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10 transition hover:ring-brand-cyan focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={t('leasing.cheques.photo.view', { label: label(cheque) })}
                    >
                        <img src={cheque.frontImageUrl} alt="" className="size-full object-cover" loading="lazy" />
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
        },
        {
            id: 'status',
            header: t('leasing.common.status'),
            cell: (cheque) => (
                <div className="flex flex-col items-start gap-1">
                    <span className="flex items-center gap-1.5">
                        <ChequeStatusBadge status={cheque.status} direction={cheque.direction} isOverdue={cheque.isOverdue} />
                        {cheque.payment && (
                            <Badge variant="outline" render={<Link href={route('payments.show', cheque.payment.id)} />}>
                                {cheque.payment.payment_number}
                            </Badge>
                        )}
                    </span>
                    <StatusDate cheque={cheque} />
                </div>
            ),
        },
    ];

    return (
        <>
            <DataTable columns={columns} rows={cheques} actions={(cheque) => <ChequeActions cheque={cheque} onOpen={(type, action) => setDialog({ type, cheque, action })} />} />

            {dialog?.type === 'details' && <ChequeDetailsDialog key={dialog.cheque.id} cheque={dialog.cheque} banks={banks} currency={currency} open onOpenChange={close} />}
            {dialog?.type === 'transition' && (
                <ChequeTransitionDialog key={`${dialog.cheque.id}-${dialog.action}`} cheque={dialog.cheque} action={dialog.action} currency={currency} open onOpenChange={close} />
            )}
            {dialog?.type === 'replace' && <ChequeReplaceDialog key={dialog.cheque.id} cheque={dialog.cheque} banks={banks} currency={currency} open onOpenChange={close} />}
            {dialog?.type === 'photo' && <ChequePhotoDialog key={dialog.cheque.id} cheque={dialog.cheque} open onOpenChange={close} />}
        </>
    );
}

/**
 * Cheques as a short list for a side column: amount, which cheque under
 * which agreement (and who, with `showParty`), its date and status. Each
 * row opens the agreement the cheque belongs to.
 */
export function ChequeList({ cheques, currency, showParty = false, empty }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const label = useChequeLabel();

    if (cheques.length === 0) {
        return <p className="text-sm text-muted-foreground">{empty}</p>;
    }

    return (
        <ul className="-mx-2 flex flex-col">
            {cheques.map((cheque) => (
                <li key={cheque.id}>
                    <Link
                        href={cheque.agreement ? agreementHref(cheque.agreement) : '#'}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <span
                            className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                                cheque.status === 'bounced'
                                    ? 'bg-destructive/10 text-destructive'
                                    : cheque.direction === 'received'
                                      ? 'bg-success/10 text-success'
                                      : 'bg-brand-cyan/12 text-brand-ink',
                            )}
                        >
                            {cheque.status === 'bounced' ? (
                                <Undo2Icon className="size-4" />
                            ) : cheque.direction === 'received' ? (
                                <ArrowDownLeftIcon className="size-4" />
                            ) : (
                                <ArrowUpRightIcon className="size-4" />
                            )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold tabular-nums">{formatMoney(cheque.amount, currency)}</span>
                            <span className="truncate text-xs text-muted-foreground" dir="auto">
                                {[showParty ? cheque.party?.name : null, label(cheque), cheque.agreement?.number].filter(Boolean).join(' · ')}
                            </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs tabular-nums">{formatDate(cheque.chequeDate)}</span>
                            <ChequeStatusBadge status={cheque.status} direction={cheque.direction} isOverdue={cheque.isOverdue} />
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
