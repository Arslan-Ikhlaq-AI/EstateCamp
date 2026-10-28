import { OtherPaymentStatusBadge } from '@/Components/FinanceBadges';
import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, useForm } from '@inertiajs/react';
import { CircleCheckIcon, ClockIcon } from 'lucide-react';
import { InvoiceInput } from '../Maintenance/Partials/CostFields';

const STATUS_ICONS = { paid: CircleCheckIcon, pending: ClockIcon };

const initialValues = (payment, defaults, properties) => ({
    property_id: payment?.property_id ?? defaults?.property_id ?? (properties.length === 1 ? properties[0].id : null),
    ...(payment ? {} : { status: 'paid' }),
    title: payment?.title ?? '',
    paid_to: payment?.paid_to ?? '',
    amount: payment?.amount ?? '',
    payment_date: payment?.payment_date ?? todayIso(),
    method: payment?.method ?? 'cash',
    reference: payment?.reference ?? '',
    notes: payment?.notes ?? '',
    receipt: null,
    remove_receipt: false,
});

/**
 * Add a one-off payment for a property, or correct one: what it was for,
 * who is paid, how much, and whether it is paid now or still to pay, with
 * the day, how and the receipt. Saving goes back to the property's
 * payments, where its status can be changed later.
 */
export default function Form({ payment, defaults, properties, methods, currency }) {
    const { t } = useTranslation();
    const isEditing = payment !== null;
    const form = useForm(initialValues(payment, defaults, properties));
    const { data, setData, errors, processing } = form;
    const isPaid = isEditing ? payment.status === 'paid' : data.status === 'paid';
    const home = properties.find((option) => option.id === (payment?.property_id ?? defaults?.property_id));
    const title = isEditing ? t('finance.otherPayments.form.editTitle', { number: payment.number }) : t('finance.otherPayments.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => {
        if (isEditing) {
            form.transform((values) => ({ ...values, _method: 'put' }));
            form.post(route('other-payments.update', payment.id), { forceFormData: true });
        } else {
            form.post(route('other-payments.store'), { forceFormData: true });
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
                              { label: t('propertyPayments.title'), href: route('properties.payments', { property: home.id, tab: 'out' }) },
                              { label: isEditing ? payment.number : title },
                          ]
                        : [{ label: t('properties.title'), href: route('properties.index') }, { label: title }]
                }
                title={title}
                description={t('finance.otherPayments.form.description')}
                cancelHref={home ? route('properties.payments', { property: home.id, tab: 'out' }) : route('properties.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t(`finance.otherPayments.form.save.${data.status}`)}
                processing={processing}
                onSubmit={submit}
            >
                <FormSection title={t('finance.otherPayments.form.what.title')} description={t('finance.otherPayments.form.what.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('property_id')}
                            label={t('finance.otherPayments.form.fields.property')}
                            placeholder={t('finance.otherPayments.form.fields.chooseProperty')}
                            items={properties.map((option) => ({ value: option.id, label: `${option.name} · ${option.code}` }))}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('title')}
                            label={t('finance.otherPayments.form.fields.title')}
                            placeholder={t('finance.otherPayments.form.fields.titlePlaceholder')}
                            dir="auto"
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('paid_to')}
                            label={t('finance.otherPayments.form.fields.paidTo')}
                            placeholder={t('finance.otherPayments.form.fields.paidToPlaceholder')}
                            dir="auto"
                        />
                        <MoneyField {...bind('amount')} label={t('finance.otherPayments.form.fields.amount')} currency={currency} />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('finance.otherPayments.form.payment.title')} description={t('finance.otherPayments.form.payment.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        {isEditing ? (
                            <Field className="sm:col-span-2">
                                <FieldLabel>{t('finance.otherPayments.form.fields.status')}</FieldLabel>
                                <div className="flex h-9 items-center">
                                    <OtherPaymentStatusBadge status={payment.status} />
                                </div>
                                <FieldDescription>{t('finance.otherPayments.form.fields.statusHint')}</FieldDescription>
                            </Field>
                        ) : (
                            <ChoiceField
                                id="status"
                                label={t('finance.otherPayments.form.fields.status')}
                                value={data.status}
                                onChange={(value) => setData('status', value)}
                                options={['paid', 'pending'].map((status) => ({
                                    value: status,
                                    label: t(`finance.otherPayments.form.when.${status}`),
                                    icon: STATUS_ICONS[status],
                                }))}
                                error={errors.status}
                                className="sm:col-span-2"
                            />
                        )}
                        <TextField
                            {...bind('payment_date')}
                            type="date"
                            max={isPaid ? todayIso() : undefined}
                            label={t(`finance.otherPayments.form.fields.${isPaid ? 'paidOn' : 'dueOn'}`)}
                        />
                        <SelectField
                            {...bind('method')}
                            label={t('finance.otherPayments.form.fields.method')}
                            items={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`) }))}
                            optional={!isPaid}
                        />
                        <TextField
                            {...bind('reference')}
                            label={t('finance.otherPayments.form.fields.reference')}
                            placeholder={t('finance.otherPayments.form.fields.referencePlaceholder')}
                            optional
                            className="sm:col-span-2"
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('finance.otherPayments.form.receipt.title')} description={t('finance.otherPayments.form.receipt.description')}>
                    <FieldGroup className="grid gap-4">
                        <InvoiceInput
                            id="receipt"
                            label={t('finance.otherPayments.form.fields.receipt')}
                            file={data.receipt}
                            url={payment?.receipt_url}
                            name={payment?.receipt_name}
                            removed={data.remove_receipt}
                            onFile={(file) => setData((current) => ({ ...current, receipt: file, remove_receipt: false }))}
                            onRemove={() => setData((current) => ({ ...current, receipt: null, remove_receipt: Boolean(payment?.receipt_url) }))}
                            error={errors.receipt}
                            addText={t('finance.otherPayments.form.fields.addReceipt')}
                            viewText={t('finance.otherPayments.form.fields.viewReceipt')}
                        />
                        <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional rows={3} />
                    </FieldGroup>
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
