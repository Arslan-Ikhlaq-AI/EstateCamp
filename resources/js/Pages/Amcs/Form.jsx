import { amcNavTitle, amcRoute, COVERAGE_ICONS } from '@/Components/AmcBadges';
import ChequeScheduleFields from '@/Components/ChequeScheduleFields';
import { SectionCard } from '@/Components/DetailCards';
import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { InvoiceInput } from '@/Pages/Maintenance/Partials/CostFields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { addMonths, todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { chequePayload, emptyChequeEntry, initialChequeEntries, maintenancePaymentCount, planMaintenanceCheques, scheduleRows, termMonths } from '@/lib/cheques';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { BellRingIcon, CalendarDaysIcon, CalendarRangeIcon, CircleCheckIcon, CircleXIcon, InfoIcon, RefreshCwIcon, WalletCardsIcon, WalletIcon } from 'lucide-react';

const STATUS_ICONS = { active: CircleCheckIcon, cancelled: CircleXIcon };

const TEXT_FIELDS = [
    'vendor_name', 'vendor_contact_person', 'vendor_phone', 'vendor_email', 'vendor_licence_number', 'reference_number',
    'last_visit_on', 'response_time_hours', 'certificate_number', 'certificate_expires_on', 'notes',
];

/**
 * The day before the same date a year later: the end of a one-year term.
 */
const yearEnd = (start) => {
    const end = new Date(`${addMonths(start, 12)}T00:00:00Z`);

    end.setUTCDate(end.getUTCDate() - 1);

    return end.toISOString().slice(0, 10);
};

/**
 * How many visits the term holds, as MaintenanceContract::visitCount()
 * works it out. `visitsPerYear` is the chosen frequency's entry in `visitFrequencies`.
 */
const visitCount = (months, visitsPerYear) => Math.max(1, Math.ceil((months * visitsPerYear) / 12));

const initialValues = (contract, prefill, properties, paymentMonths) => {
    const source = contract ?? prefill ?? {};
    const start = source.start_date ?? todayIso();
    const terms = {
        start_date: start,
        end_date: source.end_date ?? yearEnd(start),
        contract_value: source.contract_value ?? '',
        payment_terms: source.payment_terms ?? 'quarterly',
    };

    return {
        property_id: source.property_id ?? (properties.length === 1 ? properties[0].id : null),
        renewed_from_id: source.renewed_from_id ?? null,
        ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, source[field] ?? ''])),
        ...terms,
        visit_frequency: source.visit_frequency ?? 'quarterly',
        visit_alert_days: source.visit_alert_days ?? 5,
        coverage: source.coverage ?? [],
        ...(contract ? { status: contract.status } : {}),
        document: null,
        remove_document: false,
        cheques: initialChequeEntries(contract?.cheques ?? [], planMaintenanceCheques(terms, paymentMonths)),
    };
};

/**
 * A whole number of hours, with the unit after it.
 */
