import ActionDialog from '@/Components/ActionDialog';
import { MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';

// A payment method left to each person's usual one, when paying a whole month.
const EACH = 'each';

const amount = (value) => Number.parseFloat(value) || 0;

/**
 * Add a bonus or overtime, or take off an advance or a fine, with the net
 * pay worked out as the figures change.
 */
export function AdjustDialog({ salary, currency, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const form = useForm({ additions: salary.additions || '', deductions: salary.deductions || '', note: salary.note ?? '' });
    const { data, setData, errors, processing } = form;
    const net = Math.max(0, salary.earned - salary.absenceDeduction + amount(data.additions) - amount(data.deductions));
    const lines = [
        [t('staff.payroll.adjust.earned', { payable: salary.payableDays, total: salary.daysInMonth }), salary.earned, null],
        [t('staff.payroll.adjust.absences'), salary.absenceDeduction, '−'],
        [t('staff.payroll.adjust.additions'), amount(data.additions), '+'],
        [t('staff.payroll.adjust.deductions'), amount(data.deductions), '−'],
    ];

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('staff.payroll.adjust.title', { name: salary.staff.name })}
            description={t('staff.payroll.adjust.description')}
            submitLabel={t('staff.payroll.adjust.save')}
            processing={processing}
            onSubmit={() => form.put(route('payroll.update', salary.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        >
            {errors.salary && (
                <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{errors.salary}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                    id="adjust-additions"
                    label={t('staff.payroll.adjust.additions')}
                    value={data.additions}
                    onChange={(value) => setData('additions', value)}
                    currency={currency}
                    placeholder="0"
                    description={t('staff.payroll.adjust.additionsHint')}
                    error={errors.additions}
                />
                <MoneyField
                    id="adjust-deductions"
                    label={t('staff.payroll.adjust.deductions')}
                    value={data.deductions}
                    onChange={(value) => setData('deductions', value)}
                    currency={currency}
                    placeholder="0"
                    description={t('staff.payroll.adjust.deductionsHint')}
                    error={errors.deductions}
                />
                <TextareaField
                    id="adjust-note"
                    label={t('staff.payroll.adjust.note')}
                    value={data.note}
                    onChange={(value) => setData('note', value)}
                    error={errors.note}
                    rows={2}
                    optional
                    className="sm:col-span-2"
                />
            </FieldGroup>
            <dl className="flex flex-col gap-1.5 rounded-xl bg-brand-cyan/[0.06] p-4 text-sm ring-1 ring-brand-cyan/15">
                {lines.map(([label, value, sign]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="tabular-nums">
                            {sign && value > 0 && <span className="text-muted-foreground">{sign} </span>}
                            {formatMoney(value, currency)}
                        </dd>
                    </div>
                ))}
                <div className="mt-1 flex items-center justify-between gap-3 border-t border-brand-cyan/15 pt-2.5">
                    <dt className="font-medium">{t('staff.payroll.adjust.net')}</dt>
                    <dd className="font-heading text-lg font-bold tabular-nums">{formatMoney(net, currency)}</dd>
                </div>
            </dl>
        </ActionDialog>
    );
}

/**
 * Record one salary as paid (`salary`), or every salary still to pay in
 * `month` (`salary` null), on a day, by a method, with a reference.
 */
export function PayDialog({ salary, month, monthName, pending, currency, paymentMethods, open, onOpenChange }) {
    const { t, formatMoney } = useTranslation();
    const isAll = salary === null;
    const form = useForm({ paid_on: todayIso(), payment_method: isAll ? EACH : (salary.staff.paymentMethod ?? paymentMethods[0]), reference: '' });
    const { data, setData, errors, processing } = form;
    const methods = paymentMethods.map((method) => ({ value: method, label: t(`staff.paymentMethods.${method}`) }));

    const submit = () => {
        form.transform((values) => ({ ...values, payment_method: values.payment_method === EACH ? null : values.payment_method, ...(isAll ? { month } : {}) }));
        form.post(isAll ? route('payroll.pay-all') : route('payroll.pay', salary.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) });
    };

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={isAll ? t('staff.payroll.pay.titleAll', { month: monthName }) : t('staff.payroll.pay.title', { name: salary.staff.name })}
            description={
                isAll
                    ? t('staff.payroll.pay.descriptionAll', { count: pending.count, amount: formatMoney(pending.amount, currency) })
                    : t('staff.payroll.pay.description', { amount: formatMoney(salary.netPay, currency) })
            }
            submitLabel={t('staff.payroll.pay.submit')}
            processing={processing}
            onSubmit={submit}
        >
            {errors.salary && (
                <Alert variant="destructive">
                    <CircleAlertIcon />
                    <AlertDescription>{errors.salary}</AlertDescription>
                </Alert>
            )}
            <FieldGroup className={cn('grid gap-4', !isAll && 'sm:grid-cols-2')}>
                <TextField
                    id="pay-date"
                    type="date"
                    label={t('staff.payroll.pay.paidOn')}
                    value={data.paid_on}
                    onChange={(value) => setData('paid_on', value)}
                    max={todayIso()}
                    error={errors.paid_on}
                />
                <SelectField
                    id="pay-method"
                    label={t('staff.payroll.pay.method')}
                    value={data.payment_method}
                    onChange={(value) => setData('payment_method', value)}
                    items={isAll ? [{ value: EACH, label: t('staff.payroll.pay.methodEach') }, ...methods] : methods}
                    error={errors.payment_method}
                />
                <TextField
                    id="pay-reference"
                    label={t('staff.payroll.pay.reference')}
                    placeholder={t('staff.payroll.pay.referencePlaceholder')}
                    value={data.reference}
                    onChange={(value) => setData('reference', value)}
                    error={errors.reference}
                    optional
                    className={cn(!isAll && 'sm:col-span-2')}
                />
            </FieldGroup>
        </ActionDialog>
    );
}
