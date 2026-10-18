import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import { InvoiceStatusBadge } from '@/Components/LeasingBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { todayIso, useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BanknoteIcon, CreditCardIcon, LandmarkIcon, ScrollTextIcon, SparklesIcon } from 'lucide-react';
import { useEffect } from 'react';

const METHOD_ICONS = { cash: BanknoteIcon, bank_transfer: LandmarkIcon, cheque: ScrollTextIcon, card: CreditCardIcon };

const round = (value) => Math.round(value * 100) / 100;

function AllocationSummary({ amount, allocated, currency }) {
    const { t, formatMoney } = useTranslation();
    const rows = [
        { label: t('leasing.payments.form.summary.amount'), value: formatMoney(amount, currency) },
        { label: t('leasing.payments.form.summary.allocated'), value: formatMoney(allocated, currency) },
        { label: t('leasing.payments.form.summary.credit'), value: formatMoney(Math.max(0, amount - allocated), currency), strong: true },
    ];

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('leasing.payments.form.summary.title')}</CardTitle>
                <CardDescription>{t('leasing.payments.form.summary.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <dl className="flex flex-col gap-2 text-sm">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                            <dt className="text-muted-foreground">{row.label}</dt>
                            <dd className={row.strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{row.value}</dd>
                        </div>
                    ))}
                </dl>
                {allocated > amount && <p className="mt-3 text-sm text-destructive">{t('leasing.payments.form.overAllocated')}</p>}
            </CardContent>
        </Card>
    );
}

