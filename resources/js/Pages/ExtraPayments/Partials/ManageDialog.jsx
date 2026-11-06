import { METHOD_ICONS } from '@/Components/FinanceBadges';
import { MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useCan } from '@/hooks/use-can';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Link, router, useForm } from '@inertiajs/react';
import { BanIcon, ExternalLinkIcon, RotateCcwIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';
import StandingBadge from './StandingBadge';

/**
 * The routes and permission of each kind of extra payment.
 */
export const KINDS = {
    commission: { routes: 'commissions', permission: 'commissions.settle' },
    deposit: { routes: 'deposits', permission: 'deposits.settle' },
    extra_income: { routes: 'extra-incomes', permission: 'extra_income.settle' },
};

export const agreementHref = (agreement) => (agreement.type === 'contract' ? route('contracts.show', agreement.id) : route('rentals.show', agreement.id));

function SubmitButton({ processing, children }) {
    return (
        <Button type="submit" disabled={processing} className="self-end">
            {processing && <Spinner data-icon="inline-start" />}
            {children}
        </Button>
    );
}

/**
 * Money left for later has arrived: the day, and cash or a cheque.
 */
function ReceiveForm({ record, onDone }) {
    const { t } = useTranslation();
    const form = useForm({ received_on: todayIso(), method: 'cash', cheque_number: '', bank_name: '', cheque_date: todayIso() });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `receive-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });
    const methods = ['cash', 'cheque'].map((value) => ({ value, label: t(`extraPayments.payment.${value}`) }));

    return (
        <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(route(`${KINDS[record.kind].routes}.receive`, { record: record.id }), { preserveScroll: true, onSuccess: onDone });
            }}
        >
            <div>
                <h3 className="text-sm font-semibold">{t('extraPayments.receive.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('extraPayments.receive.description')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <TextField {...bind('received_on')} type="date" label={t('extraPayments.receive.fields.receivedOn')} />
                <SelectField {...bind('method')} label={t('extraPayments.payment.label')} items={methods} />
                {data.method === 'cheque' && (
                    <>
                        <TextField {...bind('cheque_number')} label={t('extraPayments.payment.chequeNumber')} />
                        <TextField {...bind('bank_name')} label={t('extraPayments.payment.bank')} />
                        <TextField {...bind('cheque_date')} type="date" label={t('extraPayments.payment.chequeDate')} />
                    </>
                )}
            </div>
            <SubmitButton processing={processing}>{t('extraPayments.receive.submit')}</SubmitButton>
        </form>
    );
}

/**
 * Money paid out of the record: the day, how much, who to, how and why.
 */
function SettleForm({ record, currency, methods, paidTo, onDone }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ settled_on: todayIso(), amount: record.remaining, paid_to: paidTo ?? '', method: 'cash', reference: '', notes: '' });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `settle-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(route(`${KINDS[record.kind].routes}.settlements.store`, { record: record.id }), { preserveScroll: true, onSuccess: onDone });
            }}
        >
            <div>
                <h3 className="text-sm font-semibold">{t('extraPayments.settle.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('extraPayments.settle.description')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <TextField {...bind('settled_on')} type="date" label={t('extraPayments.settle.fields.settledOn')} />
                <MoneyField
                    {...bind('amount')}
                    label={t('extraPayments.settle.fields.amount')}
                    currency={currency}
                    description={t('extraPayments.settle.fields.amountHint', { amount: formatMoney(record.remaining, currency) })}
                />
                <TextField {...bind('paid_to')} label={t('extraPayments.settle.fields.paidTo')} placeholder={t('extraPayments.settle.fields.paidToPlaceholder')} />
                <SelectField {...bind('method')} label={t('extraPayments.settle.fields.method')} items={methods.map((value) => ({ value, label: t(`leasing.methods.${value}`) }))} />
                <TextField
                    {...bind('reference')}
                    optional
                    className="sm:col-span-2"
                    label={t('extraPayments.settle.fields.reference')}
                    placeholder={t('extraPayments.settle.fields.referencePlaceholder')}
                />
                <TextareaField {...bind('notes')} optional rows={2} className="sm:col-span-2" label={t('extraPayments.settle.fields.notes')} />
            </div>
            <SubmitButton processing={processing}>{t('extraPayments.settle.submit')}</SubmitButton>
        </form>
    );
}

/**
 * Each settlement so far, which can be taken back after a second click.
 */
