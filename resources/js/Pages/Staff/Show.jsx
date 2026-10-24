import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { StaffStatusBadge, useCalendarFormat, useStaffNames, Workplace } from '@/Components/StaffBadges';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { CalendarCheckIcon, KeyRoundIcon, PencilIcon } from 'lucide-react';
import AttendanceCalendar from './Partials/AttendanceCalendar';
import { DocumentsCard, SalaryCard, SalaryHistory } from './Partials/StaffCards';

/**
 * Whole years and months from one YYYY-MM-DD day to another.
 */
function yearsAndMonths(from, to) {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);
    const months = (toYear - fromYear) * 12 + (toMonth - fromMonth) - (toDay < fromDay ? 1 : 0);

    return { years: Math.floor(Math.max(months, 0) / 12), months: Math.max(months, 0) % 12 };
}

/**
 * How long someone has worked for the company, or did until they left.
 */
function useServiceLength() {
    const { t } = useTranslation();

    return (joinedOn, leftOn) => {
        const { years, months } = yearsAndMonths(joinedOn, leftOn ?? todayIso());

        if (years === 0 && months === 0) {
            return t('staff.show.underAMonth');
        }

        return [years > 0 && t('staff.show.years', { count: years }), months > 0 && t('staff.show.months', { count: months })].filter(Boolean).join(' ');
    };
}

/**
 * Whether the person can sign in, as whom, and what their sign-in allows.
 */
function SignInCard({ signIn }) {
    const { t } = useTranslation();

    return (
        <SectionCard title={t('staff.show.signIn.title')} action={<KeyRoundIcon className="size-4 text-muted-foreground" />}>
            {signIn ? (
                <div className="flex flex-col gap-4">
                    <DetailList
                        columns={1}
                        rows={[
                            { label: t('staff.show.signIn.email'), value: <span className="break-all">{signIn.email}</span> },
                            {
                                label: t('staff.show.signIn.access'),
                                value: (
                                    <span className="flex flex-col gap-0.5">
                                        <span>{t(`staff.access.levels.${signIn.access}`)}</span>
                                        <span className="text-xs font-normal text-muted-foreground">{t(`staff.access.descriptions.${signIn.access}`)}</span>
                                    </span>
                                ),
                            },
                        ]}
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <Badge variant={signIn.appAccess ? 'info' : 'secondary'}>{signIn.appAccess ? t('staff.access.appShort') : t('staff.access.staffOnly')}</Badge>
                        {signIn.hasEnded && <Badge variant="destructive">{t('staff.show.signIn.ended')}</Badge>}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">{t('staff.show.signIn.none')}</p>
            )}
        </SectionCard>
    );
}

