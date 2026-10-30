import ActionDialog from '@/Components/ActionDialog';
import { amcRoute } from '@/Components/AmcBadges';
import { ChequePhotoInput } from '@/Components/ChequeScheduleFields';
import DataTable from '@/Components/DataTable';
import { MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { CHEQUE_STAGE_ICONS, ChequeNamedStatusBadge, ChequeStatusBadge, useChequeStatusName } from '@/Components/LeasingBadges';
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
    ArrowRightIcon,
    ArrowRightLeftIcon,
    ArrowUpRightIcon,
    CircleCheckIcon,
    ExternalLinkIcon,
    HistoryIcon,
    ImageIcon,
    MoreHorizontalIcon,
    PencilIcon,
    ReceiptIcon,
    RefreshCwIcon,
    Undo2Icon,
    XIcon,
} from 'lucide-react';
import { useState } from 'react';

/**
 * The step that takes a cheque into each stage, as the server's Cheque::STAGE_ACTIONS.
 */
const STAGE_ACTIONS = { deposited: 'deposit', cleared: 'clear', bounced: 'bounce', returned: 'return', cancelled: 'cancel' };

/**
 * Whether a cheque can move to one of the company's statuses now: another
 * status of the stage it is in, or one of a stage its next step leads to.
 * The server checks the same.
 */
export function canMoveTo(cheque, status) {
    if (status.id === cheque.chequeStatus?.id) {
        return false;
    }

    return status.stage === cheque.status || cheque.actions.includes(STAGE_ACTIONS[status.stage]);
}

/**
 * What moving a cheque into a status does, worded by the status's stage.
 */
function effectKey(cheque, status) {
    if (status.stage === cheque.status) {
        return 'same';
    }

    return status.stage === 'cleared' ? `cleared_${cheque.direction}` : status.stage;
}

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
    switch (agreement.type) {
        case 'contract':
            return route('contracts.show', agreement.id);
        case 'room_rental':
            return route('rentals.show', agreement.id);
        case 'maintenance_contract':
            return route(amcRoute(agreement.service, 'show'), agreement.id);
        default:
            return route('head-leases.show', agreement.id);
    }
}

/**
 * Who a cheque is from or to: the client's or landlord's page, or for a
 * contractor (known by name only) their contract.
 */
function partyHref(cheque) {
    switch (cheque.party.type) {
        case 'client':
            return route('clients.show', cheque.party.id);
        case 'landlord':
            return route('landlords.show', cheque.party.id);
        default:
            return agreementHref(cheque.agreement);
    }
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

    return text ? <span className="max-w-36 text-xs text-pretty text-muted-foreground">{text}</span> : null;
}

/**
 * The words for settling a cheque in one step: cashed for a client's,
 * paid for one the company handed over, or the wording `quickSettle`
 * names, such as submitted.
 */
const settleWording = (cheque, quickSettle) => (typeof quickSettle === 'string' ? quickSettle : cheque.direction === 'received' ? 'cashed' : 'paid');

