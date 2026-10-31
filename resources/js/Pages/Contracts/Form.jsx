import ChequeScheduleFields, { ChequePlanCard, TermPicker } from '@/Components/ChequeScheduleFields';
import { ChoiceField, FormSection, MoneyField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { chequePayload, emptyChequeEntry, initialChequeEntries, planContractCheques, scheduleRows } from '@/lib/cheques';
import { Head, Link, useForm } from '@inertiajs/react';
import { DetailList } from '@/Components/DetailCards';
import { ContractStatusBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import { CircleAlertIcon, FilePlusIcon } from 'lucide-react';
import { useState } from 'react';
import DocumentFields from '../Properties/Partials/DocumentFields';
import ClientPicker, { emptyClient } from './Partials/ClientPicker';
import RentedSummary from './Partials/RentedSummary';
import { shareRent, standardTotal } from './Partials/rent';
import UnitPicker from './Partials/UnitPicker';

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };

const emptyDocument = () => ({
    id: null,
    document_type: 'signed_contract',
    title: '',
    document_number: '',
    issued_on: '',
    expires_on: '',
    notes: '',
    file: null,
    file_url: null,
});

/**
 * Line dates equal to the contract's are left blank so they keep following
 * the contract when its dates change; they are filled back in on save.
 */
function initialData(contract, clientId, clients) {
    const client = {
        client_mode: contract || clientId || clients.length > 0 ? 'existing' : 'new',
        new_client: emptyClient(),
    };

    if (!contract) {
        return {
            ...client,
            client_id: clientId,
            ejari_number: '',
            start_date: '',
            end_date: '',
            billing_cycle: 'monthly',
            payment_terms_days: 7,
            security_deposit: '',
            monthly_rent: '',
            signed_on: '',
            notes: '',
            lines: [],
            documents: [],
            cheques: {},
        };
    }

    const lines = contract.lines.map((line) => ({
        ...line,
        start_date: line.start_date === contract.start_date ? '' : line.start_date,
        end_date: line.end_date === contract.end_date ? '' : line.end_date,
        description: line.description ?? '',
    }));

    return {
        ...client,
        client_id: contract.client_id,
        ejari_number: contract.ejari_number ?? '',
        start_date: contract.start_date,
        end_date: contract.end_date,
        billing_cycle: contract.billing_cycle,
        payment_terms_days: contract.payment_terms_days,
        security_deposit: contract.security_deposit ?? '',
        monthly_rent: contract.monthly_rent,
        signed_on: contract.signed_on ?? '',
        notes: contract.notes ?? '',
        lines,
        cheques: initialChequeEntries(
            contract.cheques,
            planContractCheques({ start_date: contract.start_date, end_date: contract.end_date, billing_cycle: contract.billing_cycle, security_deposit: contract.security_deposit, lines }),
        ),
        documents: contract.documents.map((document) => ({
            ...emptyDocument(),
            ...Object.fromEntries(Object.entries(document).map(([key, value]) => [key, value ?? ''])),
            id: document.id,
            file_url: document.file_url,
        })),
    };
}

/**
 * The contract being edited at a glance: its number and status, the client
 * with their contact details, who is staying and what is owed.
 */
function ContractOverview({ contract, currency }) {
    const { t, formatMoney } = useTranslation();
    const { client } = contract;

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle className="flex flex-wrap items-center gap-2">
                    {contract.contract_number}
                    <ContractStatusBadge status={contract.status} />
                </CardTitle>
                <CardDescription>{t('leasing.contracts.form.overview.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <DetailList
                    columns={3}
                    rows={[
                        {
                            label: t('leasing.contracts.form.fields.client'),
                            value: (
                                <span className="flex flex-wrap items-center gap-2">
                                    <Link href={route('clients.show', client.id)} className="text-brand-ink hover:underline" dir="auto">
                                        {client.name}
                                    </Link>
                                    <PartyTypeBadge type={client.client_type} />
                                </span>
                            ),
                        },
                        { label: t('leasing.clients.form.fields.contactPerson'), value: client.contact_person_name },
                        { label: t('leasing.clients.form.fields.phone'), value: client.phone },
                        { label: t('leasing.clients.form.fields.email'), value: client.email },
                        client.client_type === 'company'
                            ? { label: t('leasing.clients.form.fields.tradeLicense'), value: client.trade_license_number }
                            : { label: t(`leasing.idTypes.${client.id_type ?? 'passport'}`), value: client.id_number },
                        { label: t('leasing.contracts.form.overview.staying'), value: t('leasing.contracts.form.overview.people', { count: contract.staying }) },
                        { label: t('leasing.contracts.form.overview.balance'), value: formatMoney(contract.balance, currency) },
                    ]}
                />
            </CardContent>
        </Card>
    );
}

/**
 * What the contract comes to, from its rent shared between its lines.
 */
function Summary({ data, lines, currency }) {
    const { t, formatMoney } = useTranslation();
    const monthly = lines.reduce((sum, line) => sum + (Number(line.monthly_rate) || 0), 0);
    const vat = lines.reduce((sum, line) => sum + ((Number(line.monthly_rate) || 0) * (Number(line.vat_rate) || 0)) / 100, 0);
    const months = CYCLE_MONTHS[data.billing_cycle] ?? 1;

    const rows = [
        { label: t('leasing.contracts.form.summary.monthly'), value: formatMoney(monthly, currency) },
        { label: t('leasing.contracts.form.summary.vat'), value: formatMoney(vat, currency) },
        { label: t('leasing.contracts.form.summary.perInvoice', { cycle: t(`leasing.billingCycles.${data.billing_cycle}`) }), value: formatMoney((monthly + vat) * months, currency), strong: true },
        { label: t('leasing.common.securityDeposit'), value: formatMoney(Number(data.security_deposit) || 0, currency) },
    ];

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('leasing.contracts.form.summary.title')}</CardTitle>
                <CardDescription>{t('leasing.contracts.form.summary.description')}</CardDescription>
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
            </CardContent>
        </Card>
    );
}

