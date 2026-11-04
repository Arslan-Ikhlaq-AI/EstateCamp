import ActionDialog from '@/Components/ActionDialog';
import { SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { ListEmpty } from '@/Components/RecordList';
import { useStaffNames } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router } from '@inertiajs/react';
import { BanknoteIcon, BanknoteXIcon, CalendarPlusIcon, HourglassIcon, PlaneIcon, TreePalmIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';
import { LeavePayBadge, LeaveStatusBadge, LeaveType, useLeaveSpan } from './Partials/LeaveParts';
import { NoStaffRecord } from './Partials/StaffCards';

/**
 * One leave of theirs: its kind, days and reason, where it stands and any
 * note from whoever decided it; a request still waiting can be withdrawn.
 */
function LeaveItem({ leave, onWithdraw }) {
    const { t, formatDate } = useTranslation();
    const span = useLeaveSpan();

    return (
        <li className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:gap-6 lg:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <LeaveType type={leave.type} className="font-semibold" />
                    <span className="text-muted-foreground tabular-nums">{span(leave)}</span>
                    <span className="font-medium tabular-nums">{t('staff.leave.days', { count: leave.days })}</span>
                </div>
                {leave.reason && (
                    <p dir="auto" className="text-[0.8125rem] text-pretty text-muted-foreground">
                        {leave.reason}
                    </p>
                )}
                {leave.decisionNote && (
                    <p dir="auto" className="rounded-lg bg-muted/60 px-3 py-2 text-[0.8125rem] text-pretty">
                        <span className="font-medium">{leave.decidedBy ?? t('staff.myLeave.manager')}: </span>
                        {leave.decisionNote}
                    </p>
                )}
                <span className="text-xs text-muted-foreground">
                    {leave.isRequest ? t('staff.myLeave.askedOn', { date: formatDate(leave.requestedOn) }) : t('staff.myLeave.givenOn', { date: formatDate(leave.requestedOn) })}
                    {leave.decidedOn && leave.isRequest && ` · ${t(`staff.myLeave.decided.${leave.status}`, { date: formatDate(leave.decidedOn) })}`}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                <LeaveStatusBadge status={leave.status} />
                <LeavePayBadge isPaid={leave.isPaid} />
                {leave.status === 'pending' && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onWithdraw(leave)}>
                        <Undo2Icon data-icon="inline-start" />
                        {t('staff.myLeave.withdraw')}
                    </Button>
                )}
            </div>
        </li>
    );
}

/**
 * A staff member's own leave: asking for it, this year's paid and unpaid
 * days and their next leave, and everything they asked for or were given
 * with what became of it.
 */
export default function MyLeave({ staff, leaves, summary }) {
    const { t, formatNumber } = useTranslation();
    const { roleName, workplaceName } = useStaffNames();
    const span = useLeaveSpan();
    const [withdrawing, setWithdrawing] = useState(null);
    const [processing, setProcessing] = useState(false);
    const title = t('staff.myLeave.title');
    const breadcrumbs = [{ label: t('nav.staffMenu') }, { label: title }];

    if (!staff) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={breadcrumbs} title={title} />
                <NoStaffRecord />
            </DashboardLayout>
        );
    }

    const askButton = (
        <Button variant="brand" nativeButton={false} render={<Link href={route('my.leave.create')} />}>
            <CalendarPlusIcon data-icon="inline-start" />
            {t('staff.myLeave.ask')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={breadcrumbs}
                title={title}
                description={[staff.name, roleName(staff.role), workplaceName(staff.workplace)].filter(Boolean).join(' · ')}
                actions={askButton}
            />

            <FlashMessages errorKeys={['leave']} />

            <section aria-label={t('staff.myLeave.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={HourglassIcon}
                    tone="warning"
                    label={t('staff.myLeave.stats.pending')}
                    value={formatNumber(summary.pending)}
                    detail={t(summary.pending > 0 ? 'staff.myLeave.stats.pendingDetail' : 'staff.myLeave.stats.nonePending')}
                />
                <StatCard
                    icon={BanknoteIcon}
                    tone="success"
                    label={t('staff.myLeave.stats.paid', { year: String(summary.year) })}
                    value={formatNumber(summary.paidDays)}
                    detail={t('staff.myLeave.stats.paidDetail')}
                />
                <StatCard
                    icon={BanknoteXIcon}
                    tone="danger"
                    label={t('staff.myLeave.stats.unpaid', { year: String(summary.year) })}
                    value={formatNumber(summary.unpaidDays)}
                    detail={t('staff.myLeave.stats.unpaidDetail')}
                />
                <StatCard
                    icon={PlaneIcon}
                    tone="gold"
                    label={t('staff.myLeave.stats.next')}
                    value={summary.next ? t('staff.leave.days', { count: summary.next.days }) : '—'}
                    detail={summary.next ? span(summary.next) : t('staff.myLeave.stats.noneNext')}
                />
            </section>

            <SectionCard title={t('staff.myLeave.list')} description={t('staff.myLeave.listDescription')} flush>
                {leaves.length === 0 ? (
                    <ListEmpty icon={TreePalmIcon} title={t('staff.myLeave.empty.title')} description={t('staff.myLeave.empty.description')} action={askButton} />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {leaves.map((leave) => (
                            <LeaveItem key={leave.id} leave={leave} onWithdraw={setWithdrawing} />
                        ))}
                    </ul>
                )}
            </SectionCard>

            <ActionDialog
                open={withdrawing !== null}
                onOpenChange={(open) => !open && setWithdrawing(null)}
                destructive
                title={t('staff.myLeave.withdrawConfirm')}
                description={withdrawing ? `${t(`staff.leave.types.${withdrawing.type}`)} · ${span(withdrawing)}` : ''}
                submitLabel={t('staff.myLeave.withdraw')}
                processing={processing}
                onSubmit={() =>
                    router.post(
                        route('my.leave.cancel', withdrawing.id),
                        {},
                        { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: () => setWithdrawing(null) },
                    )
                }
            />
        </DashboardLayout>
    );
}
