import { SectionCard } from '@/Components/DetailCards';
import { ChoiceField, FormSection, SelectField, TextareaField, TextField } from '@/Components/FormFields';
import FormShell from '@/Components/FormShell';
import { StaffAvatar, useCalendarFormat, useStaffNames } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import { BanknoteIcon, BanknoteXIcon } from 'lucide-react';
import { addDays, daysBetween, LEAVE_TYPE_ICONS, leaveMonths } from './Partials/LeaveParts';

// Quick lengths from the first day: a number of weeks or months.
const LENGTHS = [
    { key: 'week', weeks: 1 },
    { key: 'twoWeeks', weeks: 2 },
    { key: 'month', months: 1 },
    { key: 'twoMonths', months: 2 },
    { key: 'threeMonths', months: 3 },
];

const endAfter = (start, length) => addDays(length.months ? addMonths(start, length.months) : addDays(start, length.weeks * 7), -1);

/**
 * The leave as it is being filled in: who, how many days in each month,
 * what unpaid leave would take off each month's salary, and what happens
 * once it is sent or saved.
 */
function Summary({ mode, member, data, currency }) {
    const { t, formatMoney, formatNumber } = useTranslation();
    const { roleName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const hasDays = data.starts_on && data.ends_on && data.ends_on >= data.starts_on;
    const months = hasDays ? leaveMonths(data.starts_on, data.ends_on) : [];
    const isUnpaid = mode === 'give' && data.is_paid === 'unpaid';

    return (
        <SectionCard title={t('staff.leaveForm.summary.title')}>
            <div className="flex flex-col gap-5">
                <div className="flex min-w-0 items-center gap-3">
                    <StaffAvatar name={member?.name ?? '?'} className="size-11" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span dir="auto" className="truncate font-semibold">
                            {member?.name ?? t('staff.leaveForm.summary.noOne')}
                        </span>
                        {member && (
                            <span dir="auto" className="truncate text-[0.8125rem] text-muted-foreground">
                                {roleName(member.role)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl bg-brand-cyan/[0.06] p-4 ring-1 ring-brand-cyan/15">
                    <span className="text-xs text-muted-foreground">{t('staff.leaveForm.summary.length')}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">
                        {hasDays ? t('staff.leave.days', { count: daysBetween(data.starts_on, data.ends_on) }) : '—'}
                    </span>
                    {months.length > 0 && (
                        <ul className="flex flex-col gap-1.5 border-t border-brand-cyan/15 pt-3 text-[0.8125rem]">
                            {months.map((month) => (
                                <li key={month.month} className="flex items-baseline justify-between gap-3">
                                    <span>{formatMonth(month.month)}</span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {t('staff.leave.days', { count: month.days })}
                                        {isUnpaid && member && (
                                            <span className="ms-2 font-medium text-destructive">−{formatMoney((member.grossSalary / month.daysInMonth) * month.days, currency)}</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold">{t('staff.leaveForm.summary.next')}</span>
                    <ol className="flex flex-col gap-2">
                        {[1, 2, 3].map((step) => (
                            <li key={step} className="flex gap-2.5 text-[0.8125rem] text-pretty text-muted-foreground">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-foreground tabular-nums">
                                    {formatNumber(step)}
                                </span>
                                {t(`staff.leaveForm.summary.${mode}Steps.${step}`)}
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </SectionCard>
    );
}

/**
 * Leave on one page: asked for by a staff member for themselves (`ask`),
 * or given by a manager to one of the staff (`give`), who also says whether
 * it is paid and saves it approved. The days must fall while they are
 * employed; quick lengths fill the last day from the first.
 */
export default function LeaveForm({ mode, staff, types, defaults, currency, today }) {
    const { t } = useTranslation();
    const { roleName } = useStaffNames();
    const isGiving = mode === 'give';
    const form = useForm({ staff_member_id: defaults.staff_member_id, type: 'annual', starts_on: '', ends_on: '', reason: '', is_paid: null });
    const { data, setData, errors, processing } = form;
    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });
    const member = staff.find((option) => option.id === data.staff_member_id) ?? null;
    const listHref = isGiving ? route('leave.index') : route('my.leave');
    const title = t(isGiving ? 'staff.leaveForm.giveTitle' : 'staff.leaveForm.askTitle');

    // A first day after the last moves the last day with it.
    const chooseStart = (value) => setData((current) => ({ ...current, starts_on: value, ends_on: current.ends_on && current.ends_on < value ? value : current.ends_on }));

    const submit = () => {
        if (isGiving) {
            form.transform((values) => ({ ...values, is_paid: values.is_paid === null ? null : values.is_paid === 'paid' }));
            form.post(route('leave.store'));
        } else {
            form.transform(({ type, starts_on, ends_on, reason }) => ({ type, starts_on, ends_on, reason }));
            form.post(route('my.leave.store'));
        }
    };

    return (
        <DashboardLayout>
            <Head title={title} />

            <FormShell
                breadcrumbs={[{ label: t('nav.staffMenu') }, { label: t(isGiving ? 'staff.leave.title' : 'staff.myLeave.title'), href: listHref }, { label: title }]}
                title={title}
                description={t(isGiving ? 'staff.leaveForm.giveDescription' : 'staff.leaveForm.askDescription')}
                cancelHref={listHref}
                submitLabel={t(isGiving ? 'staff.leaveForm.give' : 'staff.leaveForm.send')}
                processing={processing}
                onSubmit={submit}
                aside={<Summary mode={mode} member={member} data={data} currency={currency} />}
            >
                {isGiving && (
                    <FormSection title={t('staff.leaveForm.who.title')} description={t('staff.leaveForm.who.description')}>
                        <SelectField
                            {...bind('staff_member_id')}
                            label={t('staff.leaveForm.fields.staff')}
                            placeholder={t('staff.leaveForm.fields.chooseStaff')}
                            items={staff.map((option) => ({ value: option.id, label: `${option.name} · ${roleName(option.role)}` }))}
                        />
                    </FormSection>
                )}

                <FormSection title={t('staff.leaveForm.when.title')} description={t('staff.leaveForm.when.description')}>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <ChoiceField
                            id="type"
                            label={t('staff.leaveForm.fields.type')}
                            value={data.type}
                            onChange={(value) => setData('type', value)}
                            options={types.map((type) => ({ value: type, label: t(`staff.leave.types.${type}`), icon: LEAVE_TYPE_ICONS[type] }))}
                            error={errors.type}
                            className="sm:col-span-2"
                        />
                        <TextField
                            {...bind('starts_on')}
                            onChange={chooseStart}
                            type="date"
                            min={member?.joinedOn}
                            max={member?.leftOn ?? undefined}
                            label={t('staff.leaveForm.fields.startsOn')}
                        />
                        <TextField
                            {...bind('ends_on')}
                            type="date"
                            min={data.starts_on || member?.joinedOn}
                            max={member?.leftOn ?? undefined}
                            label={t('staff.leaveForm.fields.endsOn')}
                        />
                        <div className="flex flex-col gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">{t('staff.leaveForm.lengths.label')}</span>
                            <div className="flex flex-wrap gap-2">
                                {LENGTHS.map((length) => {
                                    const start = data.starts_on || today;
                                    const end = endAfter(start, length);
                                    const isChosen = data.starts_on !== '' && data.ends_on === end;

                                    return (
                                        <Button
                                            key={length.key}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            aria-pressed={isChosen}
                                            className={cn(isChosen && 'border-primary bg-primary/5 text-primary')}
                                            onClick={() => setData((current) => ({ ...current, starts_on: start, ends_on: end }))}
                                        >
                                            {t(`staff.leaveForm.lengths.${length.key}`)}
                                        </Button>
                                    );
                                })}
                            </div>
                            <span className="text-xs text-muted-foreground">{t('staff.leaveForm.lengths.hint')}</span>
                        </div>
                        <TextareaField
                            {...bind('reason')}
                            label={t('staff.leaveForm.fields.reason')}
                            description={t(isGiving ? 'staff.leaveForm.fields.reasonGiveHint' : 'staff.leaveForm.fields.reasonHint')}
                            optional
                            className="sm:col-span-2"
                        />
                    </FieldGroup>
                </FormSection>

                {isGiving && (
                    <FormSection title={t('staff.leaveForm.pay.title')} description={t('staff.leaveForm.pay.description')}>
                        <ChoiceField
                            id="is_paid"
                            label={t('staff.leaveForm.fields.pay')}
                            value={data.is_paid}
                            onChange={(value) => setData('is_paid', value)}
                            options={[
                                { value: 'paid', label: t('staff.leave.pay.paidLeave'), icon: BanknoteIcon },
                                { value: 'unpaid', label: t('staff.leave.pay.unpaidLeave'), icon: BanknoteXIcon },
                            ]}
                            description={data.is_paid && t(`staff.leave.pay.${data.is_paid}Hint`)}
                            error={errors.is_paid}
                        />
                    </FormSection>
                )}
            </FormShell>
        </DashboardLayout>
    );
}