export default function Form({ contract, clientId, currency, clients, clientTypes, idTypes, documentTypes, properties, billingCycles, banks }) {
    const { t, formatMoney } = useTranslation();
    const isEditing = contract !== null;
    const form = useForm(initialData(contract, clientId, clients));
    const { data, setData, errors, processing } = form;
    // The rent follows the chosen units' standard rent until it is typed.
    const [rentTyped, setRentTyped] = useState(isEditing);
    const isKept = Boolean(contract?.hasLockedCheques);
    const pricedLines = (values) => shareRent(values.lines, values.monthly_rent, properties);
    const chequeRows = (values) => scheduleRows(planContractCheques({ ...values, lines: pricedLines(values) }), values.cheques, contract?.cheques ?? [], isKept);
    const rows = chequeRows(data);
    const standard = standardTotal(data.lines, properties);
    const cycleMonths = CYCLE_MONTHS[data.billing_cycle] ?? 1;
    const monthlyRent = Number(data.monthly_rent) || 0;
    const linesError = errors.lines ?? errors.status ?? Object.entries(errors).find(([key]) => key.startsWith('lines.'))?.[1];
    const patchCheque = (key, patch) =>
        setData((current) => ({ ...current, cheques: { ...current.cheques, [key]: { ...(current.cheques[key] ?? emptyChequeEntry()), ...patch } } }));
    const title = isEditing ? t('leasing.contracts.form.editTitle', { number: contract.contract_number }) : t('leasing.contracts.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const changeLines = (lines) =>
        setData((current) => ({ ...current, lines, monthly_rent: rentTyped ? current.monthly_rent : (standardTotal(lines, properties) ?? current.monthly_rent) }));

    const applyStandardRent = () => {
        setRentTyped(false);
        setData('monthly_rent', standard);
    };

    const updateDocument = (index, field, value) =>
        setData('documents', data.documents.map((document, position) => (position === index ? { ...document, [field]: value } : document)));

    const submit = () => {
        form.transform((values) => ({
            ...values,
            lines: values.lines.map((line) => ({
                id: line.id,
                unit_type: line.unit_type,
                property_id: line.property_id,
                room_id: line.room_id,
                apartment_id: line.apartment_id,
                shop_id: line.shop_id,
                start_date: line.start_date || values.start_date,
                end_date: line.end_date || values.end_date,
            })),
            cheques: chequePayload(chequeRows(values)),
            ...(isEditing ? { _method: 'put' } : {}),
        }));

        form.post(isEditing ? route('contracts.update', contract.id) : route('contracts.store'), { preserveScroll: true, forceFormData: true });
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('leasing.contracts.title'), href: route('contracts.index') }, { label: isEditing ? contract.contract_number : title }]}
                title={title}
                description={isEditing && contract.status === 'active' ? t('leasing.contracts.form.activeDescription') : t('leasing.contracts.form.description')}
                cancelHref={isEditing ? route('contracts.show', contract.id) : route('contracts.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.contracts.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={
                    <>
                        <RentedSummary
                            lines={data.lines}
                            properties={properties}
                            clientName={data.client_mode === 'new' ? data.new_client.name : clients.find((client) => client.id === data.client_id)?.name}
                        />
                        <Summary data={data} lines={pricedLines(data)} currency={currency} />
                        <ChequePlanCard rows={rows} startDate={data.start_date} endDate={data.end_date} perYear={12 / cycleMonths} currency={currency} />
                    </>
                }
            >
                {isEditing && <ContractOverview contract={contract} currency={currency} />}

                {linesError && (
                    <Alert variant="destructive">
                        <CircleAlertIcon />
                        <AlertDescription>{linesError}</AlertDescription>
                    </Alert>
                )}

                <FormSection title={t('leasing.contracts.form.client.title')} description={t('leasing.contracts.form.client.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ClientPicker clients={clients} clientTypes={clientTypes} idTypes={idTypes} data={data} setData={setData} errors={errors} />
                        <TextField {...bind('ejari_number')} label={t('leasing.common.ejariNumber')} optional />
                        <TextField {...bind('signed_on')} type="date" label={t('leasing.contracts.form.fields.signedOn')} optional />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.contracts.form.terms.title')} description={t('leasing.contracts.form.terms.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} type="date" label={t('leasing.common.startDate')} />
                        <TextField {...bind('end_date')} type="date" label={t('leasing.common.endDate')} />
                        <TermPicker startDate={data.start_date} endDate={data.end_date} onChange={(value) => setData('end_date', value)} />
                        <ChoiceField
                            id="billing_cycle"
                            label={t('leasing.contracts.form.fields.billingCycle')}
                            value={data.billing_cycle}
                            onChange={(value) => setData('billing_cycle', value)}
                            options={billingCycles.map((cycle) => ({ value: cycle, label: t(`leasing.billingCycles.${cycle}`) }))}
                            description={t('leasing.cheques.perYearHint', { count: 12 / (CYCLE_MONTHS[data.billing_cycle] ?? 1) })}
                            error={errors.billing_cycle}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('payment_terms_days')}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            label={t('leasing.contracts.form.fields.paymentTerms')}
                            description={t('leasing.contracts.form.paymentTermsHint')}
                        />
                        <MoneyField {...bind('security_deposit')} label={t('leasing.common.securityDeposit')} currency={currency} optional description={t('leasing.contracts.form.depositHint')} />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.contracts.form.picker.title')} description={t('leasing.contracts.form.picker.description')}>
                    <div className="flex flex-col gap-4">
                        <UnitPicker properties={properties} lines={data.lines} onChange={changeLines} currency={currency} />
                    </div>
                </FormSection>

                <FormSection title={t('leasing.contracts.form.rent.title')} description={t('leasing.contracts.form.rent.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <MoneyField
                            id="monthly_rent"
                            label={t('leasing.contracts.form.rent.field')}
                            currency={currency}
                            suffix={t('leasing.common.perMonth')}
                            value={data.monthly_rent}
                            onChange={(value) => {
                                setRentTyped(true);
                                setData('monthly_rent', value);
                            }}
                            error={errors.monthly_rent}
                            description={
                                data.lines.length === 0
                                    ? t('leasing.contracts.form.rent.noUnits')
                                    : [
                                          t('leasing.contracts.form.rent.forUnits', { count: data.lines.length }),
                                          standard !== null && t('leasing.contracts.form.rent.standard', { amount: formatMoney(standard, currency) }),
                                      ]
                                          .filter(Boolean)
                                          .join(' ')
                            }
                        />
                        <dl className="flex flex-col justify-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">{t('leasing.contracts.form.rent.perYear')}</dt>
                                <dd className="font-semibold tabular-nums">{formatMoney(monthlyRent * 12, currency)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">
                                    {t('leasing.contracts.form.rent.perCheque')} · {t('leasing.contracts.form.rent.cheques', { count: 12 / cycleMonths })}
                                </dt>
                                <dd className="font-semibold tabular-nums">{formatMoney(monthlyRent * cycleMonths, currency)}</dd>
                            </div>
                        </dl>
                        {rentTyped && standard !== null && standard !== monthlyRent && (
                            <Button type="button" variant="outline" size="sm" className="self-start sm:col-span-2" onClick={applyStandardRent}>
                                {t('leasing.contracts.form.rent.useStandard', { amount: formatMoney(standard, currency) })}
                            </Button>
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.cheques.schedule.title')} description={t('leasing.cheques.schedule.formDescription.received')}>
                    <ChequeScheduleFields
                        rows={rows}
                        startDate={data.start_date}
                        endDate={data.end_date}
                        direction="received"
                        enforce={false}
                        optional
                        isKept={isKept}
                        onPatch={patchCheque}
                        errors={errors}
                        currency={currency}
                        banks={banks}
                        hint={t('leasing.contracts.form.chequesHint')}
                    />
                </FormSection>

                <FormSection
                    title={t('leasing.contracts.form.documents.title')}
                    description={t('leasing.contracts.form.documents.description')}
                    action={
                        <Button type="button" variant="outline" size="sm" onClick={() => setData('documents', [...data.documents, emptyDocument()])}>
                            <FilePlusIcon data-icon="inline-start" />
                            {t('propertyForm.documents.add')}
                        </Button>
                    }
                >
                    {data.documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('leasing.contracts.form.documents.empty')}</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {data.documents.map((document, index) => (
                                <DocumentFields
                                    key={document.id ?? `new-${index}`}
                                    index={index}
                                    document={document}
                                    documentTypes={documentTypes}
                                    errors={errors}
                                    onChange={(field, value) => updateDocument(index, field, value)}
                                    onRemove={() => setData('documents', data.documents.filter((_, position) => position !== index))}
                                />
                            ))}
                        </div>
                    )}
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