function HoursField({ id, label, value, onChange, error, description }) {
    const { t } = useTranslation();

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>
                {label}
                <span className="font-normal text-muted-foreground">({t('propertyForm.optional')})</span>
            </FieldLabel>
            <InputGroup>
                <InputGroupInput
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={720}
                    step={1}
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    placeholder="4"
                    className="tabular-nums"
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupText>{t('amcs.form.fields.hoursSuffix')}</InputGroupText>
                </InputGroupAddon>
            </InputGroup>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * The systems the contract covers, as a grid of tick boxes with their icons.
 */
function CoveragePicker({ service, options, value, onChange, error }) {
    const { t } = useTranslation();
    const allChosen = value.length === options.length;
    const toggle = (system, checked) => onChange(checked ? [...value, system] : value.filter((chosen) => chosen !== system));

    return (
        <Field data-invalid={error ? true : undefined}>
            <div className="flex items-center justify-between gap-3">
                <FieldLabel id="coverage-label">{t('amcs.form.fields.coverage')}</FieldLabel>
                <Button type="button" variant="ghost" size="sm" className="-my-1" onClick={() => onChange(allChosen ? [] : options)}>
                    {allChosen ? t('amcs.form.fields.clear') : t('amcs.form.fields.selectAll')}
                </Button>
            </div>
            <div role="group" aria-labelledby="coverage-label" className="grid gap-2 sm:grid-cols-2">
                {options.map((system) => {
                    const Icon = COVERAGE_ICONS[system];
                    const isChosen = value.includes(system);

                    return (
                        <label
                            key={system}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/50',
                                isChosen && 'bg-primary/5 font-medium ring-primary/40 hover:bg-primary/[0.07]',
                            )}
                        >
                            <Checkbox checked={isChosen} onCheckedChange={(checked) => toggle(system, Boolean(checked))} />
                            {Icon && <Icon className={cn('size-4 shrink-0', isChosen ? 'text-primary' : 'text-muted-foreground')} />}
                            <span className="min-w-0">{t(`amcs.coverage.${system}`)}</span>
                        </label>
                    );
                })}
            </div>
            {!error && <FieldDescription>{t(`amcs.services.${service}.coverageDescription`)}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * The contract at a glance as it is filled in: the value and how it splits
 * into payments, the length of the term, the visits it holds and the
 * systems ticked.
 */
function Summary({ data, contract, coverage, visitFrequencies, paymentMonths, cheques, currency }) {
    const { t, formatMoney } = useTranslation();
    const months = data.start_date && data.end_date && data.end_date > data.start_date ? termMonths(data.start_date, data.end_date) : null;
    const value = Number.parseFloat(data.contract_value) || 0;
    const visits = months ? visitCount(months, visitFrequencies[data.visit_frequency]) : null;
    const payments = months ? maintenancePaymentCount(data.payment_terms, months, visits, paymentMonths) : null;

    const rows = [
        { icon: CalendarRangeIcon, label: t('amcs.form.summary.term'), value: months ? t('amcs.months', { count: months }) : '—' },
        {
            icon: WalletIcon,
            label: t('amcs.form.summary.payments'),
            value: payments ? t('amcs.payments', { count: payments, amount: formatMoney(value / payments, currency) }) : '—',
        },
        { icon: WalletCardsIcon, label: t('amcs.form.summary.cheques'), value: data.payment_terms === 'per_visit' ? t('amcs.form.summary.noCheques') : t('amcs.cheques', { count: cheques }) },
        { icon: CalendarDaysIcon, label: t('amcs.form.summary.visits'), value: visits ? t('amcs.visits', { count: visits }) : '—' },
        { icon: BellRingIcon, label: t('amcs.form.summary.alert'), value: t('amcs.daysBefore', { count: Number(data.visit_alert_days) }) },
    ];

    return (
        <SectionCard title={t('amcs.form.summary.title')}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1 rounded-xl bg-brand-cyan/[0.06] p-4 ring-1 ring-brand-cyan/15">
                    <span className="text-xs text-muted-foreground">{t('amcs.form.summary.total')}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatMoney(value, currency)}</span>
                    <span className="text-xs text-muted-foreground">{t(`amcs.paymentTerms.${data.payment_terms}`)}</span>
                </div>
                <dl className="flex flex-col gap-3 text-sm">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-3">
                            <dt className="flex items-center gap-2 text-muted-foreground">
                                <row.icon className="size-4 shrink-0" />
                                {row.label}
                            </dt>
                            <dd className="text-end font-medium tabular-nums">{row.value}</dd>
                        </div>
                    ))}
                    <div className="flex flex-col gap-2 border-t pt-3">
                        <dt className="flex items-center justify-between gap-3 text-muted-foreground">
                            {t('amcs.form.summary.systems')}
                            <span className="font-medium text-foreground tabular-nums">
                                {data.coverage.length} / {coverage.length}
                            </span>
                        </dt>
                        <dd className="flex flex-wrap gap-1.5">
                            {coverage
                                .filter((system) => data.coverage.includes(system))
                                .map((system) => {
                                    const Icon = COVERAGE_ICONS[system];

                                    return (
                                        <span key={system} className="inline-flex items-center gap-1 rounded-md bg-primary/5 px-1.5 py-0.5 text-xs text-primary ring-1 ring-primary/15">
                                            {Icon && <Icon className="size-3" />}
                                            {t(`amcs.coverage.${system}`)}
                                        </span>
                                    );
                                })}
                        </dd>
                    </div>
                </dl>
                <p className="flex gap-2 text-xs text-pretty text-muted-foreground">
                    <InfoIcon className="size-4 shrink-0" />
                    {contract ? contract.number : t('amcs.form.summary.newNumber')}
                </p>
            </div>
        </SectionCard>
    );
}

