import ActionDialog from '@/Components/ActionDialog';
import { ChoiceField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';

/**
 * Record what happened to one instalment owed to a landlord: paid (with the
 * date and cheque or transfer details), bounced, cancelled, or back to
 * scheduled. Mount it with `key={payment.id}` so it starts fresh per row.
 */
export default function RecordInstalmentDialog({ payment, open, onOpenChange, statuses, methods, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const form = useForm({
        status: payment.status === 'scheduled' ? 'paid' : payment.status,
        paid_on: payment.paidOn ?? todayIso(),
        payment_method: payment.method,
        cheque_number: payment.chequeNumber ?? '',
        bank_name: payment.bankName ?? '',
        reference: payment.reference ?? '',
        notes: payment.notes ?? '',
    });
    const { data, setData, errors, processing } = form;

    const bind = (field) => ({ id: `instalment-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.landlordPayments.dialog.title', { number: payment.installmentNumber, lease: payment.lease.number })}
            description={t('leasing.landlordPayments.dialog.description', {
                amount: formatMoney(payment.amount, currency),
                date: formatDate(payment.dueDate),
            })}
            submitLabel={t('leasing.landlordPayments.dialog.save')}
            processing={processing}
            onSubmit={() =>
                form.patch(route('landlord-payments.update', payment.id), {
                    preserveScroll: true,
                    onSuccess: () => onOpenChange(false),
                })
            }
        >
            <FieldGroup className="grid gap-4">
                <ChoiceField
                    id="instalment-status"
                    label={t('leasing.landlordPayments.dialog.status')}
                    value={data.status}
                    onChange={(value) => setData('status', value)}
                    options={statuses.map((status) => ({ value: status, label: t(`leasing.status.instalment.${status}`) }))}
                    error={errors.status}
                />
                {data.status === 'paid' && <TextField {...bind('paid_on')} type="date" label={t('leasing.landlordPayments.dialog.paidOn')} max={todayIso()} />}
                <SelectField
                    {...bind('payment_method')}
                    label={t('leasing.landlordPayments.dialog.method')}
                    items={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                />
                {data.payment_method === 'cheque' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('cheque_number')} label={t('leasing.common.chequeNumber')} inputClassName="font-mono" />
                        <TextField {...bind('bank_name')} label={t('leasing.common.bank')} optional />
                    </div>
                )}
                <TextField {...bind('reference')} label={t('leasing.common.reference')} optional />
                <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional rows={2} />
            </FieldGroup>
        </ActionDialog>
    );
}
