import { ChoiceField, FormSection, MoneyField, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import { CircleAlertIcon } from 'lucide-react';
import { useMemo } from 'react';

const MAX_PREVIEW_ROWS = 12;

function initialData(lease, prefill) {
    const source = lease ?? prefill ?? {};

    return {
        property_id: source.property_id ?? null,
        landlord_id: source.landlord_id ?? null,
        renewed_from_id: source.renewed_from_id ?? null,
        ejari_number: source.ejari_number ?? '',
        start_date: source.start_date ?? '',
        end_date: source.end_date ?? '',
        annual_rent: source.annual_rent ?? '',
        payments_per_year: source.payments_per_year ?? 4,
        security_deposit: source.security_deposit ?? '',
        notice_period_days: source.notice_period_days ?? 90,
        status: source.status ?? 'draft',
        notes: source.notes ?? '',
    };
}

/**
 * The cheques the terms would produce, worked out the same way as
 * HeadLease::plannedInstallments() on the server.
 */
function useSchedule(data) {
    return useMemo(() => {
        const perYear = Number(data.payments_per_year);
        const rent = Number(data.annual_rent);

        if (!data.start_date || !data.end_date || data.end_date <= data.start_date || !perYear || !rent) {
            return [];
        }

        const amount = Math.round((rent / perYear) * 100) / 100;
        const rows = [];

        for (let number = 1; number <= 240; number++) {
            const due = addMonths(data.start_date, (12 / perYear) * (number - 1));

            if (due > data.end_date) {
                break;
            }

            rows.push({ number, due, amount });
        }

        return rows;
    }, [data.start_date, data.end_date, data.annual_rent, data.payments_per_year]);
}

function SchedulePreview({ schedule, currency }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const total = schedule.reduce((sum, row) => sum + row.amount, 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('leasing.headLeases.form.preview.title')}</CardTitle>
                <CardDescription>{t('leasing.headLeases.form.preview.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {schedule.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('leasing.headLeases.form.preview.empty')}</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        <ol className="flex flex-col divide-y text-sm">
                            {schedule.slice(0, MAX_PREVIEW_ROWS).map((row) => (
                                <li key={row.number} className="flex items-center justify-between gap-3 py-1.5">
                                    <span className="text-muted-foreground tabular-nums">
                                        {row.number}. {formatDate(row.due)}
                                    </span>
                                    <span className="font-medium tabular-nums">{formatMoney(row.amount, currency)}</span>
                                </li>
                            ))}
                        </ol>
                        {schedule.length > MAX_PREVIEW_ROWS && (
                            <p className="text-xs text-muted-foreground">{t('leasing.headLeases.form.preview.more', { count: schedule.length - MAX_PREVIEW_ROWS })}</p>
                        )}
                        <div className="flex items-center justify-between border-t pt-3 text-sm">
                            <span className="text-muted-foreground">{t('leasing.headLeases.form.preview.total', { count: schedule.length })}</span>
                            <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Form({ lease, prefill, renewing, currency, properties, landlords, statuses, paymentsPerYear }) {
    const { t } = useTranslation();
    const isEditing = lease !== null;
    const form = useForm(initialData(lease, prefill));
    const { data, setData, errors, processing } = form;
    const schedule = useSchedule(data);
    const title = isEditing
        ? t('leasing.headLeases.form.editTitle', { number: lease.lease_number })
        : renewing
          ? t('leasing.headLeases.form.renewTitle', { number: renewing.number })
          : t('leasing.headLeases.form.addTitle');

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = () => (isEditing ? form.put(route('head-leases.update', lease.id)) : form.post(route('head-leases.store')));

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[
                    { label: t('leasing.headLeases.title'), href: route('head-leases.index') },
                    { label: isEditing ? lease.lease_number : title },
                ]}
                title={title}
                description={t('leasing.headLeases.form.description')}
                cancelHref={isEditing ? route('head-leases.show', lease.id) : route('head-leases.index')}
                submitLabel={isEditing ? t('leasing.common.saveChanges') : t('leasing.headLeases.form.save')}
                processing={processing}
                onSubmit={submit}
                aside={<SchedulePreview schedule={schedule} currency={currency} />}
            >
                {isEditing && lease.hasRecordedPayments && (
                    <Alert>
                        <CircleAlertIcon />
                        <AlertDescription>{t('leasing.headLeases.form.recordedWarning')}</AlertDescription>
                    </Alert>
                )}

                <FormSection title={t('leasing.headLeases.form.parties.title')} description={t('leasing.headLeases.form.parties.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <SelectField
                            {...bind('property_id')}
                            label={t('leasing.common.property')}
                            placeholder={t('leasing.common.chooseProperty')}
                            items={properties.map((property) => ({ value: property.id, label: `${property.name} · ${property.code}` }))}
                        />
                        <SelectField
                            {...bind('landlord_id')}
                            label={t('leasing.headLeases.form.fields.landlord')}
                            placeholder={t('leasing.headLeases.form.fields.chooseLandlord')}
                            items={landlords.map((landlord) => ({ value: landlord.id, label: landlord.name }))}
                            description={
                                <Link href={route('landlords.create')} className="underline underline-offset-3 hover:text-foreground">
                                    {t('leasing.headLeases.form.fields.newLandlord')}
                                </Link>
                            }
                        />
                        <TextField {...bind('ejari_number')} label={t('leasing.common.ejariNumber')} optional className="sm:col-span-2" />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.headLeases.form.terms.title')} description={t('leasing.headLeases.form.terms.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <TextField {...bind('start_date')} type="date" label={t('leasing.common.startDate')} />
                        <TextField {...bind('end_date')} type="date" label={t('leasing.common.endDate')} />
                        <MoneyField {...bind('annual_rent')} label={t('leasing.headLeases.form.fields.annualRent')} currency={currency} suffix={t('leasing.common.perYear')} placeholder="780000" />
                        <MoneyField {...bind('security_deposit')} label={t('leasing.common.securityDeposit')} currency={currency} optional />
                        <ChoiceField
                            id="payments_per_year"
                            label={t('leasing.headLeases.form.fields.paymentsPerYear')}
                            value={data.payments_per_year}
                            onChange={(value) => setData('payments_per_year', Number(value))}
                            options={paymentsPerYear.map((count) => ({ value: count, label: t('leasing.headLeases.form.cheques', { count }) }))}
                            error={errors.payments_per_year}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('notice_period_days')}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            label={t('leasing.headLeases.form.fields.noticeDays')}
                            optional
                        />
                    </FieldGroup>
                </FormSection>

                <FormSection title={t('leasing.common.status')} description={t('leasing.headLeases.form.statusDescription')}>
                    <ChoiceField
                        id="status"
                        label={t('leasing.common.status')}
                        value={data.status}
                        onChange={(value) => setData('status', value)}
                        options={statuses.map((status) => ({ value: status, label: t(`leasing.status.lease.${status}`) }))}
                        error={errors.status}
                    />
                </FormSection>

                <FormSection title={t('leasing.common.notes')} description={t('leasing.common.notesDescription')}>
                    <TextareaField {...bind('notes')} label={t('leasing.common.notes')} rows={4} />
                </FormSection>
            </FormShell>
        </DashboardLayout>
    );
}