function SettlementHistory({ record, currency, canSettle, onDone }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const [undoing, setUndoing] = useState(null);

    const undo = (settlement) => {
        if (undoing !== settlement.id) {
            setUndoing(settlement.id);

            return;
        }

        router.delete(route(`${KINDS[record.kind].routes}.settlements.destroy`, { record: record.id, settlement: settlement.id }), { preserveScroll: true, onSuccess: onDone });
    };

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('extraPayments.settlements.title')}</h3>
            {record.settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('extraPayments.settlements.empty')}</p>
            ) : (
                <ul className="flex flex-col divide-y rounded-lg border">
                    {record.settlements.map((settlement) => {
                        const Icon = METHOD_ICONS[settlement.method];

                        return (
                            <li key={settlement.id} className="flex items-start gap-3 px-3 py-2.5">
                                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                                        <span dir="auto" className="font-medium">
                                            {settlement.paidTo ?? t(`leasing.methods.${settlement.method}`)}
                                        </span>
                                        <span className="font-semibold tabular-nums">{formatMoney(settlement.amount, currency)}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {[
                                            formatDate(settlement.settledOn),
                                            t(`leasing.methods.${settlement.method}`),
                                            settlement.reference,
                                            settlement.by && t('extraPayments.settlements.by', { name: settlement.by }),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                    {settlement.notes && (
                                        <p dir="auto" className="mt-1 text-sm text-pretty text-muted-foreground">
                                            {settlement.notes}
                                        </p>
                                    )}
                                </div>
                                {canSettle && (
                                    <Button type="button" variant={undoing === settlement.id ? 'destructive' : 'ghost'} size="sm" onClick={() => undo(settlement)}>
                                        <Undo2Icon data-icon="inline-start" />
                                        {t(undoing === settlement.id ? 'extraPayments.settlements.confirmUndo' : 'extraPayments.settlements.undo')}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * Cancel a commission or deposit that will not be paid, or count it again.
 */
function StatusAction({ record, onDone }) {
    const { t } = useTranslation();
    const [isConfirming, setIsConfirming] = useState(false);
    const form = useForm({ cancelled: record.status !== 'cancelled' });
    const send = () => form.post(route(`${KINDS[record.kind].routes}.status`, { record: record.id }), { preserveScroll: true, onSuccess: onDone });

    if (record.status === 'cancelled') {
        return (
            <Button type="button" variant="outline" size="sm" disabled={form.processing} onClick={send}>
                <RotateCcwIcon data-icon="inline-start" />
                {t('extraPayments.manage.restore')}
            </Button>
        );
    }

    return (
        <Button type="button" variant={isConfirming ? 'destructive' : 'ghost'} size="sm" disabled={form.processing} onClick={() => (isConfirming ? send() : setIsConfirming(true))}>
            <BanIcon data-icon="inline-start" />
            {t(isConfirming ? 'extraPayments.manage.confirmCancel' : 'extraPayments.manage.cancel')}
        </Button>
    );
}

/**
 * Everything about one extra payment: where its money stands, how it
 * arrived and how it was settled, with the forms to receive or settle it.
 * People without the settle permission see the figures and history only.
 */
function ManageDialog({ record, description, currency, methods, paidTo, onClose }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const can = useCan();
    const canSettle = can(KINDS[record.kind].permission);
    const isAgreementMoney = record.kind !== 'extra_income';
    const received = record.receivedOn && t('extraPayments.manage.received', { date: formatDate(record.receivedOn), method: t(`leasing.methods.${record.method}`) });
    const cheque =
        record.chequeNumber && t('extraPayments.manage.cheque', { number: record.chequeNumber, bank: record.bankName, date: record.chequeDate ? formatDate(record.chequeDate) : '—' });

    return (
        <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        {t('extraPayments.manage.title', { number: record.number })}
                        <StandingBadge standing={record.standing} />
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <dl className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3">
                    {[
                        ['amount', record.amount],
                        ['settled', record.settled],
                        ['remaining', record.remaining],
                    ].map(([key, value]) => (
                        <div key={key} className="flex min-w-0 flex-col gap-0.5">
                            <dt className="text-xs text-muted-foreground">{t(`extraPayments.manage.${key}`)}</dt>
                            <dd className="truncate font-semibold tabular-nums">{formatMoney(value, currency)}</dd>
                        </div>
                    ))}
                </dl>

                <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                    <p>{received || t('extraPayments.notReceived')}</p>
                    {cheque && <p>{cheque}</p>}
                    {record.agreement && (
                        <Link href={agreementHref(record.agreement)} className="flex w-fit items-center gap-1.5 font-medium text-brand-ink underline-offset-4 hover:underline">
                            {t('extraPayments.manage.openAgreement', { number: record.agreement.number })}
                            <ExternalLinkIcon className="size-3.5" />
                        </Link>
                    )}
                </div>

                {canSettle && record.status === 'pending' && <ReceiveForm record={record} onDone={onClose} />}
                {canSettle && record.status === 'received' && record.remaining > 0 && (
                    <SettleForm record={record} currency={currency} methods={methods} paidTo={paidTo} onDone={onClose} />
                )}
                {record.status === 'received' && record.remaining <= 0 && <p className="text-sm font-medium text-success">{t('extraPayments.manage.allSettled')}</p>}
                {record.status === 'cancelled' && <p className="text-sm text-muted-foreground">{t('extraPayments.manage.cancelledNote')}</p>}

                <Separator />

                <SettlementHistory record={record} currency={currency} canSettle={canSettle} onDone={onClose} />

                {canSettle && isAgreementMoney && record.settled <= 0 && (
                    <div className="flex justify-end">
                        <StatusAction record={record} onDone={onClose} />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * The row's Manage button and its dialog. `description` says whose money it
 * is; `paidTo` starts the settlement form, such as a deposit's tenant.
 */
export default function ManageButton({ record, description, currency, methods, paidTo }) {
    const { t } = useTranslation();
    const can = useCan();
    const [isOpen, setIsOpen] = useState(false);
    const canSettle = can(KINDS[record.kind].permission);

    return (
        <>
            <Button variant="outline" size="sm" aria-label={t('extraPayments.manage.openLabel', { number: record.number })} onClick={() => setIsOpen(true)}>
                {t(canSettle ? 'extraPayments.manage.open' : 'extraPayments.manage.details')}
            </Button>
            {isOpen && <ManageDialog record={record} description={description} currency={currency} methods={methods} paidTo={paidTo} onClose={() => setIsOpen(false)} />}
        </>
    );
}
