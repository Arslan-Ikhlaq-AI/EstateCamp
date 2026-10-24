import ActionDialog from '@/Components/ActionDialog';
import { SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { FieldGroup } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { useForm } from '@inertiajs/react';
import { CircleCheckIcon } from 'lucide-react';
import CostFields, { costValues } from './CostFields';
import { useLookupNames } from '@/Components/MaintenanceBadges';

/**
 * Move a job to another status, on a given day, with a note. Choosing a
 * finished status asks for the amount charged and the invoice (prefilled
 * from what the job already has).
 */
export default function StatusChangeDialog({ job, statuses, paymentMethods, currency, open, onOpenChange }) {
    const { t } = useTranslation();
    const { statusName } = useLookupNames();
    const choices = statuses.filter((status) => status.id !== job.status.id);
    const next = choices.find((status) => status.stage !== 'cancelled' && statuses.indexOf(status) > statuses.findIndex((status) => status.id === job.status.id));
    const form = useForm({
        maintenance_status_id: next?.id ?? null,
        changed_on: todayIso(),
        note: '',
        ...costValues({ amount: job.amount, payment_method: job.payment_method, paid_on: job.paidOn, invoice_number: job.invoice_number }),
    });
    const { data, setData, errors, processing } = form;
    const chosen = statuses.find((status) => status.id === data.maintenance_status_id);
    const isFinishing = chosen?.stage === 'completed';

    const submit = () => {
        form.transform((values) => {
            if (isFinishing) {
                return values;
            }

            const { maintenance_status_id, changed_on, note } = values;

            return { maintenance_status_id, changed_on, note };
        });
        form.post(route('maintenance.status', job.id), { forceFormData: true, preserveScroll: true, onSuccess: () => onOpenChange(false) });
    };

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('maintenance.statusDialog.title', { number: job.number })}
            description={t('maintenance.statusDialog.description')}
            submitLabel={t('maintenance.statusDialog.submit')}
            processing={processing}
            className="max-h-[92dvh] overflow-y-auto sm:max-w-xl"
            onSubmit={submit}
        >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    id="status-change-status"
                    label={t('maintenance.statusDialog.status')}
                    placeholder={t('maintenance.statusDialog.chooseStatus')}
                    value={data.maintenance_status_id}
                    onChange={(value) => setData('maintenance_status_id', value)}
                    items={choices.map((status) => ({ value: status.id, label: statusName(status) }))}
                    error={errors.maintenance_status_id}
                />
                <TextField
                    id="status-change-date"
                    type="date"
                    label={t('maintenance.statusDialog.date')}
                    value={data.changed_on}
                    onChange={(value) => setData('changed_on', value)}
                    error={errors.changed_on}
                    min={job.reportedOn}
                    max={todayIso()}
                />
                <TextareaField
                    id="status-change-note"
                    label={t('maintenance.statusDialog.note')}
                    value={data.note}
                    onChange={(value) => setData('note', value)}
                    error={errors.note}
                    rows={2}
                    optional
                    className="sm:col-span-2"
                />
            </FieldGroup>

            {isFinishing && (
                <div className="flex flex-col gap-4 rounded-xl bg-success/[0.05] p-4 ring-1 ring-success/20">
                    <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-success">
                        <CircleCheckIcon className="size-4 shrink-0" />
                        {t('maintenance.statusDialog.finished')}
                    </p>
                    <CostFields
                        idPrefix="status-change"
                        data={data}
                        setData={setData}
                        errors={errors}
                        currency={currency}
                        paymentMethods={paymentMethods}
                        invoice={job.invoiceUrl ? { url: job.invoiceUrl, name: job.invoice_name } : null}
                        required
                    />
                </div>
            )}
        </ActionDialog>
    );
}
