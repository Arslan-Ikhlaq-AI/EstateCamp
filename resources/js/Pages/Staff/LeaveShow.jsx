import ActionDialog from '@/Components/ActionDialog';
import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { ChoiceField, TextareaField } from '@/Components/FormFields';
import PageHeader from '@/Components/PageHeader';
import { SalaryStatusBadge, StaffAvatar, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { BanknoteIcon, BanknoteXIcon, CircleCheckIcon, CircleSlashIcon, CircleXIcon, InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { LeavePayBadge, LeaveStatusBadge, LeaveType, useLeaveSpan } from './Partials/LeaveParts';

/**
 * Approve the request as paid or unpaid, or reject it, with a note the
 * staff member sees.
 */
function DecisionCard({ leave, staff }) {
    const { t } = useTranslation();
    const form = useForm({ is_paid: null, decision_note: '' });
    const { data, setData, errors, processing } = form;
    const [sending, setSending] = useState(null);

    const decide = (action) => {
        setSending(action);
        form.transform((values) => ({ decision_note: values.decision_note, ...(action === 'approve' ? { is_paid: values.is_paid === null ? null : values.is_paid === 'paid' } : {}) }));
        form.post(route(`leave.${action}`, leave.id), { preserveScroll: true, onFinish: () => setSending(null) });
    };

    return (
        <SectionCard title={t('staff.leave.decide.title')} description={t(leave.isRequest ? 'staff.leave.decide.description' : 'staff.leave.decide.descriptionGiven', { name: staff.name })}>
            <FieldGroup className="gap-4">
                <ChoiceField
                    id="is_paid"
                    label={t('staff.leaveForm.fields.pay')}
                    value={data.is_paid}
                    onChange={(value) => setData('is_paid', value)}
                    options={[
                        { value: 'paid', label: t('staff.leave.pay.paidLeave'), icon: BanknoteIcon },
                        { value: 'unpaid', label: t('staff.leave.pay.unpaidLeave'), icon: BanknoteXIcon },
                    ]}
                    description={data.is_paid ? t(`staff.leave.pay.${data.is_paid}Hint`) : t('staff.leave.decide.payHint')}
                    error={errors.is_paid}
                />
                <TextareaField
                    id="decision_note"
                    label={t('staff.leave.decide.note', { name: staff.name })}
                    value={data.decision_note}
                    onChange={(value) => setData('decision_note', value)}
                    error={errors.decision_note}
                    optional
                    rows={2}
                />
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="brand" disabled={processing} onClick={() => decide('approve')}>
                        {sending === 'approve' ? <Spinner data-icon="inline-start" /> : <CircleCheckIcon data-icon="inline-start" />}
                        {t('staff.leave.decide.approve')}
                    </Button>
                    <Button type="button" variant="outline" className="text-destructive" disabled={processing} onClick={() => decide('reject')}>
                        {sending === 'reject' ? <Spinner data-icon="inline-start" /> : <CircleXIcon data-icon="inline-start" />}
                        {t('staff.leave.decide.reject')}
                    </Button>
                </div>
            </FieldGroup>
        </SectionCard>
    );
}

/**
 * Call off approved leave, after asking: its days leave attendance and the
 * salaries not yet paid are worked out again.
 */
function CancelCard({ leave, staff }) {
    const { t } = useTranslation();
    const [isOpen, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    return (
        <SectionCard title={t('staff.leave.cancel.title')} description={t('staff.leave.cancel.description')}>
            <Button type="button" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
                <CircleSlashIcon data-icon="inline-start" />
                {t('staff.leave.cancel.button')}
            </Button>
            <ActionDialog
                open={isOpen}
                onOpenChange={setOpen}
                destructive
                title={t('staff.leave.cancel.confirm', { name: staff.name })}
                description={t(leave.isPaid === false ? 'staff.leave.cancel.confirmUnpaid' : 'staff.leave.cancel.confirmPaid')}
                submitLabel={t('staff.leave.cancel.button')}
                processing={processing}
                onSubmit={() =>
                    router.post(route('leave.cancel', leave.id), {}, { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: () => setOpen(false) })
                }
            />
        </SectionCard>
    );
}

/**
 * The leave's days month by month, and what each month's salary loses if
 * the leave is (or would be) unpaid, with whether that salary is paid yet.
 */
function MonthsCard({ leave, months, staff, currency }) {
    const { t, formatMoney } = useTranslation();
    const { formatMonth } = useCalendarFormat();
    const isOpen = leave.status === 'pending' || leave.status === 'approved';
    const isUnpaid = leave.status === 'approved' && leave.isPaid === false;

    const effect = (month) => {
        if (leave.status === 'approved') {
            return leave.isPaid ? (
                <span className="text-muted-foreground">{t('staff.leave.show.noDeduction')}</span>
            ) : (
                <span className="font-semibold text-destructive tabular-nums">−{formatMoney(month.unpaidCost, currency)}</span>
            );
        }

        return leave.status === 'pending' ? (
            <span className="text-muted-foreground tabular-nums">{t('staff.leave.show.ifUnpaid', { amount: formatMoney(month.unpaidCost, currency) })}</span>
        ) : (
            <span className="text-muted-foreground">—</span>
        );
    };

    return (
        <SectionCard title={t('staff.leave.show.months')} description={t('staff.leave.show.monthsDescription', { pay: formatMoney(staff.grossSalary, currency) })} flush>
            <DataTable
                rowKey="month"
                rows={months}
                columns={[
                    { id: 'month', header: t('staff.leave.show.columns.month'), cell: (month) => <span className="font-medium whitespace-nowrap">{formatMonth(month.month)}</span> },
                    {
                        id: 'days',
                        header: t('staff.leave.show.columns.days'),
                        cell: (month) => <span className="tabular-nums">{t('staff.leave.show.daysOf', { count: month.days, total: month.daysInMonth })}</span>,
                    },
                    { id: 'effect', header: t('staff.leave.show.columns.salary'), align: 'end', cell: effect },
                    {
                        id: 'payroll',
                        header: t('staff.leave.show.columns.payroll'),
                        cell: (month) => (
                            <span className="flex flex-col gap-1">
                                {month.salary ? <SalaryStatusBadge status={month.salary.status} /> : <span className="text-sm text-muted-foreground">{t('staff.leave.show.notPrepared')}</span>}
                                {isOpen && month.salary?.status === 'paid' && (leave.status === 'pending' || isUnpaid) && (
                                    <span className="text-xs text-warning">{t('staff.leave.show.alreadyPaid')}</span>
                                )}
                            </span>
                        ),
                    },
                ]}
            />
        </SectionCard>
    );
}

/**
 * One leave: who it is for, its days, the reason and the decision; its
 * days month by month with what unpaid leave costs each month's salary;
 * the person's other leave; and, for a manager, the decision to make or
 * the way to call approved leave off.
 */
export default function LeaveShow({ leave, staff, months, history, currency, canManage, isOwn }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const { roleName } = useStaffNames();
    const span = useLeaveSpan();
    const title = t('staff.leave.show.title', { name: staff.name });

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.staffMenu') }, { label: t('staff.leave.title'), href: route('leave.index') }, { label: staff.name }]}
                title={title}
                badge={<LeaveStatusBadge status={leave.status} />}
                description={[t(`staff.leave.types.${leave.type}`), span(leave), t('staff.leave.days', { count: leave.days })].join(' · ')}
            />

            <FlashMessages errorKeys={['leave']} />

            {isOwn && (
                <Alert>
                    <InfoIcon />
                    <AlertDescription>{t('staff.leave.show.own')}</AlertDescription>
                </Alert>
            )}

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('staff.leave.show.details')}>
                        <DetailList
                            rows={[
                                { label: t('staff.leaveForm.fields.type'), value: <LeaveType type={leave.type} /> },
                                { label: t('staff.leave.show.length'), value: t('staff.leave.days', { count: leave.days }) },
                                { label: t('staff.leaveForm.fields.startsOn'), value: formatDate(leave.startsOn) },
                                { label: t('staff.leaveForm.fields.endsOn'), value: formatDate(leave.endsOn) },
                                {
                                    label: t('staff.leave.show.status'),
                                    value: (
                                        <span className="flex flex-wrap gap-2">
                                            <LeaveStatusBadge status={leave.status} />
                                            <LeavePayBadge isPaid={leave.isPaid} />
                                        </span>
                                    ),
                                },
                                {
                                    label: t(leave.isRequest ? 'staff.leave.show.askedOn' : 'staff.leave.show.givenOn'),
                                    value: leave.isRequest ? formatDate(leave.requestedOn) : [formatDate(leave.requestedOn), leave.requestedBy].filter(Boolean).join(' · '),
                                },
                                ...(leave.decidedOn && leave.isRequest
                                    ? [{ label: t(`staff.leave.show.decided.${leave.status}`), value: [formatDate(leave.decidedOn), leave.decidedBy].filter(Boolean).join(' · ') }]
                                    : []),
                            ]}
                        />
                        {(leave.reason || leave.decisionNote) && (
                            <div className="mt-5 flex flex-col gap-3 border-t pt-5">
                                {leave.reason && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">{t('staff.leaveForm.fields.reason')}</span>
                                        <p dir="auto" className="text-sm whitespace-pre-line">
                                            {leave.reason}
                                        </p>
                                    </div>
                                )}
                                {leave.decisionNote && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground">{t('staff.leave.show.decisionNote')}</span>
                                        <p dir="auto" className="text-sm whitespace-pre-line">
                                            {leave.decisionNote}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </SectionCard>

                    <MonthsCard leave={leave} months={months} staff={staff} currency={currency} />

                    <SectionCard title={t('staff.leave.show.history')} description={t('staff.leave.show.historyTotals', { year: String(history.year), paid: history.paidDays, unpaid: history.unpaidDays })}>
                        {history.recent.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('staff.leave.show.noHistory')}</p>
                        ) : (
                            <ul className="-my-2 flex flex-col divide-y">
                                {history.recent.map((other) => (
                                    <li key={other.id}>
                                        <Link href={route('leave.show', other.id)} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-brand-ink">
                                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <LeaveType type={other.type} className="font-medium" />
                                                <span className="text-muted-foreground tabular-nums">{span(other)}</span>
                                                <span className="tabular-nums">{t('staff.leave.days', { count: other.days })}</span>
                                            </span>
                                            <span className="flex gap-2">
                                                <LeaveStatusBadge status={other.status} />
                                                <LeavePayBadge isPaid={other.isPaid} />
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </div>

                <aside className="flex flex-col gap-6 xl:sticky xl:top-20">
                    <SectionCard title={t('staff.leave.show.staff')}>
                        <div className="flex flex-col gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <StaffAvatar name={staff.name} className="size-11" />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    {staff.isRemoved ? (
                                        <span dir="auto" className="truncate font-semibold">
                                            {staff.name}
                                        </span>
                                    ) : (
                                        <Link href={route('staff.show', staff.id)} dir="auto" className="truncate font-semibold underline-offset-4 hover:text-brand-ink hover:underline">
                                            {staff.name}
                                        </Link>
                                    )}
                                    <span dir="auto" className="truncate text-[0.8125rem] text-muted-foreground">
                                        {roleName(staff.role)} · {staff.number}
                                    </span>
                                    <Workplace workplace={staff.workplace} className="text-[0.8125rem] text-muted-foreground" />
                                </div>
                            </div>
                            <DetailList
                                rows={[
                                    { label: t('staff.columns.salary'), value: <span className="tabular-nums">{formatMoney(staff.grossSalary, currency)}</span> },
                                    { label: t('staff.columns.joined'), value: formatDate(staff.joinedOn) },
                                ]}
                            />
                        </div>
                    </SectionCard>

                    {canManage && leave.status === 'pending' && <DecisionCard leave={leave} staff={staff} />}

                    {canManage && leave.status === 'approved' && <CancelCard leave={leave} staff={staff} />}
                </aside>
            </div>
        </DashboardLayout>
    );
}
