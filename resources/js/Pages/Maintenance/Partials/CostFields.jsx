import { MoneyField, SelectField, TextField } from '@/Components/FormFields';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { FileTextIcon, RefreshCwIcon, UploadIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';

/**
 * The form values CostFields edits, from a stored job (or blank).
 */
export const costValues = (job = null) => ({
    amount: job?.amount ?? '',
    payment_method: job?.payment_method ?? null,
    paid_on: job?.paid_on ?? '',
    invoice_number: job?.invoice_number ?? '',
    invoice: null,
    remove_invoice: false,
});

const isPdf = (name) => /\.pdf$/i.test(name ?? '');

/**
 * The invoice: a tile to take or choose a photo, screenshot or PDF, then a
 * preview (or the file name for a PDF) with buttons to replace or remove it.
 * `url` and `name` describe the invoice already on file; `addText` and
 * `viewText` reword it for another kind of file, such as a signed contract.
 */
export function InvoiceInput({ id, label, file, url, name, removed, onFile, onRemove, error, required = false, addText, viewText, className }) {
    const { t } = useTranslation();
    const current = file ? { url: null, name: file.name } : removed || !url ? null : { url, name };
    const preview = useMemo(() => (file && !isPdf(file.name) ? URL.createObjectURL(file) : null), [file]);
    const shownImage = file ? preview : current && !isPdf(current.name) ? current.url : null;

    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <FieldLabel htmlFor={id}>
                {label}
                {!required && <span className="font-normal text-muted-foreground">({t('propertyForm.optional')})</span>}
            </FieldLabel>
            {current ? (
                <div className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-foreground/10">
                    {shownImage ? (
                        <img src={shownImage} alt="" className="size-14 shrink-0 rounded-lg bg-muted object-cover ring-1 ring-foreground/10" />
                    ) : (
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-ink">
                            <FileTextIcon className="size-6" />
                        </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                        {current.url ? (
                            <a href={current.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                {current.name || (viewText ?? t('maintenance.invoice.view'))}
                            </a>
                        ) : (
                            <span className="truncate text-sm font-medium">{current.name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{t('maintenance.invoice.hint')}</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                        <Button variant="outline" size="sm" nativeButton={false} render={<label htmlFor={id} />} className="cursor-pointer">
                            <RefreshCwIcon data-icon="inline-start" />
                            {t('maintenance.invoice.replace')}
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t('maintenance.invoice.remove')}>
                            <XIcon />
                        </Button>
                    </div>
                </div>
            ) : (
                <label
                    htmlFor={id}
                    className={cn(
                        'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-brand-cyan hover:bg-brand-cyan/5 hover:text-brand-ink has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                        error && 'border-destructive text-destructive',
                    )}
                >
                    <UploadIcon className="size-5" />
                    <span className="font-medium">{addText ?? t('maintenance.invoice.add')}</span>
                    <span className="text-xs">{t('maintenance.invoice.hint')}</span>
                </label>
            )}
            <input
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={(event) => {
                    if (event.target.files[0]) {
                        onFile(event.target.files[0]);
                    }

                    event.target.value = '';
                }}
            />
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * What the work cost: the amount charged, how and when it was paid, the
 * invoice number and the invoice. `required` marks the amount and invoice
 * as needed (a finished job); `invoice` is the one on file, if any.
 */
export default function CostFields({ idPrefix, data, setData, errors, currency, paymentMethods, invoice = null, required = false }) {
    const { t } = useTranslation();
    const bind = (field) => ({ id: `${idPrefix}-${field}`, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField {...bind('amount')} label={t('maintenance.form.fields.amount')} currency={currency} optional={!required} />
            <TextField {...bind('invoice_number')} label={t('maintenance.form.fields.invoiceNumber')} optional />
            <SelectField
                {...bind('payment_method')}
                label={t('maintenance.form.fields.paymentMethod')}
                placeholder={t('maintenance.form.fields.choosePaymentMethod')}
                items={paymentMethods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                optional
            />
            <TextField
                {...bind('paid_on')}
                type="date"
                max={todayIso()}
                label={t('maintenance.form.fields.paidOn')}
                description={t('maintenance.form.fields.paidOnHint')}
                optional
            />
            <InvoiceInput
                id={`${idPrefix}-invoice`}
                label={t('maintenance.form.fields.invoice')}
                required={required}
                file={data.invoice}
                url={invoice?.url}
                name={invoice?.name}
                removed={data.remove_invoice}
                onFile={(file) => setData((current) => ({ ...current, invoice: file, remove_invoice: false }))}
                onRemove={() => setData((current) => ({ ...current, invoice: null, remove_invoice: Boolean(invoice?.url) }))}
                error={errors.invoice}
                className="sm:col-span-2"
            />
        </div>
    );
}
