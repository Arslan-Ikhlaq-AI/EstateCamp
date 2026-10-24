import { DetailList, SectionCard } from '@/Components/DetailCards';
import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import { ListEmpty } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { InvoiceInput } from '@/Pages/Maintenance/Partials/CostFields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { todayIso, useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import { BanknoteIcon, CalendarClockIcon, CircleAlertIcon, CylinderIcon, FileSignatureIcon, GaugeIcon, InfoIcon, PercentIcon } from 'lucide-react';
import { isWholeMonth } from './Partials/GasBillTable';

/**
 * Most gas is sold with 5% VAT; a new bill starts there unless the last
 * bill at the same place used another rate.
 */
const DEFAULT_VAT = 5;

/**
 * At most this many months are offered, newest first.
 */
const MONTHS_OFFERED = 36;

const round2 = (value) => Math.round(value * 100) / 100;

const previousMonth = (month) => {
    const [year, number] = month.split('-').map(Number);

    return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
};

const monthEnd = (month) => {
    const [year, number] = month.split('-').map(Number);

    return `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, '0')}`;
};

const addDays = (isoDate, days) => {
    const date = new Date(`${isoDate}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
};

/**
 * The months a contract can be billed for: from its first month to this
 * month (or its last, when it has ended), newest first.
 */
function billableMonths(contract) {
    const first = contract.startDate.slice(0, 7);
    const last = contract.lastDay.slice(0, 7);
    const months = [];

    for (let month = last < todayIso().slice(0, 7) ? last : todayIso().slice(0, 7); month >= first && months.length < MONTHS_OFFERED; month = previousMonth(month)) {
        months.push(month);
    }

    return months;
}

/**
 * The charge carried on from the last bill at the same contract and
 * property: its closing reading becomes the opening one, with the same rate,
 * VAT and way of charging.
 */
function carriedOver(lastBill) {
    if (!lastBill) {
        return { metered: true, previous_reading: '', unit_rate: '', amount: '', vat_rate: DEFAULT_VAT };
    }

    const metered = lastBill.currentReading !== null;

    return {
        metered,
        previous_reading: lastBill.currentReading ?? '',
        unit_rate: lastBill.unitRate ?? '',
        amount: metered ? '' : lastBill.amount,
        vat_rate: lastBill.vatRate,
    };
}

function initialValues(bill, prefill, contracts, lastBills) {
    const empty = { current_reading: '', supplier_reference: '', notes: '', document: null, remove_document: false };

    if (bill) {
        return {
            ...empty,
            issue_date: bill.invoice.issueDate,
            metered: bill.metered,
            previous_reading: bill.previousReading ?? '',
            current_reading: bill.currentReading ?? '',
            unit_rate: bill.unitRate ?? '',
            amount: bill.metered ? '' : bill.amount,
            vat_rate: bill.vatRate,
            supplier_reference: bill.supplierReference ?? '',
            notes: bill.notes ?? '',
        };
    }

    const contract = contracts.find((item) => item.id === prefill.contract_id) ?? (contracts.length === 1 ? contracts[0] : null);
    const propertyId = contract?.properties.some((property) => property.id === prefill.property_id)
        ? prefill.property_id
        : contract?.properties.length === 1
          ? contract.properties[0].id
          : null;

    return {
        ...empty,
        contract_id: contract?.id ?? null,
        property_id: propertyId,
        month: prefill.month,
        issue_date: todayIso(),
        ...carriedOver(contract && propertyId ? lastBills[`${contract.id}-${propertyId}`] : null),
    };
}

/**
 * The bill as it is filled in: the total to charge, the gas used, the
 * amount before VAT, the VAT, who is billed and when it falls due.
 */
function Summary({ charge, clientName, dueDate, number, currency }) {
    const { t, formatMoney, formatNumber, formatDate } = useTranslation();

    const rows = [
        { icon: GaugeIcon, label: t('finance.gas.form.summary.units'), value: charge.units === null ? '—' : t('finance.gas.form.summary.unitsValue', { units: formatNumber(charge.units) }) },
        { icon: BanknoteIcon, label: t('finance.gas.form.summary.amount'), value: formatMoney(charge.amount, currency) },
        { icon: PercentIcon, label: t('finance.gas.form.summary.vat'), value: formatMoney(charge.vat, currency) },
        { icon: CalendarClockIcon, label: t('finance.gas.form.summary.due'), value: dueDate ? formatDate(dueDate) : '—' },
        { icon: FileSignatureIcon, label: t('finance.gas.form.summary.client'), value: clientName ?? '—' },
    ];

    return (
        <SectionCard title={t('finance.gas.form.summary.title')}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1 rounded-xl bg-[color-mix(in_oklab,var(--cash-gas)_7%,transparent)] p-4 ring-1 ring-[color-mix(in_oklab,var(--cash-gas)_22%,transparent)]">
                    <span className="text-xs text-muted-foreground">{t('finance.gas.form.summary.total')}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatMoney(charge.total, currency)}</span>
                </div>
                <dl className="flex flex-col gap-3 text-sm">
                    {rows.map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-3">
                            <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                                <row.icon className="size-4 shrink-0" />
                                {row.label}
                            </dt>
                            <dd className="min-w-0 text-end font-medium break-words tabular-nums" dir="auto">
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>
                <p className="flex gap-2 text-xs text-pretty text-muted-foreground">
                    <InfoIcon className="size-4 shrink-0" />
                    {number ?? t('finance.gas.form.summary.newNumber')}
                </p>
            </div>
        </SectionCard>
    );
}

/**
 * Add a month's gas for a contract that does not include it, or correct a
 * bill nothing has been paid towards: who, where and which month, the meter
 * readings and rate (or a fixed amount), the VAT, and the supplier's bill.
 */
export default function Form({ bill, prefill, contracts, billedMonths, lastBills, currency }) {
    const { t, formatNumber, formatDate } = useTranslation();
    const { name } = usePeriodLabel();
    const { period } = useLeasingFormat();
    const isEditing = bill !== null;
    const form = useForm(initialValues(bill, prefill, contracts, lastBills));
    const { data, setData, errors, processing } = form;
    const contract = isEditing ? null : contracts.find((item) => item.id === data.contract_id);
    const monthName = (month) => name({ kind: 'month', from: `${month}-01` });
    const pair = isEditing ? `${bill.contract.id}-${bill.property.id}` : contract && data.property_id ? `${contract.id}-${data.property_id}` : null;
    const lastBill = pair && !isEditing ? lastBills[pair] : null;
    const title = isEditing ? t('finance.gas.form.editTitle', { number: bill.invoice.number }) : t('finance.gas.form.addTitle');
    const breadcrumbs = [{ label: t('nav.payments') }, { label: t('finance.gas.title'), href: route('gas-bills.index') }, { label: isEditing ? bill.invoice.number : title }];

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const units = data.metered && data.previous_reading !== '' && data.current_reading !== '' ? round2(Number(data.current_reading) - Number(data.previous_reading)) : null;
    const amount = data.metered ? (units !== null && units > 0 ? round2(units * (Number(data.unit_rate) || 0)) : 0) : Number(data.amount) || 0;
    const vat = round2((amount * (Number(data.vat_rate) || 0)) / 100);
    const paymentTermsDays = isEditing ? bill.paymentTermsDays : contract?.paymentTermsDays;
    const dueDate = data.issue_date && paymentTermsDays !== undefined ? addDays(data.issue_date, paymentTermsDays) : null;

    // The days of the chosen month the contract runs, when that is not all of it.
    const runs = (() => {
        if (!contract || !data.month) {
            return null;
        }

        const from = `${data.month}-01` < contract.startDate ? contract.startDate : `${data.month}-01`;
        const to = monthEnd(data.month) > contract.lastDay ? contract.lastDay : monthEnd(data.month);

        return from <= to && !isWholeMonth(from, to) ? period(from, to) : null;
    })();

    // Another contract or property brings its own last reading, rate and VAT.
    const choose = (contractId, propertyId) =>
        setData((current) => ({ ...current, contract_id: contractId, property_id: propertyId, ...carriedOver(contractId && propertyId ? lastBills[`${contractId}-${propertyId}`] : null) }));

    const chooseContract = (contractId) => {
        const chosen = contracts.find((item) => item.id === contractId);
        const months = chosen ? billableMonths(chosen) : [];

        choose(contractId, chosen?.properties.length === 1 ? chosen.properties[0].id : null);
        setData((current) => ({ ...current, month: months.includes(current.month) ? current.month : (months[0] ?? current.month) }));
    };

    const submit = () => {
        if (isEditing) {
            form.transform((values) => ({ ...values, _method: 'put' }));
            form.post(route('gas-bills.update', bill.id), { forceFormData: true });
        } else {
            form.post(route('gas-bills.store'), { forceFormData: true });
        }
    };

    if (!isEditing && contracts.length === 0) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={breadcrumbs} title={title} description={t('finance.gas.form.description')} />
                <Card>
                    <ListEmpty
                        icon={CylinderIcon}
                        title={t('finance.gas.form.noContracts.title')}
                        description={t('finance.gas.form.noContracts.description')}
                        action={
                            <Button nativeButton={false} render={<Link href={route('contracts.index', { status: ['active'] })} />}>
                                <FileSignatureIcon data-icon="inline-start" />
                                {t('finance.gas.form.noContracts.action')}
                            </Button>
                        }
                    />
                </Card>
            </DashboardLayout>
        );
    }

    const billed = (pair && billedMonths[pair]) || {};

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={breadcrumbs}
                title={title}
                description={t('finance.gas.form.description')}
                cancelHref={route('gas-bills.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('finance.gas.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={
                    <Summary
                        charge={{ units, amount, vat, total: round2(amount + vat) }}
                        clientName={isEditing ? bill.client.name : contract?.client.name}
                        dueDate={dueDate}
                        number={isEditing ? bill.invoice.number : null}
                        currency={currency}
                    />
                }
            >
                {errors.bill && (
                    <Alert variant="destructive">
                        <CircleAlertIcon />
                        <AlertDescription>{errors.bill}</AlertDescription>
                    </Alert>
                )}

                <FormSection title={t('finance.gas.form.who.title')} description={t('finance.gas.form.who.description')}>
                    {isEditing ? (
                        <div className="flex flex-col gap-5">
                            <DetailList
                                rows={[
                                    { label: t('finance.gas.form.fields.contract'), value: `${bill.contract.number} · ${bill.client.name}` },
                                    { label: t('finance.gas.form.fields.property'), value: `${bill.property.name} · ${bill.property.code}` },
                                    { label: t('finance.gas.form.fields.month'), value: isWholeMonth(bill.periodStart, bill.periodEnd) ? monthName(bill.month) : period(bill.periodStart, bill.periodEnd) },
                                ]}
                            />
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <TextField
                                    {...bind('issue_date')}
                                    type="date"
                                    max={todayIso()}
                                    label={t('finance.gas.form.fields.issueDate')}
                                    description={dueDate ? t('finance.gas.form.fields.dueHint', { count: paymentTermsDays, date: formatDate(dueDate) }) : undefined}
                                />
                            </FieldGroup>
                        </div>
                    ) : (
                        <FieldGroup className="grid gap-4 sm:grid-cols-2">
                            <SelectField
                                id="contract_id"
                                label={t('finance.gas.form.fields.contract')}
                                placeholder={t('finance.gas.form.fields.chooseContract')}
                                value={data.contract_id}
                                onChange={chooseContract}
                                items={contracts.map((item) => ({ value: item.id, label: `${item.number} · ${item.client.name}` }))}
                                error={errors.contract_id}
                                className="sm:col-span-2"
                            />
                            <SelectField
                                id="property_id"
                                label={t('finance.gas.form.fields.property')}
                                placeholder={t('finance.gas.form.fields.chooseProperty')}
                                value={data.property_id}
                                onChange={(propertyId) => choose(data.contract_id, propertyId)}
                                items={(contract?.properties ?? []).map((property) => ({ value: property.id, label: `${property.name} · ${property.code}` }))}
                                disabled={!contract}
                                error={errors.property_id}
                            />
                            <SelectField
                                id="month"
                                label={t('finance.gas.form.fields.month')}
                                placeholder={t('finance.gas.form.fields.chooseMonth')}
                                value={data.month}
                                onChange={(month) => setData('month', month)}
                                items={(contract ? billableMonths(contract) : []).map((month) => ({
                                    value: month,
                                    label: billed[month] ? t('finance.gas.form.fields.billedOn', { month: monthName(month), number: billed[month] }) : monthName(month),
                                }))}
                                disabled={!contract}
                                description={runs ? t('finance.gas.toBill.runs', { period: runs }) : undefined}
                                error={errors.month}
                            />
                            <TextField
                                {...bind('issue_date')}
                                type="date"
                                max={todayIso()}
                                label={t('finance.gas.form.fields.issueDate')}
                                description={dueDate ? t('finance.gas.form.fields.dueHint', { count: paymentTermsDays, date: formatDate(dueDate) }) : undefined}
                            />
                        </FieldGroup>
                    )}
                </FormSection>

                <FormSection title={t('finance.gas.form.usage.title')} description={t('finance.gas.form.usage.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ChoiceField
                            id="metered"
                            label={t('finance.gas.form.fields.charge')}
                            value={data.metered ? 'metered' : 'fixed'}
                            onChange={(value) => setData('metered', value === 'metered')}
                            options={[
                                { value: 'metered', label: t('finance.gas.form.fields.metered'), icon: GaugeIcon },
                                { value: 'fixed', label: t('finance.gas.form.fields.fixed'), icon: BanknoteIcon },
                            ]}
                            error={errors.metered}
                            className="sm:col-span-2"
                        />
                        {data.metered ? (
                            <>
                                <TextField
                                    {...bind('previous_reading')}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="0.01"
                                    label={t('finance.gas.form.fields.previousReading')}
                                    description={lastBill && lastBill.currentReading !== null ? t('finance.gas.form.fields.previousHint', { month: monthName(lastBill.month), reading: formatNumber(lastBill.currentReading) }) : undefined}
                                    inputClassName="tabular-nums"
                                />
                                <TextField
                                    {...bind('current_reading')}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="0.01"
                                    label={t('finance.gas.form.fields.currentReading')}
                                    description={units !== null && units > 0 ? t('finance.gas.form.summary.unitsValue', { units: formatNumber(units) }) : undefined}
                                    inputClassName="tabular-nums"
                                />
                                <MoneyField {...bind('unit_rate')} label={t('finance.gas.form.fields.unitRate')} currency={currency} suffix={t('finance.gas.form.fields.perUnit')} />
                            </>
                        ) : (
                            <MoneyField {...bind('amount')} label={t('finance.gas.form.fields.amount')} currency={currency} description={t('finance.gas.form.fields.amountHint')} />
                        )}
                        <TextField {...bind('vat_rate')} type="number" inputMode="decimal" min={0} max={100} step="0.01" label={t('finance.gas.form.fields.vat')} inputClassName="tabular-nums" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('finance.gas.form.supplier.title')} description={t('finance.gas.form.supplier.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('supplier_reference')} label={t('finance.gas.form.fields.supplierReference')} optional />
                        <InvoiceInput
                            id="document"
                            label={t('finance.gas.form.fields.document')}
                            addText={t('finance.gas.form.fields.documentAdd')}
                            viewText={t('finance.gas.form.fields.documentView')}
                            file={data.document}
                            url={bill?.document?.url}
                            name={bill?.document?.name}
                            removed={data.remove_document}
                            onFile={(file) => setData((current) => ({ ...current, document: file, remove_document: false }))}
                            onRemove={() => setData((current) => ({ ...current, document: null, remove_document: Boolean(bill?.document) }))}
                            error={errors.document}
                            className="sm:col-span-2"
                        />
                        <TextareaField {...bind('notes')} label={t('leasing.common.notes')} optional className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