/**
 * Add a maintenance contract of one kind (such as fire safety), renew one
 * for its next term, or correct one: the property and contractor, the term
 * and value, the visits and what they cover, the certificate and the signed copy.
 */
export default function Form({ service, contract, prefill, renewing, properties, coverage, paymentTerms, paymentMonths, visitFrequencies, visitAlertDays, statuses, banks, currency }) {
    const { t } = useTranslation();
    const isEditing = contract !== null;
    const form = useForm(initialValues(contract, prefill, properties, paymentMonths));
    const { data, setData, errors, processing } = form;
    const isKept = Boolean(contract?.hasLockedCheques);
    const chequeRows = (values) => scheduleRows(planMaintenanceCheques(values, paymentMonths), values.cheques, contract?.cheques ?? [], isKept);
    const rows = chequeRows(data);
    const patchCheque = (key, patch) =>
        setData((current) => ({ ...current, cheques: { ...current.cheques, [key]: { ...(current.cheques[key] ?? emptyChequeEntry()), ...patch } } }));
    const title = isEditing
        ? t('amcs.form.editTitle', { number: contract.number })
        : renewing
          ? t('amcs.form.renewTitle', { number: renewing.number })
          : t(`amcs.services.${service}.add`);

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    // A one-year term follows a new start date until the end date is changed by hand.
    const changeStart = (start) =>
        setData((current) => ({
            ...current,
            start_date: start,
            end_date: start && (!current.end_date || current.end_date === yearEnd(current.start_date)) ? yearEnd(start) : current.end_date,
        }));

    const submit = () => {
        form.transform((values) => ({ ...values, cheques: chequePayload(chequeRows(values)), ...(isEditing ? { _method: 'put' } : {}) }));

        if (isEditing) {
            form.post(route(amcRoute(service, 'update'), contract.id), { forceFormData: true });
        } else {
            form.post(route(amcRoute(service, 'store')), { forceFormData: true });
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.contractsMenu') }, { label: t(amcNavTitle(service)), href: route(amcRoute(service)) }, { label: isEditing ? contract.number : title }]}
                title={title}
                description={t('amcs.form.description')}
                cancelHref={isEditing ? route(amcRoute(service, 'show'), contract.id) : route(amcRoute(service))}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('amcs.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={
                    <Summary
                        data={data}
                        contract={contract}
                        coverage={coverage}
                        visitFrequencies={visitFrequencies}
                        paymentMonths={paymentMonths}
                        cheques={rows.length}
                        currency={currency}
                    />
                }
            >
                {renewing && (
                    <p className="flex items-center gap-2.5 rounded-xl bg-brand-cyan/[0.06] px-4 py-3 text-sm text-pretty ring-1 ring-brand-cyan/20">
                        <RefreshCwIcon className="size-4 shrink-0 text-brand-ink" />
                        {t('amcs.form.renewing', { number: renewing.number })}
                    </p>
                )}

                <FormSection title={t('amcs.form.contractor.title')} description={t('amcs.form.contractor.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('property_id')}
                            label={t('amcs.form.fields.property')}
                            placeholder={t('amcs.form.fields.chooseProperty')}
                            items={properties.map((property) => ({ value: property.id, label: `${property.name} · ${property.code}` }))}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('vendor_name')}
                            label={t('amcs.form.fields.vendorName')}
                            placeholder={t('amcs.form.fields.vendorNamePlaceholder')}
                            dir="auto"
                            className="sm:col-span-2"
                        />
                        <TextField {...bind('vendor_contact_person')} label={t('amcs.form.fields.contactPerson')} optional dir="auto" />
                        <TextField {...bind('vendor_phone')} type="tel" label={t('amcs.form.fields.phone')} placeholder="+971 4 000 0000" optional />
                        <TextField {...bind('vendor_email')} type="email" label={t('amcs.form.fields.email')} optional />
                        <TextField
                            {...bind('vendor_licence_number')}
                            label={t(`amcs.services.${service}.licence`)}
                            description={t(`amcs.services.${service}.licenceHint`)}
                            optional
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('amcs.form.term.title')} description={t('amcs.form.term.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} onChange={changeStart} type="date" label={t('amcs.form.fields.startDate')} />
                        <TextField {...bind('end_date')} type="date" min={data.start_date || undefined} label={t('amcs.form.fields.endDate')} />
                        <MoneyField
                            {...bind('contract_value')}
                            label={t('amcs.form.fields.value')}
                            description={t('amcs.form.fields.valueHint')}
                            currency={currency}
                            placeholder="0.00"
                        />
                        <SelectField
                            {...bind('payment_terms')}
                            label={t('amcs.form.fields.paymentTerms')}
                            items={paymentTerms.map((terms) => ({ value: terms, label: t(`amcs.paymentTerms.${terms}`) }))}
                        />
                        <TextField
                            {...bind('reference_number')}
                            label={t('amcs.form.fields.reference')}
                            description={t('amcs.form.fields.referenceHint')}
                            optional
                            className={isEditing ? undefined : 'sm:col-span-2'}
                        />
                        {isEditing && (
                            <ChoiceField
                                id="status"
                                label={t('amcs.form.fields.status')}
                                value={data.status}
                                onChange={(value) => setData('status', value)}
                                options={statuses.map((status) => ({ value: status, label: t(`amcs.form.statuses.${status}`), icon: STATUS_ICONS[status] }))}
                                description={t('amcs.form.fields.statusHint')}
                                error={errors.status}
                            />
                        )}
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('amcs.form.service.title')} description={t('amcs.form.service.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('visit_frequency')}
                            label={t('amcs.form.fields.visitFrequency')}
                            items={Object.keys(visitFrequencies).map((frequency) => ({ value: frequency, label: t(`amcs.visitFrequencies.${frequency}`) }))}
                        />
                        <TextField
                            {...bind('last_visit_on')}
                            type="date"
                            min={data.start_date || undefined}
                            max={todayIso()}
                            label={t('amcs.form.fields.lastVisit')}
                            description={t('amcs.form.fields.lastVisitHint')}
                            optional
                        />
                        <HoursField {...bind('response_time_hours')} label={t('amcs.form.fields.responseTime')} description={t('amcs.form.fields.responseTimeHint')} />
                        <SelectField
                            {...bind('visit_alert_days')}
                            label={t('amcs.form.fields.visitAlert')}
                            description={t('amcs.form.fields.visitAlertHint')}
                            items={visitAlertDays.map((days) => ({ value: days, label: t('amcs.daysBefore', { count: days }) }))}
                        />
                        <div className="sm:col-span-2">
                            <CoveragePicker
                                service={service}
                                options={coverage}
                                value={data.coverage}
                                onChange={(value) => setData('coverage', value)}
                                error={errors.coverage ?? Object.entries(errors).find(([key]) => key.startsWith('coverage.'))?.[1]}
                            />
                        </div>
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('amcs.form.cheques.title')} description={t('amcs.form.cheques.description')}>
                    {data.payment_terms === 'per_visit' ? (
                        <p className="rounded-xl bg-muted/50 px-4 py-3 text-[0.8125rem] text-muted-foreground ring-1 ring-foreground/[0.06]">{t('amcs.form.cheques.perVisit')}</p>
                    ) : (
                        <ChequeScheduleFields
                            rows={rows}
                            startDate={data.start_date}
                            endDate={data.end_date}
                            direction="issued"
                            enforce={false}
                            optional
                            isKept={isKept}
                            onPatch={patchCheque}
                            errors={errors}
                            currency={currency}
                            banks={banks}
                            hint={t('amcs.form.cheques.hint')}
                        />
                    )}
                </FormSection>

                <FormSection title={t(`amcs.services.${service}.certificate`)} description={t(`amcs.services.${service}.certificateDescription`)}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('certificate_number')} label={t('amcs.form.fields.certificateNumber')} optional />
                        <TextField {...bind('certificate_expires_on')} type="date" label={t('amcs.form.fields.certificateExpiry')} optional />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('amcs.form.document.title')} description={t('amcs.form.document.description')}>
                    <InvoiceInput
                        id="document"
                        label={t('amcs.form.fields.document')}
                        addText={t('amcs.document.add')}
                        viewText={t('amcs.document.view')}
                        file={data.document}
                        url={contract?.document?.url}
                        name={contract?.document?.name}
                        removed={data.remove_document}
                        onFile={(file) => setData((current) => ({ ...current, document: file, remove_document: false }))}
                        onRemove={() => setData((current) => ({ ...current, document: null, remove_document: Boolean(contract?.document) }))}
                        error={errors.document}
                    />
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