export default function Form({ currency, clients, clientId, invoiceId, openInvoices, methods }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const preselected = openInvoices.find((invoice) => invoice.id === invoiceId);
    const form = useForm({
        client_id: clientId,
        received_on: todayIso(),
        amount: preselected ? preselected.balance : '',
        method: 'bank_transfer',
        status: 'pending',
        reference: '',
        cheque_number: '',
        cheque_date: todayIso(),
        bank_name: '',
        notes: '',
        allocations: preselected ? { [preselected.id]: preselected.balance } : {},
    });
    const { data, setData, errors, processing } = form;
    const amount = Number(data.amount) || 0;
    const allocated = round(Object.values(data.allocations).reduce((sum, value) => sum + (Number(value) || 0), 0));
    const allocatedInvoices = openInvoices.filter((invoice) => Number(data.allocations[invoice.id]) > 0);
    const title = t('leasing.payments.form.title');

    // A newly chosen client brings their own open invoices; earlier allocations no longer apply.
    useEffect(() => {
        setData((values) => ({ ...values, client_id: clientId, allocations: values.client_id === clientId ? values.allocations : {} }));
    }, [clientId]);

    const chooseClient = (id) => router.reload({ data: { client: id }, only: ['clientId', 'invoiceId', 'openInvoices'] });

    // Settle the oldest invoices first, as far as the payment goes.
    const spread = () => {
        let left = amount;
        const allocations = {};

        for (const invoice of openInvoices) {
            const share = round(Math.min(left, invoice.balance));

            if (share > 0) {
                allocations[invoice.id] = share;
                left = round(left - share);
            }
        }

        setData('allocations', allocations);
    };

    const submit = () => {
        form.transform((values) => ({
            ...values,
            status: values.method === 'cheque' ? values.status : null,
            cheque_number: values.method === 'cheque' ? values.cheque_number : null,
            cheque_date: values.method === 'cheque' ? values.cheque_date : null,
            allocations: openInvoices
                .filter((invoice) => Number(values.allocations[invoice.id]) > 0)
                .map((invoice) => ({ invoice_id: invoice.id, amount: values.allocations[invoice.id] })),
        }));

        form.post(route('payments.store'));
    };

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.payments') }, { label: t('leasing.payments.title'), href: route('payments.index') }, { label: title }]}
                title={title}
                description={t('leasing.payments.form.description')}
                cancelHref={route('payments.index')}
                submitLabel={t('leasing.payments.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<AllocationSummary amount={amount} allocated={allocated} currency={currency} />}
            >
                <FormSection title={t('leasing.payments.form.payment.title')} description={t('leasing.payments.form.payment.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            id="client_id"
                            label={t('leasing.invoices.columns.client')}
                            placeholder={t('leasing.contracts.form.fields.chooseClient')}
                            value={data.client_id}
                            onChange={chooseClient}
                            items={clients.map((client) => ({ value: client.id, label: client.name }))}
                            error={errors.client_id}
                            className="sm:col-span-2"
                        />
                        <MoneyField {...bind('amount')} label={t('leasing.common.amount')} currency={currency} />
                        <TextField {...bind('received_on')} type="date" label={t('leasing.payments.form.fields.receivedOn')} max={todayIso()} />
                        <ChoiceField
                            id="method"
                            label={t('leasing.payments.columns.method')}
                            value={data.method}
                            onChange={(value) => setData('method', value)}
                            options={methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`), icon: METHOD_ICONS[method] }))}
                            error={errors.method}
                            className="sm:col-span-2"
                        />
                        {data.method === 'cheque' ? (
                            <>
                                <TextField {...bind('cheque_number')} label={t('leasing.common.chequeNumber')} inputClassName="font-mono" />
                                <TextField {...bind('cheque_date')} type="date" label={t('leasing.payments.form.fields.chequeDate')} />
                                <TextField {...bind('bank_name')} label={t('leasing.common.bank')} optional />
                                <ChoiceField
                                    id="status"
                                    label={t('leasing.payments.form.fields.chequeStatus')}
                                    value={data.status}
                                    onChange={(value) => setData('status', value)}
                                    options={['pending', 'cleared'].map((status) => ({ value: status, label: t(`leasing.status.payment.${status}`) }))}
                                    description={t('leasing.payments.form.chequeHint')}
                                    error={errors.status}
                                />
                            </>
                        ) : (
                            <TextField {...bind('reference')} label={t('leasing.common.reference')} optional className="sm:col-span-2" />
                        )}
                    </FieldGroup>
                </FormSection>

                {data.client_id && (
                    <FormSection
                        title={t('leasing.payments.form.allocations.title')}
                        description={t('leasing.payments.form.allocations.description')}
                        action={
                            openInvoices.length > 0 && (
                                <Button type="button" variant="outline" size="sm" onClick={spread} disabled={amount <= 0}>
                                    <SparklesIcon data-icon="inline-start" />
                                    {t('leasing.payments.form.spread')}
                                </Button>
                            )
                        }
                    >
                        {openInvoices.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('leasing.payments.form.noOpenInvoices')}</p>
                        ) : (
                            <ul className="flex flex-col divide-y">
                                {openInvoices.map((invoice) => {
                                    const index = allocatedInvoices.indexOf(invoice);
                                    const error = index >= 0 ? (errors[`allocations.${index}.amount`] ?? errors[`allocations.${index}.invoice_id`]) : null;

                                    return (
                                        <li key={invoice.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex min-w-0 flex-col gap-0.5">
                                                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                                    <Link href={route('invoices.show', invoice.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                        {invoice.number}
                                                    </Link>
                                                    <InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} />
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {period(invoice.periodStart, invoice.periodEnd)} · {t('leasing.payments.form.dueBalance', { date: formatDate(invoice.dueDate), amount: formatMoney(invoice.balance, currency) })}
                                                </span>
                                                <FieldError>{error}</FieldError>
                                            </div>
                                            <div className="flex items-center gap-2 sm:w-64">
                                                <InputGroup>
                                                    <InputGroupAddon>
                                                        <InputGroupText>{currency}</InputGroupText>
                                                    </InputGroupAddon>
                                                    <InputGroupInput
                                                        type="number"
                                                        inputMode="decimal"
                                                        min={0}
                                                        max={invoice.balance}
                                                        step="0.01"
                                                        aria-label={t('leasing.payments.form.allocationFor', { number: invoice.number })}
                                                        value={data.allocations[invoice.id] ?? ''}
                                                        onChange={(event) => setData('allocations', { ...data.allocations, [invoice.id]: event.target.value })}
                                                        className="tabular-nums"
                                                    />
                                                </InputGroup>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setData('allocations', { ...data.allocations, [invoice.id]: invoice.balance })}
                                                >
                                                    {t('leasing.payments.form.full')}
                                                </Button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </FormSection>
                )}

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={3} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