export default function Show({ staff, attendance, salaries, currency, canManage }) {
    const { t, formatDate } = useTranslation();
    const { roleName } = useStaffNames();
    const { formatMonth } = useCalendarFormat();
    const serviceLength = useServiceLength();
    const age = staff.dateOfBirth ? yearsAndMonths(staff.dateOfBirth, todayIso()).years : null;

    return (
        <DashboardLayout>
            <Head title={staff.name} />

            <PageHeader
                breadcrumbs={[{ label: t('staff.title'), href: route('staff.index') }, { label: staff.name }]}
                title={staff.name}
                badge={<StaffStatusBadge status={staff.status} />}
                description={[roleName(staff.role), staff.workplace.type === 'head_office' ? t('staff.levels.head_office') : staff.workplace.name, staff.number]
                    .filter(Boolean)
                    .join(' · ')}
                actions={
                    <>
                        {canManage && (
                            <Button variant="outline" nativeButton={false} render={<Link href={route('staff.edit', staff.id)} />}>
                                <PencilIcon data-icon="inline-start" />
                                {t('leasing.common.edit')}
                            </Button>
                        )}
                        <Button nativeButton={false} render={<Link href={route('attendance.index', { workplace: staff.workplace.key })} />}>
                            <CalendarCheckIcon data-icon="inline-start" />
                            {t('staff.actions.attendance')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('staff.show.job')}>
                        <DetailList
                            rows={[
                                { label: t('staff.columns.role'), value: <span dir="auto">{roleName(staff.role)}</span> },
                                { label: t('staff.show.level'), value: t(`staff.levels.${staff.level}`) },
                                { label: t('staff.columns.workplace'), value: <Workplace workplace={staff.workplace} link /> },
                                { label: t('staff.form.fields.employmentType'), value: t(`staff.employmentTypes.${staff.employmentType}`) },
                                { label: t('staff.show.joined'), value: formatDate(staff.joinedOn) },
                                { label: t('staff.show.service'), value: serviceLength(staff.joinedOn, staff.leftOn) },
                                ...(staff.leftOn ? [{ label: t('staff.show.leftOn'), value: formatDate(staff.leftOn) }] : []),
                                { label: t('staff.show.employeeNumber'), value: <span className="tabular-nums">{staff.number}</span> },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard
                        title={t('staff.show.attendance', { month: formatMonth(attendance.month) })}
                        description={t('staff.show.attendanceDescription')}
                        action={
                            <Button
                                variant="outline"
                                size="sm"
                                nativeButton={false}
                                render={<Link href={route('attendance.index', { view: 'month', month: attendance.month, workplace: staff.workplace.key })} />}
                            >
                                {t('staff.attendance.tabs.month')}
                            </Button>
                        }
                    >
                        <AttendanceCalendar month={attendance.month} days={attendance.days} marks={attendance.marks} counts={attendance.counts} />
                    </SectionCard>

                    <SectionCard title={t('staff.show.salaries')} description={t('staff.show.salariesDescription')} flush>
                        <SalaryHistory salaries={salaries} currency={currency} linkToPayroll empty={t('staff.show.noSalaries')} />
                    </SectionCard>
                </div>

                <div className="flex flex-col gap-6">
                    <SalaryCard salary={staff.salary} currency={currency} />

                    <DocumentsCard documents={staff.documents} />

                    <SignInCard signIn={staff.signIn} />

                    <SectionCard title={t('staff.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('staff.form.fields.gender'), value: t(`staff.genders.${staff.gender}`) },
                                { label: t('staff.form.fields.nationality'), value: staff.nationality },
                                {
                                    label: t('staff.show.born'),
                                    value: staff.dateOfBirth && `${formatDate(staff.dateOfBirth)} · ${t('staff.show.age', { count: age })}`,
                                },
                                {
                                    label: t('staff.form.fields.phone'),
                                    value: staff.phone && (
                                        <a href={`tel:${staff.phone.replace(/\s+/g, '')}`} dir="ltr" className="tabular-nums underline-offset-4 hover:text-brand-ink hover:underline">
                                            {staff.phone}
                                        </a>
                                    ),
                                },
                                {
                                    label: t('staff.form.fields.email'),
                                    value: staff.email && (
                                        <a href={`mailto:${staff.email}`} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {staff.email}
                                        </a>
                                    ),
                                },
                                { label: t('staff.show.addedBy'), value: staff.createdBy },
                            ]}
                        />
                    </SectionCard>

                    {(staff.emergencyContact.name || staff.emergencyContact.phone) && (
                        <SectionCard title={t('staff.show.emergency')}>
                            <DetailList
                                columns={1}
                                rows={[
                                    { label: t('staff.form.fields.emergencyName'), value: staff.emergencyContact.name },
                                    { label: t('staff.form.fields.emergencyPhone'), value: staff.emergencyContact.phone && <span dir="ltr" className="tabular-nums">{staff.emergencyContact.phone}</span> },
                                ]}
                            />
                        </SectionCard>
                    )}

                    {staff.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                                {staff.notes}
                            </p>
                        </SectionCard>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