function ChequeActions({ cheque, statuses, quickSettle, onOpen }) {
    const { t } = useTranslation();
    const label = useChequeLabel()(cheque);
    const statusName = useChequeStatusName();
    const moves = statuses.filter((status) => canMoveTo(cheque, status));
    const cancelling = moves.filter((status) => status.stage === 'cancelled');

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
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel>
                    {quickSettle && cheque.canSettle && (
                        <DropdownMenuItem onClick={() => onOpen('settle')}>
                            <CircleCheckIcon />
                            {t(`leasing.cheques.settle.${settleWording(cheque, quickSettle)}.action`)}
                        </DropdownMenuItem>
                    )}
                    {cheque.canEdit && (
                        <DropdownMenuItem onClick={() => onOpen('details')}>
                            <PencilIcon />
                            {cheque.status === 'pending' ? t('leasing.cheques.actions.record') : t('leasing.cheques.actions.edit')}
                        </DropdownMenuItem>
                    )}
                    {moves.length > 0 && (
                        <DropdownMenuItem onClick={() => onOpen('status')}>
                            <ArrowRightLeftIcon />
                            {t('leasing.cheques.actions.updateStatus')}
                        </DropdownMenuItem>
                    )}
                    {moves
                        .filter((status) => status.stage !== 'cancelled')
                        .map((status) => {
                            const Icon = CHEQUE_STAGE_ICONS[status.stage];

                            return (
                                <DropdownMenuItem key={status.id} onClick={() => onOpen('status', status.id)}>
                                    <Icon />
                                    {t('leasing.cheques.actions.moveTo', { status: statusName(status) })}
                                </DropdownMenuItem>
                            );
                        })}
                    {cheque.canReplace && (
                        <DropdownMenuItem onClick={() => onOpen('replace')}>
                            <RefreshCwIcon />
                            {t('leasing.cheques.actions.replace')}
                        </DropdownMenuItem>
                    )}
                    {cheque.history?.length > 0 && (
                        <DropdownMenuItem onClick={() => onOpen('history')}>
                            <HistoryIcon />
                            {t('leasing.cheques.actions.history')}
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
                                <DropdownMenuItem render={<Link href={cheque.payment.url} />}>
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
                {cancelling.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {cancelling.map((status) => (
                                <DropdownMenuItem key={status.id} variant="destructive" onClick={() => onOpen('status', status.id)}>
                                    <CHEQUE_STAGE_ICONS.cancelled />
                                    {t('leasing.cheques.actions.moveTo', { status: statusName(status) })}
                                </DropdownMenuItem>
                            ))}
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

/**
 * A warning when a cheque goes to the bank before its date.
 */
function PostDatedNote({ children }) {
    return <p className="rounded-lg bg-warning/[0.08] px-3 py-2 text-[0.8125rem] text-warning ring-1 ring-warning/25">{children}</p>;
}

/**
 * The date, the bank's reason (when bouncing) and a note, shared by the
 * one-cheque and several-cheque status dialogs. `dateKey` words the date
 * for the step taken (deposited on, cleared on…), or `other`.
 */
function StatusMoveFields({ idPrefix, chosen, dateKey, data, setData, errors }) {
    const { t } = useTranslation();

    return (
        <>
            <TextField
                id={`${idPrefix}-date`}
                type="date"
                label={t(`leasing.cheques.statusDialog.date.${dateKey}`)}
                value={data.date}
                onChange={(value) => setData('date', value)}
                error={errors.date}
                max={todayIso()}
            />
            {chosen?.stage === 'bounced' && (
                <TextField
                    id={`${idPrefix}-reason`}
                    label={t('leasing.cheques.dialogs.reason')}
                    value={data.reason}
                    onChange={(value) => setData('reason', value)}
                    error={errors.reason}
                    placeholder={t('leasing.cheques.dialogs.reasonPlaceholder')}
                    optional
                />
            )}
            <TextareaField
                id={`${idPrefix}-note`}
                label={t('leasing.cheques.dialogs.note')}
                value={data.note}
                onChange={(value) => setData('note', value)}
                error={errors.note}
                optional
                rows={2}
            />
        </>
    );
}

/**
 * Move one cheque to another of the company's statuses, on a given day,
 * with a note. Says what the move does, such as recording the payment.
 */
function ChequeStatusDialog({ cheque, statuses, statusId, currency, open, onOpenChange }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const label = useChequeLabel()(cheque);
    const statusName = useChequeStatusName();
    const moves = statuses.filter((status) => canMoveTo(cheque, status));
    const form = useForm({
        cheque_status_id: statusId ?? moves.find((status) => status.stage !== 'cancelled')?.id ?? null,
        date: todayIso(),
        reason: '',
        note: '',
    });
    const { data, setData, errors, processing } = form;
    const chosen = moves.find((status) => status.id === data.cheque_status_id);
    const latest = cheque.history?.[0];

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.cheques.statusDialog.title', { label })}
            description={[formatMoney(cheque.amount, currency), cheque.chequeStatus && t('leasing.cheques.statusDialog.now', { status: statusName(cheque.chequeStatus) })]
                .filter(Boolean)
                .join(' · ')}
            submitLabel={t('leasing.cheques.statusDialog.submit')}
            destructive={['bounced', 'cancelled'].includes(chosen?.stage)}
            processing={processing}
            onSubmit={() => form.post(route('cheques.status', cheque.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4">
                {errors.action && <p className="text-[0.8125rem] text-destructive">{errors.action}</p>}
                <SelectField
                    id="cheque-status-status"
                    label={t('leasing.cheques.statusDialog.status')}
                    placeholder={t('leasing.cheques.statusDialog.choose')}
                    value={data.cheque_status_id}
                    onChange={(value) => setData('cheque_status_id', value)}
                    items={moves.map((status) => ({ value: status.id, label: statusName(status) }))}
                    error={errors.cheque_status_id}
                    description={chosen && t(`leasing.cheques.statusDialog.effects.${effectKey(cheque, chosen)}`)}
                />
                <StatusMoveFields
                    idPrefix="cheque-status"
                    chosen={chosen}
                    dateKey={chosen && chosen.stage !== cheque.status && STAGE_ACTIONS[chosen.stage] ? chosen.stage : 'other'}
                    data={data}
                    setData={setData}
                    errors={errors}
                />
                {chosen?.stage === 'deposited' && data.date && data.date < cheque.chequeDate && (
                    <PostDatedNote>{t('leasing.cheques.dialogs.postDated', { date: formatDate(cheque.chequeDate) })}</PostDatedNote>
                )}
            </FieldGroup>
            {latest && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HistoryIcon className="size-3.5 shrink-0" />
                    {t(latest.by ? 'leasing.cheques.statusDialog.lastUpdateBy' : 'leasing.cheques.statusDialog.lastUpdate', {
                        status: latest.status ? statusName(latest.status) : '',
                        date: formatDate(latest.changedOn),
                        name: latest.by,
                    })}
                </p>
            )}
        </ActionDialog>
    );
}

/**
 * Mark a cheque's money as moved in one step, on a given day: a client's
 * cheque cashed (deposited and cleared together when it is still in hand),
 * or one the company handed over paid.
 */
function ChequeSettleDialog({ cheque, way, currency, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const label = useChequeLabel()(cheque);
    const form = useForm({ date: todayIso(), note: '' });
    const { data, setData, errors, processing } = form;

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t(`leasing.cheques.settle.${way}.title`, { label })}
            description={`${formatMoney(cheque.amount, currency)} · ${t(`leasing.cheques.settle.${way}.description`)}`}
            submitLabel={t(`leasing.cheques.settle.${way}.submit`)}
            processing={processing}
            onSubmit={() => form.post(route('cheques.settle', cheque.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4">
                {(errors.cheque || errors.action) && <p className="text-[0.8125rem] text-destructive">{errors.cheque ?? errors.action}</p>}
                <TextField
                    id="cheque-settle-date"
                    type="date"
                    label={t(`leasing.cheques.settle.${way}.date`)}
                    value={data.date}
                    onChange={(value) => setData('date', value)}
                    error={errors.date}
                    max={todayIso()}
                />
                <TextareaField
                    id="cheque-settle-note"
                    label={t('leasing.cheques.dialogs.note')}
                    value={data.note}
                    onChange={(value) => setData('note', value)}
                    error={errors.note}
                    optional
                    rows={2}
                />
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * Move the cheques chosen in the list to one status on the same day. Only
 * statuses at least one of them can move to are offered; the rest of the
 * chosen cheques are left as they are.
 */
function ChequeBulkStatusDialog({ cheques, statuses, open, onOpenChange, onDone }) {
    const { t, formatDate } = useTranslation();
    const statusName = useChequeStatusName();
    const movable = (status) => cheques.filter((cheque) => canMoveTo(cheque, status));
    const offered = statuses.filter((status) => movable(status).length > 0);
    const form = useForm({
        cheque_ids: cheques.map((cheque) => cheque.id),
        cheque_status_id: offered.find((status) => status.stage !== 'cancelled')?.id ?? null,
        date: todayIso(),
        reason: '',
        note: '',
    });
    const { data, setData, errors, processing } = form;
    const chosen = offered.find((status) => status.id === data.cheque_status_id);
    const moving = chosen ? movable(chosen) : [];
    const postDated = chosen?.stage === 'deposited' ? moving.filter((cheque) => data.date && data.date < cheque.chequeDate) : [];

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.cheques.bulk.title', { count: cheques.length })}
            description={t('leasing.cheques.bulk.description')}
            submitLabel={chosen ? t('leasing.cheques.bulk.submit', { count: moving.length }) : t('leasing.cheques.statusDialog.submit')}
            destructive={['bounced', 'cancelled'].includes(chosen?.stage)}
            processing={processing}
            onSubmit={() => form.post(route('cheques.bulk-status'), { preserveScroll: true, onSuccess: onDone })}
        >
            {offered.length === 0 ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-[0.8125rem] text-muted-foreground">{t('leasing.cheques.bulk.noneCanMove')}</p>
            ) : (
                <FieldGroup className="grid gap-4">
                    {errors.action && <p className="text-[0.8125rem] text-destructive">{errors.action}</p>}
                    {errors.cheque_ids && <p className="text-[0.8125rem] text-destructive">{errors.cheque_ids}</p>}
                    <SelectField
                        id="cheque-bulk-status"
                        label={t('leasing.cheques.statusDialog.status')}
                        placeholder={t('leasing.cheques.statusDialog.choose')}
                        value={data.cheque_status_id}
                        onChange={(value) => setData('cheque_status_id', value)}
                        items={offered.map((status) => ({
                            value: status.id,
                            label: `${statusName(status)} (${t('leasing.cheques.bulk.movable', { count: movable(status).length, total: cheques.length })})`,
                        }))}
                        error={errors.cheque_status_id}
                        description={
                            chosen &&
                            (moving.length < cheques.length
                                ? t('leasing.cheques.bulk.leftAsTheyAre', { count: cheques.length - moving.length })
                                : t('leasing.cheques.bulk.allMove'))
                        }
                    />
                    <StatusMoveFields
                        idPrefix="cheque-bulk"
                        chosen={chosen}
                        dateKey={chosen && STAGE_ACTIONS[chosen.stage] ? chosen.stage : 'other'}
                        data={data}
                        setData={setData}
                        errors={errors}
                    />
                    {postDated.length > 0 && (
                        <PostDatedNote>{t('leasing.cheques.bulk.postDated', { count: postDated.length, date: formatDate(data.date) })}</PostDatedNote>
                    )}
                </FieldGroup>
            )}
        </ActionDialog>
    );
}

/**
 * Every status a cheque has moved through, newest first, with who moved it and why.
 */
function ChequeHistoryDialog({ cheque, currency, open, onOpenChange }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const label = useChequeLabel()(cheque);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('leasing.cheques.history.title', { label })}</DialogTitle>
                    <DialogDescription>{formatMoney(cheque.amount, currency)}</DialogDescription>
                </DialogHeader>
                <ol className="flex flex-col divide-y">
                    {cheque.history.map((update) => (
                        <li key={update.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                            <span className="w-24 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">{formatDate(update.changedOn)}</span>
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <span className="flex flex-wrap items-center gap-1.5">
                                    {update.previous && (
                                        <>
                                            <ChequeNamedStatusBadge status={update.previous} />
                                            <ArrowRightIcon aria-hidden="true" className="size-3.5 text-muted-foreground rtl:rotate-180" />
                                        </>
                                    )}
                                    {update.status && <ChequeNamedStatusBadge status={update.status} />}
                                </span>
                                {update.note && (
                                    <p dir="auto" className="text-[0.8125rem] text-pretty">
                                        {update.note}
                                    </p>
                                )}
                                {update.by && <span className="text-xs text-muted-foreground">{t('leasing.cheques.history.by', { name: update.by })}</span>}
                            </div>
                        </li>
                    ))}
                </ol>
            </DialogContent>
        </Dialog>
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
 * menu per cheque for what can happen next: record its details, move it to
 * another of the company's `statuses` (clicking its status does too), see
 * its history or replace it. `showParty` adds who it is from or to and
 * under which agreement; `selectable` adds checkboxes for updating the
 * status of several cheques at once; `quickSettle` adds a button to mark a
 * client's cheque cashed, or one handed over paid, in one step (or worded
 * as it names, such as `submitted`).
 */
export default function ChequeSchedule({ cheques, currency, statuses = [], showParty = false, selectable = false, banks = [], quickSettle = false }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const label = useChequeLabel();
    const [dialog, setDialog] = useState(null);
    const [selected, setSelected] = useState([]);
    const close = (open) => !open && setDialog(null);
    // Only the chosen cheques still listed, after paging or filtering.
    const selectedCheques = cheques.filter((cheque) => selected.includes(cheque.id));

    const name = (cheque) =>
        cheque.purpose === 'security_deposit' ? t('leasing.cheques.purposes.security_deposit') : t('leasing.cheques.schedule.chequeNumber', { number: cheque.sequence });

    // What the cheque is for, under its date: the schedule place and period end here, the agreement in the register.
    const describe = (cheque) => {
        if (showParty) {
            return [name(cheque), cheque.agreement?.number].filter(Boolean).join(' · ');
        }

        if (cheque.replacesId) {
            return `${name(cheque)} · ${t('leasing.cheques.replacementFor')}`;
        }

        return cheque.periodEnd ? `${name(cheque)} · ${t('leasing.cheques.schedule.until', { date: formatDate(cheque.periodEnd) })}` : name(cheque);
    };

    const columns = [
        {
            id: 'cheque',
            header: t('leasing.cheques.columns.cheque'),
            cell: (cheque) => (
                <div className="flex items-center gap-3">
                    {cheque.frontImageUrl ? (
                        <button
                            type="button"
                            onClick={() => setDialog({ type: 'photo', cheque })}
                            className="h-9 w-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition hover:ring-brand-cyan focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                            aria-label={t('leasing.cheques.photo.view', { label: label(cheque) })}
                        >
                            <img src={cheque.frontImageUrl} alt="" className="size-full object-cover" loading="lazy" />
                        </button>
                    ) : (
                        <span
                            className={cn(
                                'flex h-9 w-14 shrink-0 items-center justify-center rounded-lg',
                                cheque.direction === 'received' ? 'bg-success/10 text-success' : 'bg-brand-cyan/12 text-brand-ink',
                            )}
                            title={t(`leasing.cheques.direction.${cheque.direction}`)}
                        >
                            {cheque.direction === 'received' ? <ArrowDownLeftIcon className="size-4" /> : <ArrowUpRightIcon className="size-4" />}
                        </span>
                    )}
                    <div className="flex min-w-0 flex-col">
                        <span className="font-semibold tabular-nums">{formatDate(cheque.chequeDate)}</span>
                        <span className="max-w-56 truncate text-xs text-muted-foreground">{describe(cheque)}</span>
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
                              <div className="flex max-w-52 flex-col">
                                  <Link href={partyHref(cheque)} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                      {cheque.party.name}
                                  </Link>
                                  <Link href={agreementHref(cheque.agreement)} dir="auto" className="truncate text-xs text-muted-foreground underline-offset-4 hover:text-brand-ink hover:underline">
                                      {cheque.property?.name ?? t(`leasing.cheques.direction.${cheque.direction}`)}
                                  </Link>
                              </div>
                          ) : null,
                  },
              ]
            : []),
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
                        <span dir="auto" className="max-w-32 truncate text-xs text-muted-foreground">{cheque.bankName}</span>
                    </div>
                ) : (
                    <span className={cn('text-xs', cheque.isDueNow ? 'font-medium text-warning' : 'text-muted-foreground')}>
                        {t(`leasing.cheques.notRecorded.${cheque.direction}`)}
                    </span>
                ),
        },
        {
            id: 'status',
            header: t('leasing.common.status'),
            cell: (cheque) => (
                <div className="flex flex-col items-start gap-1">
                    {statuses.some((status) => canMoveTo(cheque, status)) ? (
                        <button
                            type="button"
                            onClick={() => setDialog({ type: 'status', cheque })}
                            aria-label={t('leasing.cheques.actions.updateStatusOf', { label: label(cheque) })}
                            title={t('leasing.cheques.actions.updateStatus')}
                            className="rounded-full transition hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <ChequeStatusBadge status={cheque.status} direction={cheque.direction} isOverdue={cheque.isOverdue} chequeStatus={cheque.chequeStatus} />
                        </button>
                    ) : (
                        <ChequeStatusBadge status={cheque.status} direction={cheque.direction} isOverdue={cheque.isOverdue} chequeStatus={cheque.chequeStatus} />
                    )}
                    <StatusDate cheque={cheque} />
                    {quickSettle && cheque.canSettle && (
                        <Button type="button" variant="outline" size="xs" onClick={() => setDialog({ type: 'settle', cheque })} className="text-success">
                            <CircleCheckIcon data-icon="inline-start" />
                            {t(`leasing.cheques.settle.${settleWording(cheque, quickSettle)}.button`)}
                        </Button>
                    )}
                    {cheque.payment && (
                        <Link href={cheque.payment.url} className="text-xs font-medium text-brand-ink underline-offset-4 hover:underline">
                            {cheque.payment.payment_number}
                        </Link>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            {selectable && selectedCheques.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-brand-cyan/[0.06] px-4 py-2 sm:px-5 lg:px-6">
                    <span className="text-sm font-medium">{t('leasing.cheques.bulk.selected', { count: selectedCheques.length })}</span>
                    <div className="ms-auto flex items-center gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
                            <XIcon data-icon="inline-start" />
                            {t('leasing.cheques.bulk.clear')}
                        </Button>
                        <Button type="button" variant="brand" size="sm" onClick={() => setDialog({ type: 'bulk' })}>
                            <ArrowRightLeftIcon data-icon="inline-start" />
                            {t('leasing.cheques.bulk.update')}
                        </Button>
                    </div>
                </div>
            )}

            <DataTable
                columns={columns}
                rows={cheques}
                selection={
                    selectable
                        ? { selected, onChange: setSelected, label: (cheque) => t('leasing.cheques.bulk.select', { label: label(cheque) }), allLabel: t('leasing.cheques.bulk.selectAll') }
                        : undefined
                }
                actions={(cheque) => (
                    <ChequeActions cheque={cheque} statuses={statuses} quickSettle={quickSettle} onOpen={(type, statusId) => setDialog({ type, cheque, statusId })} />
                )}
            />

            {dialog?.type === 'details' && <ChequeDetailsDialog key={dialog.cheque.id} cheque={dialog.cheque} banks={banks} currency={currency} open onOpenChange={close} />}
            {dialog?.type === 'status' && (
                <ChequeStatusDialog
                    key={`${dialog.cheque.id}-${dialog.statusId ?? 'any'}`}
                    cheque={dialog.cheque}
                    statuses={statuses}
                    statusId={dialog.statusId}
                    currency={currency}
                    open
                    onOpenChange={close}
                />
            )}
            {dialog?.type === 'bulk' && (
                <ChequeBulkStatusDialog
                    cheques={selectedCheques}
                    statuses={statuses}
                    open
                    onOpenChange={close}
                    onDone={() => {
                        setDialog(null);
                        setSelected([]);
                    }}
                />
            )}
            {dialog?.type === 'settle' && (
                <ChequeSettleDialog
                    key={dialog.cheque.id}
                    cheque={dialog.cheque}
                    way={settleWording(dialog.cheque, quickSettle)}
                    currency={currency}
                    open
                    onOpenChange={close}
                />
            )}
            {dialog?.type === 'history' && <ChequeHistoryDialog key={dialog.cheque.id} cheque={dialog.cheque} currency={currency} open onOpenChange={close} />}
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
                            <ChequeStatusBadge status={cheque.status} direction={cheque.direction} isOverdue={cheque.isOverdue} chequeStatus={cheque.chequeStatus} />
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
