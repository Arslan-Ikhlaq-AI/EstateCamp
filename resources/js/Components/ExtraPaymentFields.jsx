import { ChoiceField, FormSection, MoneyField, TextField } from '@/Components/FormFields';
import { FieldDescription, FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { BanknoteIcon, ClockIcon, ScrollTextIcon } from 'lucide-react';

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * How a saved commission or deposit was paid, as the form's choice. Money
 * that came another way, as older records did, has no choice and stays as it is.
 */
function paymentChoice(record) {
    if (!record) {
        return 'cash';
    }

    if (record.status === 'pending') {
        return 'later';
    }

    return ['cash', 'cheque'].includes(record.method) ? record.method : null;
}

/**
 * The form values for an agreement's commission and deposit, from what is
 * saved. Cancelled ones start as nothing has been chosen, so saving leaves
 * them alone.
 */
export function extraPaymentValues(commission = null, deposit = null) {
    const chequeValues = (prefix, record) => ({
        [`${prefix}_cheque_number`]: record?.chequeNumber ?? '',
        [`${prefix}_bank_name`]: record?.bankName ?? '',
        [`${prefix}_cheque_date`]: record?.chequeDate ?? todayIso(),
    });
    const isPercentage = commission && commission.rate !== null;

    return {
        commission_type: commission ? (isPercentage ? 'percentage' : 'amount') : 'none',
        commission_rate: commission?.rate ?? '',
        commission_amount: commission && !isPercentage ? commission.amount : '',
        commission_payment: paymentChoice(commission),
        ...chequeValues('commission', commission),
        deposit_payment: paymentChoice(deposit),
        ...chequeValues('deposit', deposit),
    };
}

/**
 * Cash, a cheque with its details, or not paid yet.
 */
function PaymentChoice({ prefix, label, data, setData, errors, banksId }) {
    const { t } = useTranslation();
    const field = (name) => `${prefix}_${name}`;
    const bind = (name) => ({ id: field(name), value: data[field(name)], onChange: (value) => setData(field(name), value), error: errors[field(name)] });

    return (
        <>
            <ChoiceField
                {...bind('payment')}
                label={label}
                className="sm:col-span-2"
                options={[
                    { value: 'cash', label: t('extraPayments.payment.cash'), icon: BanknoteIcon },
                    { value: 'cheque', label: t('extraPayments.payment.cheque'), icon: ScrollTextIcon },
                    { value: 'later', label: t('extraPayments.payment.later'), icon: ClockIcon },
                ]}
            />
            {data[field('payment')] === 'cheque' && (
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                    <TextField {...bind('cheque_number')} label={t('extraPayments.payment.chequeNumber')} />
                    <TextField {...bind('bank_name')} label={t('extraPayments.payment.bank')} list={banksId} />
                    <TextField {...bind('cheque_date')} type="date" label={t('extraPayments.payment.chequeDate')} />
                </div>
            )}
        </>
    );
}

/**
 * The commission and security deposit on a contract or rental form. A
 * commission is a percentage of `commissionBase`, shown as it is worked
 * out, or an exact amount; each is paid by cash or cheque or left for
 * later. `baseKey` says what the base is: `onContract` or `onRental`.
 * `commission` and `deposit` are what is saved, when editing.
 */
export default function ExtraPaymentFields({ data, setData, errors, currency, commissionBase, baseKey, banks = [], commission = null, deposit = null }) {
    const { t, formatMoney } = useTranslation();
    const type = data.commission_type;
    const hasCommission = type !== 'none';
    const hasDeposit = Number(data.security_deposit) > 0;
    const worked = round2((commissionBase * Number(data.commission_rate)) / 100);
    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <FormSection title={t('extraPayments.form.title')} description={t('extraPayments.form.description')}>
            <datalist id="extra-payment-banks">
                {banks.map((bank) => (
                    <option key={bank} value={bank} />
                ))}
            </datalist>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <ChoiceField
                    {...bind('commission_type')}
                    label={t('extraPayments.form.commission.label')}
                    className="sm:col-span-2"
                    options={['none', 'percentage', 'amount'].map((value) => ({ value, label: t(`extraPayments.form.commission.${value}`) }))}
                />
                {type === 'percentage' && (
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <TextField {...bind('commission_rate')} type="number" min="0" max="100" step="0.01" inputMode="decimal" label={t('extraPayments.form.commission.rate')} className="sm:max-w-40" />
                        <FieldDescription>
                            {commissionBase > 0
                                ? t(`extraPayments.form.commission.${baseKey}`, { base: formatMoney(commissionBase, currency), amount: formatMoney(worked, currency) })
                                : t('extraPayments.form.commission.noBase')}
                        </FieldDescription>
                    </div>
                )}
                {type === 'amount' && <MoneyField {...bind('commission_amount')} label={t('extraPayments.form.commission.exact')} currency={currency} className="sm:col-span-2 sm:max-w-64" />}
                {hasCommission && <PaymentChoice prefix="commission" label={t('extraPayments.payment.label')} data={data} setData={setData} errors={errors} banksId="extra-payment-banks" />}
                {commission?.settled > 0 && (
                    <FieldDescription className="sm:col-span-2">{t('extraPayments.form.settled', { amount: formatMoney(commission.settled, currency) })}</FieldDescription>
                )}

                <Separator className="sm:col-span-2" />

                <MoneyField {...bind('security_deposit')} optional label={t('extraPayments.show.deposit')} currency={currency} className="sm:col-span-2 sm:max-w-64" />
                {hasDeposit && <PaymentChoice prefix="deposit" label={t('extraPayments.form.deposit.paidBy')} data={data} setData={setData} errors={errors} banksId="extra-payment-banks" />}
                {deposit?.settled > 0 && <FieldDescription className="sm:col-span-2">{t('extraPayments.form.settled', { amount: formatMoney(deposit.settled, currency) })}</FieldDescription>}
            </FieldGroup>
        </FormSection>
    );
}
