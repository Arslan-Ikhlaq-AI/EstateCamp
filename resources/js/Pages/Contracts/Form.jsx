import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import { BedDoubleIcon, CircleAlertIcon, DoorOpenIcon, HouseIcon, PlusIcon, StoreIcon, Trash2Icon } from 'lucide-react';

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
const UNIT_ICONS = { bed: BedDoubleIcon, room: DoorOpenIcon, apartment: HouseIcon, shop: StoreIcon };

function blankLine(type = 'bed') {
    return {
        id: null,
        unit_type: type,
        property_id: null,
        room_id: null,
        apartment_id: null,
        shop_id: null,
        quantity: 1,
        monthly_rate: '',
        billing_basis: 'contracted',
        vat_rate: type === 'shop' ? 5 : 0,
        start_date: '',
        end_date: '',
        description: '',
        hasStays: false,
    };
}

/**
 * Line dates equal to the contract's are left blank so they keep following
 * the contract when its dates change; they are filled back in on save.
 */
function initialData(contract, clientId) {
    if (!contract) {
        return {
            client_id: clientId,
            ejari_number: '',
            start_date: '',
            end_date: '',
            billing_cycle: 'monthly',
            payment_terms_days: 7,
            security_deposit: '',
            signed_on: '',
            notes: '',
            lines: [blankLine()],
        };
    }

    return {
        client_id: contract.client_id,
        ejari_number: contract.ejari_number ?? '',
        start_date: contract.start_date,
        end_date: contract.end_date,
        billing_cycle: contract.billing_cycle,
        payment_terms_days: contract.payment_terms_days,
        security_deposit: contract.security_deposit ?? '',
        signed_on: contract.signed_on ?? '',
        notes: contract.notes ?? '',
        lines: contract.lines.map((line) => ({
            ...line,
            start_date: line.start_date === contract.start_date ? '' : line.start_date,
            end_date: line.end_date === contract.end_date ? '' : line.end_date,
            description: line.description ?? '',
        })),
    };
}

