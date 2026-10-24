import ActionDialog from '@/Components/ActionDialog';
import { ChequePhotoInput } from '@/Components/ChequeScheduleFields';
import { METHOD_ICONS } from '@/Components/FinanceBadges';
import { ChoiceField, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';
import { BanknoteIcon, CircleAlertIcon, InfoIcon, ShieldCheckIcon, TagIcon } from 'lucide-react';

const PURPOSE_ICONS = { rent: BanknoteIcon, deposit: ShieldCheckIcon, other: TagIcon };

/**
 * What a payment for `purpose` would normally come to: the rent still to
 * pay for the next month due (or a month in advance when paid up), or
 * the deposit still to collect.
 */
function suggestedAmount(rental, purpose) {
    if (purpose === 'deposit') {
        return rental.deposit.toCollect || '';
    }

    if (purpose === 'rent') {
        return rental.standing.arrears > 0 ? rental.standing.arrears : rental.standing.nextDueAmount || rental.monthlyRent;
    }

    return '';
}

/**
 * Record what a tenant paid: rent, the deposit or another charge. Cash,
 * card and transfers become a receipt straight away; a cheque goes to the
 * cheque register (with its number, bank, date and photos) and becomes a
 * receipt when it clears.
 */
export function RecordPaymentDialog({ rental, currency, banks, methods, open, onOpenChange }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const initialPurpose = rental.deposit.toCollect > 0 && rental.standing.paid === 0 ? 'deposit' : 'rent';
    const form = useForm({
        purpose: initialPurpose,
        method: 'cash',
        amount: suggestedAmount(rental, initialPurpose),
        paid_on: todayIso(),
        reference: '',
        notes: '',
        cheque_number: '',
        bank_name: '',
        cheque_date: rental.standing.nextDue ?? todayIso(),
        account_holder: rental.tenant?.name ?? '',
        front_image: null,
        back_image: null,
    });
    const { data, setData, errors, processing } = form;
    const isCheque = data.method === 'cheque';
    const bind = (field) => ({ id: `rental-payment-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const choosePurpose = (purpose) => setData((current) => ({ ...current, purpose, amount: suggestedAmount(rental, purpose) }));

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.rentals.payment.title', { name: rental.tenant?.name ?? rental.number })}
            description={
                rental.standing.arrears > 0
                    ? t('finance.rentals.payment.owes', { amount: formatMoney(rental.standing.arrears, currency) })
                    : rental.standing.nextDue
                      ? t('finance.rentals.payment.nextDue', { date: formatDate(rental.standing.nextDue), amount: formatMoney(rental.standing.nextDueAmount, currency) })
                      : t('finance.rentals.payment.description')
            }
            submitLabel={isCheque ? t('finance.rentals.payment.saveCheque') : t('finance.rentals.payment.save')}
            processing={processing}
            className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
            onSubmit={() => form.post(route('rentals.payments.store', rental.id), { forceFormData: isCheque, preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    id="rental-payment-purpose"
                    label={t('finance.rentals.payment.purpose')}
                    value={data.purpose}
                    onChange={choosePurpose}
                    options={['rent', 'deposit', 'other'].map((purpose) => ({ value: purpose, label: t(`finance.receipts.purposes.${purpose}`), icon: PURPOSE_ICONS[purpose] }))}
                    error={errors.purpose}
                    className="sm:col-span-2"
                />
                <ChoiceField
                    id="rental-payment-method"
                    label={t('finance.rentals.payment.method')}
                    value={data.method}
                    onChange={(method) => setData('method', method)}
                    options={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`), icon: METHOD_ICONS[method] }))}
                    error={errors.method}
                    className="sm:col-span-2"
                />
                <MoneyField {...bind('amount')} label={t('leasing.common.amount')} currency={currency} />
                {isCheque ? (
                    <TextField {...bind('cheque_date')} type="date" label={t('leasing.cheques.fields.chequeDate')} />
                ) : (
                    <TextField {...bind('paid_on')} type="date" label={t('finance.rentals.payment.paidOn')} max={todayIso()} />
                )}
                {isCheque ? (
                    <>
                        <TextField {...bind('cheque_number')} label={t('leasing.cheques.fields.number')} inputClassName="font-mono" inputMode="numeric" />
                        <TextField {...bind('bank_name')} label={t('leasing.cheques.fields.bank')} list="rental-payment-banks" />
                        <TextField {...bind('account_holder')} label={t('leasing.cheques.fields.holder.received')} optional dir="auto" className="sm:col-span-2" />
                        <ChequePhotoInput
                            id="rental-payment-front"
                            label={t('leasing.cheques.fields.front')}
                            file={data.front_image}
                            onFile={(file) => setData('front_image', file)}
                            onRemove={() => setData('front_image', null)}
                            error={errors.front_image}
                        />
                        <ChequePhotoInput
                            id="rental-payment-back"
                            label={t('leasing.cheques.fields.back')}
                            file={data.back_image}
                            onFile={(file) => setData('back_image', file)}
                            onRemove={() => setData('back_image', null)}
                            error={errors.back_image}
                        />
                    </>
                ) : (
                    <TextField {...bind('reference')} label={t('finance.rentals.payment.reference')} placeholder={t('finance.rentals.payment.referencePlaceholder')} optional className="sm:col-span-2" />
                )}
                <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional rows={2} className="sm:col-span-2" />
            </FieldGroup>
            {isCheque && (
                <Alert>
                    <InfoIcon />
                    <AlertDescription>{t('finance.rentals.payment.chequeHint')}</AlertDescription>
                </Alert>
            )}
            <datalist id="rental-payment-banks">
                {banks.map((bank) => (
                    <option key={bank} value={bank} />
                ))}
            </datalist>
        </ActionDialog>
    );
}

