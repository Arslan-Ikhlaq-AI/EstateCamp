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
import { Building2Icon, CircleAlertIcon, CylinderIcon, FilePlusIcon, HouseIcon, Trash2Icon } from 'lucide-react';
import DocumentFields from '../Properties/Partials/DocumentFields';
import ClientPicker, { emptyClient } from './Partials/ClientPicker';
import RentedSummary, { groupByProperty, UNIT_ICONS, useDescribeLine } from './Partials/RentedSummary';
import UnitPicker from './Partials/UnitPicker';

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };

/**
 * A new line for a unit chosen in the picker; shops carry 5% VAT.
 */
function newLine(unit) {
    return {
        id: null,
        quantity: 1,
        billing_basis: 'contracted',
        vat_rate: unit.unit_type === 'shop' ? 5 : 0,
        start_date: '',
        end_date: '',
        description: '',
        hasStays: false,
        ...unit,
    };
}

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
            gas_included: true,
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
        gas_included: contract.gas_included,
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
 * One rented unit on the contract: what it is and where, then its rate,
 * VAT, billing basis (for beds), description and dates.
 */
function LineEditor({ index, line, onPatch, onRemove, canRemove, properties, billingBases, errors, currency }) {
    const { t, formatMoney } = useTranslation();
    const { room, label, detail } = useDescribeLine(properties)(line);
    const error = (field) => errors[`lines.${index}.${field}`];
    const monthly = (Number(line.monthly_rate) || 0) * (Number(line.quantity) || 0);
    const Icon = UNIT_ICONS[line.unit_type];
    const unitErrors = ['property_id', 'room_id', 'apartment_id', 'shop_id', 'unit_type'].map(error).filter(Boolean);

    return (
        <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10 motion-safe:animate-enter">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm">
                        <Icon className="size-4.5" />
                    </span>
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-sm font-semibold">{label}</span>
                        <span className="truncate text-xs text-muted-foreground">{detail}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{t('leasing.contracts.form.lineMonthly', { amount: formatMoney(monthly, currency) })}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onRemove}
                        disabled={!canRemove}
                        aria-label={t('leasing.contracts.form.removeLine', { number: index + 1 })}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <Trash2Icon />
                    </Button>
                </div>
            </div>

            {unitErrors.length > 0 && <p className="text-[0.8125rem] text-destructive">{unitErrors[0]}</p>}

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                {line.unit_type === 'bed' && (
                    <TextField
                        id={`lines-${index}-quantity`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={room ? room.capacity - room.contracted : undefined}
                        label={t('leasing.contracts.form.fields.beds')}
                        value={line.quantity}
                        onChange={(value) => onPatch({ quantity: value })}
                        error={error('quantity')}
                        description={room ? t('leasing.contracts.form.roomHasBeds', { count: room.capacity }) : undefined}
                    />
                )}
                <MoneyField
                    id={`lines-${index}-monthly_rate`}
                    label={line.unit_type === 'bed' ? t('leasing.contracts.form.fields.ratePerBed') : t('leasing.contracts.form.fields.rate')}
                    currency={currency}
                    suffix={t('leasing.common.perMonth')}
                    value={line.monthly_rate}
                    onChange={(value) => onPatch({ monthly_rate: value })}
                    error={error('monthly_rate')}
                />
                {line.unit_type === 'bed' && (
                    <ChoiceField
                        id={`lines-${index}-billing_basis`}
                        label={t('leasing.contracts.form.fields.billingBasis')}
                        value={line.billing_basis}
                        onChange={(value) => onPatch({ billing_basis: value })}
                        options={billingBases.map((basis) => ({ value: basis, label: t(`leasing.billingBases.${basis}`) }))}
                        description={t(`leasing.contracts.form.basisHints.${line.billing_basis}`)}
                        error={error('billing_basis')}
                        className="sm:col-span-2"
                    />
                )}
                <TextField
                    id={`lines-${index}-vat_rate`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    label={t('leasing.contracts.form.fields.vat')}
                    value={line.vat_rate}
                    onChange={(value) => onPatch({ vat_rate: value })}
                    error={error('vat_rate')}
                />
                <TextField
                    id={`lines-${index}-description`}
                    label={t('leasing.contracts.form.fields.description')}
                    value={line.description}
                    onChange={(value) => onPatch({ description: value })}
                    error={error('description')}
                    optional
                />
                <TextField
                    id={`lines-${index}-start_date`}
                    type="date"
                    label={t('leasing.contracts.form.fields.lineStart')}
                    value={line.start_date}
                    onChange={(value) => onPatch({ start_date: value })}
                    error={error('start_date')}
                    description={t('leasing.contracts.form.followsContract')}
                    optional
                />
                <TextField
                    id={`lines-${index}-end_date`}
                    type="date"
                    label={t('leasing.contracts.form.fields.lineEnd')}
                    value={line.end_date}
                    onChange={(value) => onPatch({ end_date: value })}
                    error={error('end_date')}
                    description={t('leasing.contracts.form.followsContract')}
                    optional
                />
            </FieldGroup>

            {line.hasStays && <p className="text-xs text-muted-foreground">{t('leasing.contracts.form.hasStays')}</p>}
        </div>
    );
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

function Summary({ data, currency }) {
    const { t, formatMoney } = useTranslation();
    const monthly = data.lines.reduce((sum, line) => sum + (Number(line.monthly_rate) || 0) * (Number(line.quantity) || 0), 0);
    const vat = data.lines.reduce((sum, line) => sum + ((Number(line.monthly_rate) || 0) * (Number(line.quantity) || 0) * (Number(line.vat_rate) || 0)) / 100, 0);
    const months = CYCLE_MONTHS[data.billing_cycle] ?? 1;

    const rows = [
        { label: t('leasing.contracts.form.summary.monthly'), value: formatMoney(monthly, currency) },
        { label: t('leasing.contracts.form.summary.vat'), value: formatMoney(vat, currency) },
        { label: t('leasing.contracts.form.summary.perInvoice', { cycle: t(`leasing.billingCycles.${data.billing_cycle}`) }), value: formatMoney((monthly + vat) * months, currency), strong: true },
        { label: t('leasing.common.securityDeposit'), value: formatMoney(Number(data.security_deposit) || 0, currency) },
        { label: t('leasing.contracts.form.fields.gas'), value: t(`leasing.contracts.form.gasOptions.${data.gas_included ? 'included' : 'billed'}`) },
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

export default function Form({ contract, clientId, currency, clients, clientTypes, idTypes, documentTypes, properties, billingCycles, billingBases, banks }) {
    const { t } = useTranslation();
    const isEditing = contract !== null;
    const form = useForm(initialData(contract, clientId, clients));
    const { data, setData, errors, processing } = form;
    const isKept = Boolean(contract?.hasLockedCheques);
    const chequeRows = (values) => scheduleRows(planContractCheques(values), values.cheques, contract?.cheques ?? [], isKept);
    const rows = chequeRows(data);
    const patchCheque = (key, patch) =>
        setData((current) => ({ ...current, cheques: { ...current.cheques, [key]: { ...(current.cheques[key] ?? emptyChequeEntry()), ...patch } } }));
    const title = isEditing ? t('leasing.contracts.form.editTitle', { number: contract.contract_number }) : t('leasing.contracts.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const patchLine = (index, patch) => setData('lines', data.lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));

    // Another bed in a room already on the contract adds to that line rather than starting a new one.
    const addUnit = (unit) => {
        const sameRoomBeds = unit.unit_type === 'bed' && unit.room_id !== null
            ? data.lines.findIndex((line) => line.unit_type === 'bed' && line.room_id === unit.room_id && !line.hasStays)
            : -1;

        if (sameRoomBeds >= 0) {
            patchLine(sameRoomBeds, { quantity: (Number(data.lines[sameRoomBeds].quantity) || 0) + 1 });
        } else {
            setData('lines', [...data.lines, newLine(unit)]);
        }
    };

    const updateDocument = (index, field, value) =>
        setData('documents', data.documents.map((document, position) => (position === index ? { ...document, [field]: value } : document)));

    const submit = () => {
        form.transform((values) => ({
            ...values,
            lines: values.lines.map(({ hasStays, ...line }) => ({
                ...line,
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
                            currency={currency}
                        />
                        <Summary data={data} currency={currency} />
                        <ChequePlanCard rows={rows} startDate={data.start_date} endDate={data.end_date} perYear={12 / (CYCLE_MONTHS[data.billing_cycle] ?? 1)} currency={currency} />
                    </>
                }
            >
                {isEditing && <ContractOverview contract={contract} currency={currency} />}

                {(errors.lines || errors.status) && (
                    <Alert variant="destructive">
                        <CircleAlertIcon />
                        <AlertDescription>{errors.lines ?? errors.status}</AlertDescription>
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
                        <ChoiceField
                            id="gas_included"
                            label={t('leasing.contracts.form.fields.gas')}
                            value={data.gas_included ? 'included' : 'billed'}
                            onChange={(value) => setData('gas_included', value === 'included')}
                            options={[
                                { value: 'included', label: t('leasing.contracts.form.gasOptions.included'), icon: HouseIcon },
                                { value: 'billed', label: t('leasing.contracts.form.gasOptions.billed'), icon: CylinderIcon },
                            ]}
                            description={t(`leasing.contracts.form.gasHints.${data.gas_included ? 'included' : 'billed'}`)}
                            error={errors.gas_included}
                            className="sm:col-span-2"
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.contracts.form.picker.title')} description={t('leasing.contracts.form.picker.description')}>
                    <UnitPicker properties={properties} lines={data.lines} onAdd={addUnit} currency={currency} />
                </FormSection>

                <FormSection title={t('leasing.contracts.form.lines.title')} description={t('leasing.contracts.form.lines.description')}>
                    <div className="flex flex-col gap-4">
                        {data.lines.length === 0 && (
                            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t('leasing.contracts.form.picker.nothingYet')}</p>
                        )}
                        {groupByProperty(data.lines).map((group) => {
                            const property = properties.find((item) => item.id === group.propertyId);

                            return (
                                <section key={group.propertyId} className="flex flex-col gap-3">
                                    <h3 className="flex items-center gap-2 text-sm font-bold">
                                        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-cyan/12 text-brand-ink">
                                            <Building2Icon className="size-4" />
                                        </span>
                                        <span dir="auto">{property?.name}</span>
                                        <span className="font-mono text-xs font-normal text-muted-foreground">{property?.code}</span>
                                        <span className="ms-auto text-xs font-medium text-muted-foreground">
                                            {t('leasing.contracts.form.rented.units', { count: group.indexes.length })}
                                        </span>
                                    </h3>
                                    {group.indexes.map((index) => {
                                        const line = data.lines[index];

                                        return (
                                            <LineEditor
                                                key={line.id ?? `new-${index}`}
                                                index={index}
                                                line={line}
                                                onPatch={(patch) => patchLine(index, patch)}
                                                onRemove={() => setData('lines', data.lines.filter((_, position) => position !== index))}
                                                canRemove={!line.hasStays}
                                                properties={properties}
                                                billingBases={billingBases}
                                                errors={errors}
                                                currency={currency}
                                            />
                                        );
                                    })}
                                </section>
                            );
                        })}
                    </div>
                </FormSection>

                <FormSection title={t('leasing.cheques.schedule.title')} description={t('leasing.cheques.schedule.formDescription.received')}>
                    <ChequeScheduleFields
                        rows={rows}
                        startDate={data.start_date}
                        endDate={data.end_date}
                        direction="received"
                        enforce={isEditing && contract.status === 'active'}
                        isKept={isKept}
                        onPatch={patchCheque}
                        errors={errors}
                        currency={currency}
                        banks={banks}
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