function LineEditor({ index, line, onPatch, onRemove, canRemove, properties, billingBases, errors, currency }) {
    const { t, formatMoney } = useTranslation();
    const property = properties.find((item) => item.id === line.property_id);
    const room = property?.rooms.find((item) => item.id === line.room_id);
    const error = (field) => errors[`lines.${index}.${field}`];
    const monthly = (Number(line.monthly_rate) || 0) * (Number(line.quantity) || 0);

    const unitStatus = (status) => (status && !['active', 'vacant'].includes(status) ? ` · ${t(`leasing.unitStatus.${status}`)}` : '');

    const unitItems = {
        bed: [
            { value: 'any', label: t('leasing.contracts.form.anyRoom') },
            ...(property?.rooms ?? []).map((item) => ({
                value: item.id,
                label: `${t('leasing.lines.roomName', { room: item.number })} · ${t('leasing.units.beds', { count: item.capacity })}${unitStatus(item.status)}`,
            })),
        ],
        room: (property?.rooms ?? []).map((item) => ({
            value: item.id,
            label: `${t('leasing.lines.roomName', { room: item.number })} · ${t('leasing.units.beds', { count: item.capacity })}${unitStatus(item.status)}`,
        })),
        apartment: (property?.apartments ?? []).map((item) => ({ value: item.id, label: `${t('leasing.lines.apartment', { number: item.number })}${unitStatus(item.status)}` })),
        shop: (property?.shops ?? []).map((item) => ({ value: item.id, label: `${t('leasing.lines.shop', { number: item.number })}${unitStatus(item.status)}` })),
    }[line.unit_type];

    const unitColumn = { bed: 'room_id', room: 'room_id', apartment: 'apartment_id', shop: 'shop_id' }[line.unit_type];

    // Suggest the unit's list price the first time a unit is chosen.
    const chooseUnit = (value) => {
        const id = value === 'any' ? null : value;
        const patch = { [unitColumn]: id };

        if (line.monthly_rate === '' && id !== null) {
            const unit = line.unit_type === 'apartment'
                ? property.apartments.find((item) => item.id === id)
                : line.unit_type === 'shop'
                  ? property.shops.find((item) => item.id === id)
                  : property.rooms.find((item) => item.id === id);
            const rate = line.unit_type === 'room' && unit?.rate ? unit.rate * unit.capacity : unit?.rate;

            if (rate) {
                patch.monthly_rate = rate;
            }
        }

        onPatch(patch);
    };

    return (
        <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-medium">{t('leasing.contracts.form.lineTitle', { number: index + 1 })}</h3>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground tabular-nums">{t('leasing.contracts.form.lineMonthly', { amount: formatMoney(monthly, currency) })}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={onRemove}
                        disabled={!canRemove}
                        aria-label={t('leasing.contracts.form.removeLine', { number: index + 1 })}
                    >
                        <Trash2Icon />
                    </Button>
                </div>
            </div>

            <ChoiceField
                id={`lines-${index}-unit_type`}
                label={t('leasing.contracts.form.fields.unitType')}
                value={line.unit_type}
                onChange={(type) =>
                    onPatch({
                        unit_type: type,
                        room_id: null,
                        apartment_id: null,
                        shop_id: null,
                        quantity: 1,
                        billing_basis: 'contracted',
                        vat_rate: type === 'shop' ? 5 : 0,
                    })
                }
                options={Object.keys(UNIT_ICONS).map((type) => ({ value: type, label: t(`leasing.unitTypes.${type}`), icon: UNIT_ICONS[type] }))}
                description={t(`leasing.contracts.form.unitHints.${line.unit_type}`)}
                error={error('unit_type')}
            />

            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <SelectField
                    id={`lines-${index}-property_id`}
                    label={t('leasing.common.property')}
                    placeholder={t('leasing.common.chooseProperty')}
                    value={line.property_id}
                    onChange={(value) => onPatch({ property_id: value, room_id: null, apartment_id: null, shop_id: null })}
                    items={properties.map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }))}
                    error={error('property_id')}
                />
                <SelectField
                    id={`lines-${index}-${unitColumn}`}
                    label={t(`leasing.contracts.form.fields.unit.${line.unit_type}`)}
                    placeholder={t('leasing.contracts.form.fields.chooseUnit')}
                    value={line.unit_type === 'bed' ? (line.room_id ?? 'any') : line[unitColumn]}
                    onChange={chooseUnit}
                    items={unitItems}
                    disabled={!property}
                    error={error(unitColumn)}
                />
                {line.unit_type === 'bed' && (
                    <TextField
                        id={`lines-${index}-quantity`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={room?.capacity}
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

export default function Form({ contract, clientId, currency, clients, properties, billingCycles, billingBases }) {
    const { t } = useTranslation();
    const isEditing = contract !== null;
    const form = useForm(initialData(contract, clientId));
    const { data, setData, errors, processing } = form;
    const title = isEditing ? t('leasing.contracts.form.editTitle', { number: contract.contract_number }) : t('leasing.contracts.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const patchLine = (index, patch) => setData('lines', data.lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));

    const submit = () => {
        form.transform((values) => ({
            ...values,
            lines: values.lines.map(({ hasStays, ...line }) => ({
                ...line,
                start_date: line.start_date || values.start_date,
                end_date: line.end_date || values.end_date,
            })),
        }));

        if (isEditing) {
            form.put(route('contracts.update', contract.id), { preserveScroll: true });
        } else {
            form.post(route('contracts.store'), { preserveScroll: true });
        }
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
                aside={<Summary data={data} currency={currency} />}
            >
                {(errors.lines || errors.status) && (
                    <Alert variant="destructive">
                        <CircleAlertIcon />
                        <AlertDescription>{errors.lines ?? errors.status}</AlertDescription>
                    </Alert>
                )}

                <FormSection title={t('leasing.contracts.form.client.title')} description={t('leasing.contracts.form.client.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('client_id')}
                            label={t('leasing.contracts.form.fields.client')}
                            placeholder={t('leasing.contracts.form.fields.chooseClient')}
                            items={clients.map((client) => ({ value: client.id, label: client.name }))}
                            description={
                                <Link href={route('clients.create')} className="underline underline-offset-3 hover:text-foreground">
                                    {t('leasing.contracts.form.fields.newClient')}
                                </Link>
                            }
                            className="sm:col-span-2"
                        />
                        <TextField {...bind('ejari_number')} label={t('leasing.common.ejariNumber')} optional />
                        <TextField {...bind('signed_on')} type="date" label={t('leasing.contracts.form.fields.signedOn')} optional />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.contracts.form.terms.title')} description={t('leasing.contracts.form.terms.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} type="date" label={t('leasing.common.startDate')} />
                        <TextField {...bind('end_date')} type="date" label={t('leasing.common.endDate')} />
                        <ChoiceField
                            id="billing_cycle"
                            label={t('leasing.contracts.form.fields.billingCycle')}
                            value={data.billing_cycle}
                            onChange={(value) => setData('billing_cycle', value)}
                            options={billingCycles.map((cycle) => ({ value: cycle, label: t(`leasing.billingCycles.${cycle}`) }))}
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

                <FormSection
                    title={t('leasing.contracts.form.lines.title')}
                    description={t('leasing.contracts.form.lines.description')}
                    action={
                        <Button type="button" variant="outline" size="sm" onClick={() => setData('lines', [...data.lines, blankLine()])}>
                            <PlusIcon data-icon="inline-start" />
                            {t('leasing.contracts.form.addLine')}
                        </Button>
                    }
                >
                    <div className="flex flex-col gap-4">
                        {data.lines.map((line, index) => (
                            <LineEditor
                                key={line.id ?? `new-${index}`}
                                index={index}
                                line={line}
                                onPatch={(patch) => patchLine(index, patch)}
                                onRemove={() => setData('lines', data.lines.filter((_, position) => position !== index))}
                                canRemove={data.lines.length > 1 && !line.hasStays}
                                properties={properties}
                                billingBases={billingBases}
                                errors={errors}
                                currency={currency}
                            />
                        ))}
                    </div>
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