/**
 * The tenant moves out: the day they leave, and any deposit handed back.
 * Rent still owed stays owed after they leave.
 */
export function EndRentalDialog({ rental, currency, refundMethods, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ moved_out_on: todayIso(), deposit_refunded: rental.deposit.held || '', deposit_refund_method: 'cash', note: '' });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: `end-rental-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.rentals.end.title', { name: rental.tenant?.name ?? rental.number })}
            description={t('finance.rentals.end.description')}
            submitLabel={t('finance.rentals.end.submit')}
            processing={processing}
            className="sm:max-w-lg"
            onSubmit={() => {
                form.transform((values) => ({ ...values, deposit_refunded: values.deposit_refunded === '' ? null : values.deposit_refunded, deposit_refund_method: values.deposit_refunded === '' ? null : values.deposit_refund_method }));
                form.post(route('rentals.end', rental.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) });
            }}
        >
            {rental.standing.arrears > 0 && (
                <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{t('finance.rentals.end.arrears', { amount: formatMoney(rental.standing.arrears, currency) })}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <TextField {...bind('moved_out_on')} type="date" label={t('finance.rentals.end.movedOutOn')} min={rental.startDate} className="sm:col-span-2" />
                <MoneyField
                    {...bind('deposit_refunded')}
                    label={t('finance.rentals.end.refund')}
                    currency={currency}
                    description={t('finance.rentals.end.refundHint', { amount: formatMoney(rental.deposit.held, currency) })}
                    optional
                />
                <SelectField
                    {...bind('deposit_refund_method')}
                    label={t('finance.rentals.end.refundMethod')}
                    items={refundMethods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                    disabled={data.deposit_refunded === '' || Number(data.deposit_refunded) === 0}
                />
                <TextareaField {...bind('note')} label={t('finance.rentals.end.note')} optional rows={2} className="sm:col-span-2" />
            </FieldGroup>
        </ActionDialog>
    );
}

/**
 * Void a receipt made by mistake, with why. It stays on record, struck
 * through, and stops counting.
 */
export function VoidReceiptDialog({ payment, currency, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ reason: '' });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('finance.receipts.void.title', { number: payment.number })}
            description={t('finance.receipts.void.description', { amount: formatMoney(payment.amount, currency) })}
            submitLabel={t('finance.receipts.void.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('rental-payments.void', payment.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            <FieldGroup>
                <TextField
                    id="void-receipt-reason"
                    label={t('finance.receipts.void.reason')}
                    placeholder={t('finance.receipts.void.reasonPlaceholder')}
                    value={form.data.reason}
                    onChange={(value) => form.setData('reason', value)}
                    error={form.errors.reason}
                />
            </FieldGroup>
        </ActionDialog>
    );
}
