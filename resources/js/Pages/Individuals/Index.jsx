import DataTable from '@/Components/DataTable';
import { RentStandingBadge, useRentalPlace } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import { ClientStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    CircleAlertIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    DoorOpenIcon,
    EyeIcon,
    KeyRoundIcon,
    PencilIcon,
    UserPlusIcon,
    UserRoundIcon,
    UserRoundXIcon,
    WalletIcon,
} from 'lucide-react';

const RENTING_ICONS = { renting: KeyRoundIcon, not_renting: UserRoundXIcon };
const STATUS_ICONS = { active: CircleCheckIcon, inactive: CirclePauseIcon };

/**
 * Individuals: the people who rent rooms for themselves, with the rooms
 * they rent short-term now and where their rent stands.
 */
export default function Index({ company, filters, facets, summary, individuals }) {
    const { t, formatNumber, formatCurrency, formatMoney, formatDate } = useTranslation();
    const place = useRentalPlace();
    const title = t('leasing.individuals.title');

    const rentButton = (
        <Button nativeButton={false} render={<Link href={route('rentals.create', { type: 'individual' })} />}>
            <KeyRoundIcon data-icon="inline-start" />
            {t('leasing.individuals.rentRooms')}
        </Button>
    );

    const actions = (
        <>
            <Button variant="outline" nativeButton={false} render={<Link href={route('clients.create', { type: 'individual' })} />}>
                <UserPlusIcon data-icon="inline-start" />
                {t('leasing.individuals.add')}
            </Button>
            {rentButton}
        </>
    );

    const columns = [
        {
            id: 'person',
            header: t('leasing.individuals.columns.person'),
            cell: (person) => (
                <div className="flex max-w-56 min-w-0 flex-col">
                    <span className="flex items-center gap-1.5">
                        <Link href={route('clients.show', person.id)} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {person.name}
                        </Link>
                        {person.status !== 'active' && <ClientStatusBadge status={person.status} />}
                    </span>
                    <span className="truncate text-xs text-muted-foreground tabular-nums">{person.phone || person.email || '—'}</span>
                </div>
            ),
        },
        {
            id: 'id',
            header: t('leasing.individuals.columns.id'),
            cell: (person) => (
                <div className="flex flex-col">
                    <span className="font-mono text-[0.8125rem]">{person.idNumber || '—'}</span>
                    <span className="text-xs text-muted-foreground">
                        {[person.idType && t(`leasing.idTypes.${person.idType}`), person.nationality].filter(Boolean).join(' · ')}
                    </span>
                </div>
            ),
        },
        {
            id: 'renting',
            header: t('leasing.individuals.columns.renting'),
            cell: (person) =>
                person.rentals.length > 0 ? (
                    <ul className="flex max-w-64 flex-col gap-1.5">
                        {person.rentals.map((rental) => (
                            <li key={rental.id} className="flex min-w-0 flex-col">
                                <span className="flex items-center gap-1.5">
                                    <DoorOpenIcon className="size-3.5 shrink-0 text-brand-ink" />
                                    <span className="truncate font-medium">{place(rental)}</span>
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    <Link href={route('rentals.show', rental.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                        {rental.number}
                                    </Link>
                                    {' · '}
                                    <span dir="auto">{rental.property?.name}</span>
                                    {rental.endDate && (
                                        <span className={cn(rental.termOver && 'text-destructive')}> · {t('leasing.individuals.until', { date: formatDate(rental.endDate) })}</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">{t('leasing.individuals.noRental')}</span>
                        {person.pastRentals > 0 && <span className="text-xs text-muted-foreground">{t('leasing.individuals.pastRentals', { count: person.pastRentals })}</span>}
                        {person.activeContracts > 0 && <span className="text-xs text-muted-foreground">{t('leasing.individuals.contracts', { count: person.activeContracts })}</span>}
                    </div>
                ),
        },
        {
            id: 'rent',
            header: t('leasing.individuals.columns.rent'),
            align: 'end',
            cell: (person) => (
                <div className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{person.monthlyRent > 0 ? formatMoney(person.monthlyRent, company.currency) : '—'}</span>
                    {person.rooms > 0 && <span className="text-xs text-muted-foreground">{t('leasing.individuals.rooms', { count: person.rooms })}</span>}
                </div>
            ),
        },
        {
            id: 'standing',
            header: t('leasing.individuals.columns.standing'),
            cell: (person) =>
                person.standing ? (
                    <div className="flex flex-col items-start gap-0.5">
                        <RentStandingBadge standing={person.standing} />
                        {person.owed > 0 && (
                            <span className={cn('text-xs tabular-nums', person.standing === 'overdue' ? 'text-destructive' : 'text-muted-foreground')}>
                                {t('finance.rentals.owes', { amount: formatMoney(person.owed, company.currency) })}
                            </span>
                        )}
                    </div>
                ) : (
                    '—'
                ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: title }]}
                title={title}
                count={summary?.individuals}
                description={t('leasing.individuals.description')}
                actions={company && actions}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={UserRoundIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.individuals.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={UserRoundIcon}
                            label={t('leasing.individuals.stats.individuals')}
                            value={formatNumber(summary.individuals)}
                            detail={t('leasing.individuals.stats.individualsDetail', { count: formatNumber(summary.renting) })}
                            href={route('individuals.index', { renting: ['renting'] })}
                        />
                        <StatCard
                            icon={DoorOpenIcon}
                            label={t('leasing.individuals.stats.rooms')}
                            value={formatNumber(summary.rooms)}
                            detail={t('leasing.individuals.stats.roomsDetail')}
                            href={route('rentals.index', { types: ['individual'], status: ['active'] })}
                        />
                        <StatCard
                            icon={WalletIcon}
                            tone="gold"
                            label={t('leasing.individuals.stats.monthlyRent')}
                            value={formatCurrency(summary.monthlyRent, company.currency)}
                            detail={t('leasing.individuals.stats.monthlyRentDetail')}
                        />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone={summary.owed.count > 0 ? 'warning' : 'success'}
                            label={t('leasing.individuals.stats.owed')}
                            value={formatCurrency(summary.owed.amount, company.currency)}
                            detail={
                                summary.owed.count > 0
                                    ? t('leasing.individuals.stats.owedDetail', { count: summary.owed.count, overdue: summary.owed.overdue })
                                    : t('leasing.individuals.stats.owedNone')
                            }
                            href={route('rentals.index', { types: ['individual'], standing: ['due', 'overdue'] })}
                        />
                    </section>

                    <RecordList
                        routeName="individuals.index"
                        filters={filters}
                        facets={{
                            renting: facets.renting.map((option) => ({ ...option, label: t(`leasing.individuals.renting.${option.value}`), icon: RENTING_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`leasing.status.client.${option.value}`), icon: STATUS_ICONS[option.value] })),
                        }}
                        labels={{ renting: t('leasing.individuals.columns.renting'), status: t('leasing.common.status') }}
                        only={['individuals', 'facets']}
                        paginator={individuals}
                        searchLabel={t('leasing.individuals.searchLabel')}
                        searchPlaceholder={t('leasing.individuals.searchPlaceholder')}
                        empty={<ListEmpty icon={UserRoundIcon} title={t('leasing.individuals.empty.title')} description={t('leasing.individuals.empty.description')} action={rentButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={individuals.data}
                            actions={(person) => (
                                <RowActions
                                    label={person.name}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('clients.show', person.id), icon: EyeIcon },
                                        { label: t('leasing.common.edit'), href: route('clients.edit', person.id), icon: PencilIcon },
                                        { label: t('leasing.individuals.actions.rent'), href: route('rentals.create', { client: person.id }), icon: KeyRoundIcon },
                                        ...person.rentals.map((rental) => ({
                                            label: t('leasing.individuals.actions.openRental', { number: rental.number }),
                                            href: route('rentals.show', rental.id),
                                            icon: DoorOpenIcon,
                                        })),
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
