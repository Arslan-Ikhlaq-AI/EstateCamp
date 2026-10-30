import { ExtraIncomeStatusBadge } from '@/Components/FinanceBadges';
import { FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { InvoiceInput } from '../Maintenance/Partials/CostFields';

const initialValues = (income, defaults, properties) => ({
    property_id: income?.property_id ?? defaults.property_id ?? (properties.length === 1 ? properties[0].id : null),
    title: income?.title ?? '',
    received_from: income?.received_from ?? '',
    amount: income?.amount ?? '',
    received_on: income?.received_on ?? todayIso(),
    method: income?.method ?? 'bank_transfer',
    invoice_number: income?.invoice_number ?? '',
    notes: income?.notes ?? '',
    invoice: null,
    remove_invoice: false,
    from_payments: defaults.from_payments,
});

/**
 * Add extra income for a property, or correct it: who paid, what for,
 * how much, the day and how it was received, with the invoice. It is
 * always saved as received. Opened from a property's payments, saving
 * goes back there; otherwise to the extra income list.
 */
export default function Form({ income, defaults, properties, methods, currency }) {
    const { t } = useTranslation();
    const isEditing = income !== null;
    const form = useForm(initialValues(income, defaults, properties));
    const { data, setData, errors, processing } = form;
    const home = defaults.from_payments ? properties.find((option) => option.id === (income?.property_id ?? defaults.property_id)) : null;
    const listHref = home ? route('properties.payments', home.id) : route('extra-incomes.index');
    const title = isEditing ? t('finance.extraIncome.form.editTitle', { number: income.number }) : t('finance.extraIncome.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => {
        if (isEditing) {
            form.transform((values) => ({ ...values, _method: 'put' }));
            form.post(route('extra-incomes.update', income.id), { forceFormData: true });
        } else {
            form.post(route('extra-incomes.store'), { forceFormData: true });
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={
                    home
                        ? [
                              { label: t('properties.title'), href: route('properties.index') },
                              { label: home.name, href: route('properties.show', home.id) },
                              { label: t('propertyPayments.title'), href: listHref },
                              { label: isEditing ? income.number : title },
                          ]
                        : [{ label: t('nav.payments') }, { label: t('finance.extraIncome.title'), href: listHref }, { label: isEditing ? income.number : title }]
                }
                title={title}
                description={t('finance.extraIncome.form.description')}
                cancelHref={listHref}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('finance.extraIncome.form.save')}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('finance.extraIncome.form.what.title')} description={t('finance.extraIncome.form.what.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('property_id')}
                            label={t('finance.extraIncome.form.fields.property')}
                            placeholder={t('finance.extraIncome.form.fields.chooseProperty')}
                            items={properties.map((option) => ({ value: option.id, label: `${option.name} · ${option.code}` }))}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('received_from')}
                            label={t('finance.extraIncome.form.fields.receivedFrom')}
                            placeholder={t('finance.extraIncome.form.fields.receivedFromPlaceholder')}
                            dir="auto"
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('title')}
                            label={t('finance.extraIncome.form.fields.title')}
                            placeholder={t('finance.extraIncome.form.fields.titlePlaceholder')}
                            dir="auto"
                            className="sm:col-span-2"
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('finance.extraIncome.form.payment.title')} description={t('finance.extraIncome.form.payment.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        {isEditing && (
                            <Field className="sm:col-span-2">
                                <FieldLabel>{t('leasing.common.status')}</FieldLabel>
                                <div className="flex h-9 items-center">
                                    <ExtraIncomeStatusBadge status={income.status} />
                                </div>
                                {income.status === 'cancelled' && <FieldDescription>{t('finance.extraIncome.form.cancelled')}</FieldDescription>}
                            </Field>
                        )}
                        <MoneyField {...bind('amount')} label={t('finance.extraIncome.form.fields.amount')} currency={currency} />
                        <TextField {...bind('received_on')} type="date" max={todayIso()} label={t('finance.extraIncome.form.fields.receivedOn')} />
                        <SelectField
                            {...bind('method')}
                            label={t('finance.extraIncome.form.fields.method')}
                            items={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                        />
                        <TextField
                            {...bind('invoice_number')}
                            label={t('finance.extraIncome.form.fields.invoiceNumber')}
                            placeholder={t('finance.extraIncome.form.fields.invoiceNumberPlaceholder')}
                            optional
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('finance.extraIncome.form.invoice.title')} description={t('finance.extraIncome.form.invoice.description')}>
                    <FieldGroup className="grid gap-4">
                        <InvoiceInput
                            id="invoice"
                            label={t('finance.extraIncome.form.fields.invoice')}
                            file={data.invoice}
                            url={income?.invoice_url}
                            name={income?.invoice_name}
                            removed={data.remove_invoice}
                            onFile={(file) => setData((current) => ({ ...current, invoice: file, remove_invoice: false }))}
                            onRemove={() => setData((current) => ({ ...current, invoice: null, remove_invoice: Boolean(income?.invoice_url) }))}
                            error={errors.invoice}
                            addText={t('finance.extraIncome.form.fields.addInvoice')}
                            viewText={t('finance.extraIncome.form.fields.viewInvoice')}
                        />
                        <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional rows={3} />
                    </FieldGroup>
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
