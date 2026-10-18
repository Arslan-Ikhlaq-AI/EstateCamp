import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BedDoubleIcon,
    BedSingleIcon,
    Building2Icon,
    EyeIcon,
    LogInIcon,
    LogOutIcon,
    MarsIcon,
    PencilIcon,
    UserPlusIcon,
    UserRoundXIcon,
    UsersIcon,
    VenusIcon,
} from 'lucide-react';

const STATUS_ICONS = { staying: BedDoubleIcon, not_staying: UserRoundXIcon };
const GENDER_ICONS = { male: MarsIcon, female: VenusIcon };

export default function Index({ company, filters, facets, summary, occupants }) {
    const { t, formatNumber, formatDate } = useTranslation();
    const title = t('leasing.occupants.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('occupants.create')} />}>
            <UserPlusIcon data-icon="inline-start" />
            {t('leasing.occupants.add')}
        </Button>
    );

    const columns = [
        {
            id: 'name',
            header: t('leasing.occupants.columns.name'),
            cell: (occupant) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('occupants.show', occupant.id)} dir="auto" className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {occupant.name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">
                        {[t(`gender.${occupant.gender}`), occupant.nationality].filter(Boolean).join(' · ')}
                    </span>
                </div>
            ),
        },
        {
            id: 'client',
            header: t('leasing.occupants.columns.client'),
            cell: (occupant) => (
                <div className="flex max-w-56 flex-col">
                    <Link href={route('clients.show', occupant.client.id)} dir="auto" className="truncate underline-offset-4 hover:text-brand-ink hover:underline">
                        {occupant.client.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{occupant.employeeNumber || '—'}</span>
                </div>
            ),
        },
        {
            id: 'id',
            header: t('leasing.occupants.columns.id'),
            cell: (occupant) =>
                occupant.idNumber ? (
                    <div className="flex flex-col">
                        <span className="font-mono text-sm">{occupant.idNumber}</span>
                        <span className="text-xs text-muted-foreground">{t(`leasing.idTypes.${occupant.idType}`)}</span>
                    </div>
                ) : (
                    '—'
                ),
        },
        {
            id: 'stay',
            header: t('leasing.occupants.columns.stay'),
            cell: (occupant) =>
                occupant.stay ? (
                    <div className="flex flex-col text-sm">
                        <span>{t('leasing.common.roomBed', { room: occupant.stay.roomNumber, bed: occupant.stay.bedLabel })}</span>
                        <span className="text-xs text-muted-foreground" dir="auto">
                            {occupant.stay.property.name} · {t('leasing.occupants.sinceDate', { date: formatDate(occupant.stay.checkInDate) })}
                        </span>
                    </div>
                ) : (
                    <ToneBadge tone="muted">{t('leasing.occupants.notStaying')}</ToneBadge>
                ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: title }]}
                title={title}
                count={occupants?.total}
                description={t('leasing.occupants.description')}
                actions={
                    company && (
                        <>
                            <Button variant="outline" nativeButton={false} render={<Link href={route('occupancies.create')} />}>
                                <LogInIcon data-icon="inline-start" />
                                {t('leasing.checkIn.button')}
                            </Button>
                            {addButton}
                        </>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={UsersIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.occupants.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard icon={BedDoubleIcon} label={t('leasing.occupants.stats.staying')} value={formatNumber(summary.staying)} detail={t('leasing.occupants.stats.stayingDetail')} />
                        <StatCard
                            icon={BedSingleIcon}
                            tone={summary.freeBeds > 0 ? 'success' : 'primary'}
                            label={t('leasing.occupants.stats.freeBeds')}
                            value={formatNumber(summary.freeBeds)}
                            detail={t('leasing.occupants.stats.freeBedsDetail')}
                        />
                        <StatCard icon={LogInIcon} label={t('leasing.occupants.stats.checkedIn')} value={formatNumber(summary.checkedIn)} detail={t('leasing.occupants.stats.thisMonth')} />
                        <StatCard icon={LogOutIcon} label={t('leasing.occupants.stats.checkedOut')} value={formatNumber(summary.checkedOut)} detail={t('leasing.occupants.stats.thisMonth')} />
                    </section>

                    <RecordList
                        routeName="occupants.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.occupants.status.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            gender: facets.gender.map((option) => ({ ...option, label: t(`gender.${option.value}`), icon: GENDER_ICONS[option.value] })),
                            clients: facets.clients.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{ status: t('leasing.common.status'), gender: t('leasing.occupants.columns.gender'), clients: t('leasing.occupants.columns.client') }}
                        only={['occupants', 'facets']}
                        paginator={occupants}
                        searchLabel={t('leasing.occupants.searchLabel')}
                        searchPlaceholder={t('leasing.occupants.searchPlaceholder')}
                        empty={<ListEmpty icon={UsersIcon} title={t('leasing.occupants.empty.title')} description={t('leasing.occupants.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={occupants.data}
                            actions={(occupant) => (
                                <RowActions
                                    label={occupant.name}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('occupants.show', occupant.id), icon: EyeIcon },
                                        { label: t('leasing.common.edit'), href: route('occupants.edit', occupant.id), icon: PencilIcon },
                                        ...(occupant.stay
                                            ? []
                                            : [{ label: t('leasing.checkIn.button'), href: route('occupancies.create', { occupant: occupant.id }), icon: LogInIcon }]),
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
