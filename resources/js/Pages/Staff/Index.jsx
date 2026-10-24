import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import { LEVEL_ICONS, StaffAvatar, StaffStatusBadge, useStaffNames, Workplace } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    CalendarCheckIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ContactRoundIcon,
    EyeIcon,
    IdCardIcon,
    KeyRoundIcon,
    PencilIcon,
    PlusIcon,
    TreePalmIcon,
    UserRoundXIcon,
} from 'lucide-react';

const STATUS_ICONS = { active: CircleCheckIcon, on_leave: TreePalmIcon, resigned: UserRoundXIcon, terminated: CircleSlashIcon };
const WORKPLACE_ICONS = { head_office: LEVEL_ICONS.head_office, office: LEVEL_ICONS.regional, property: LEVEL_ICONS.site };

export default function Index({ company, filters, facets, summary, staff, canManage }) {
    const { t, formatNumber, formatMoney, formatCurrency, formatDate } = useTranslation();
    const { roleName } = useStaffNames();
    const title = t('staff.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('staff.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('staff.add')}
        </Button>
    );

    const columns = [
        {
            id: 'staff',
            header: t('staff.columns.staff'),
            cell: (member) => (
                <div className="flex min-w-0 items-center gap-3">
                    <StaffAvatar name={member.name} />
                    <div className="flex min-w-0 flex-col">
                        <Link href={route('staff.show', member.id)} dir="auto" className="max-w-64 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {member.name}
                        </Link>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            {[member.number, member.nationality].filter(Boolean).join(' · ')}
                            {member.hasSignIn && <KeyRoundIcon aria-label={t('staff.signInBadge')} className="size-3 text-brand-ink" />}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            id: 'role',
            header: t('staff.columns.role'),
            cell: (member) => (
                <div className="flex max-w-56 min-w-0 flex-col">
                    <span dir="auto" className="truncate text-sm font-medium">
                        {roleName(member.role)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t(`staff.employmentTypes.${member.employmentType}`)}</span>
                </div>
            ),
        },
        {
            id: 'workplace',
            header: t('staff.columns.workplace'),
            cell: (member) => (
                <div className="flex max-w-56 min-w-0 flex-col">
                    <Workplace workplace={member.workplace} className="text-sm font-medium" />
                    {member.workplace.type !== 'head_office' && <span className="text-xs text-muted-foreground">{t(`staff.levels.${member.level}`)}</span>}
                </div>
            ),
        },
        { id: 'joined', header: t('staff.columns.joined'), cell: (member) => <span className="text-sm tabular-nums">{formatDate(member.joinedOn)}</span> },
        {
            id: 'salary',
            header: t('staff.columns.salary'),
            align: 'end',
            cell: (member) => <span className="font-semibold tabular-nums">{formatMoney(member.grossSalary, company.currency)}</span>,
        },
        {
            id: 'status',
            header: t('staff.columns.status'),
            cell: (member) => (
                <span className="flex items-center gap-1.5">
                    <StaffStatusBadge status={member.status} />
                    {member.documentAlert && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <span
                                        tabIndex={0}
                                        aria-label={t(`staff.documentAlert.${member.documentAlert}`)}
                                        className={cn(
                                            'flex size-5.5 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                                            member.documentAlert === 'expired' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
                                        )}
                                    />
                                }
                            >
                                <IdCardIcon className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>{t(`staff.documentAlert.${member.documentAlert}`)}</TooltipContent>
                        </Tooltip>
                    )}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: title }]}
                title={title}
                count={staff?.total}
                description={t('staff.description')}
                actions={
                    company && (
                        <>
                            <Button variant="outline" nativeButton={false} render={<Link href={route('attendance.index')} />}>
                                <CalendarCheckIcon data-icon="inline-start" />
                                {t('staff.actions.attendance')}
                            </Button>
                            {canManage && addButton}
                        </>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={ContactRoundIcon} />
            ) : (
                <>
                    <section aria-label={t('staff.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={ContactRoundIcon}
                            label={t('staff.stats.active')}
                            value={formatNumber(summary.active)}
                            detail={t('staff.stats.activeDetail', { onLeave: summary.onLeave, left: summary.left })}
                            href={route('staff.index', { status: ['active'] })}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            tone="gold"
                            label={t('staff.stats.salaries')}
                            value={formatCurrency(summary.monthlySalaries, company.currency)}
                            detail={t('staff.stats.salariesDetail')}
                            href={route('payroll.index')}
                        />
                        <StatCard
                            icon={CalendarCheckIcon}
                            tone="success"
                            label={t('staff.stats.today')}
                            value={formatNumber(summary.today.present)}
                            meter={summary.today.employed > 0 ? (summary.today.marked / summary.today.employed) * 100 : 0}
                            detail={
                                summary.today.marked > 0
                                    ? t('staff.stats.todayDetail', { marked: summary.today.marked, employed: summary.today.employed, absent: summary.today.absent })
                                    : t('staff.stats.todayNone')
                            }
                            href={route('attendance.index')}
                        />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone={summary.documents.expired + summary.documents.expiring > 0 ? 'warning' : 'success'}
                            label={t('staff.stats.documents')}
                            value={formatNumber(summary.documents.expired + summary.documents.expiring)}
                            detail={
                                summary.documents.expired + summary.documents.expiring > 0
                                    ? t('staff.stats.documentsDetail', { expired: summary.documents.expired })
                                    : t('staff.stats.documentsNone')
                            }
                            href={route('staff.index', { documents: ['expired', 'expiring'] })}
                        />
                    </section>

                    <RecordList
                        routeName="staff.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`staff.statuses.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            level: facets.level.map((option) => ({ ...option, label: t(`staff.levels.${option.value}`), icon: LEVEL_ICONS[option.value] })),
                            roles: facets.roles.map((option) => ({ ...option, label: roleName({ slug: option.value, name: option.label }), icon: LEVEL_ICONS[option.level] })),
                            workplace: facets.workplace.map((option) => ({
                                ...option,
                                label: option.type === 'head_office' ? t('staff.levels.head_office') : option.label,
                                icon: WORKPLACE_ICONS[option.type],
                            })),
                            documents: facets.documents.map((option) => ({ ...option, label: t(`staff.documentFilters.${option.value}`), icon: IdCardIcon })),
                        }}
                        labels={{
                            status: t('staff.filters.status'),
                            level: t('staff.filters.level'),
                            roles: t('staff.filters.roles'),
                            workplace: t('staff.filters.workplace'),
                            documents: t('staff.filters.documents'),
                        }}
                        only={['staff', 'facets']}
                        paginator={staff}
                        searchLabel={t('staff.searchLabel')}
                        searchPlaceholder={t('staff.searchPlaceholder')}
                        empty={<ListEmpty icon={ContactRoundIcon} title={t('staff.empty.title')} description={t('staff.empty.description')} action={canManage && addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={staff.data}
                            actions={(member) => (
                                <RowActions
                                    label={t('staff.actions.menu', { name: member.name })}
                                    items={[
                                        { label: t('staff.actions.view'), href: route('staff.show', member.id), icon: EyeIcon },
                                        ...(canManage ? [{ label: t('staff.actions.edit'), href: route('staff.edit', member.id), icon: PencilIcon }] : []),
                                        {
                                            label: t('staff.actions.attendance'),
                                            href: route('attendance.index', { workplace: member.workplace.key }),
                                            icon: CalendarCheckIcon,
                                        },
                                    ]}
                                />
                            )}
                        />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
