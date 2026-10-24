import DataTable from '@/Components/DataTable';
import { RentalStatusBadge, RentStandingBadge, StandingDetail, useRentalPlace } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BedSingleIcon,
    Building2Icon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ClockIcon,
    DoorClosedIcon,
    EyeIcon,
    HandCoinsIcon,
    KeyRoundIcon,
    PencilIcon,
    PlusIcon,
    UserIcon,
    WalletIcon,
} from 'lucide-react';

const STANDING_ICONS = { paid_up: CircleCheckIcon, due: ClockIcon, overdue: CircleAlertIcon };
const STATUS_ICONS = { active: KeyRoundIcon, ended: CircleSlashIcon };
const UNIT_ICONS = { bed: BedSingleIcon, room: DoorClosedIcon };

/**
 * Individual rentals: beds and rooms rented straight to individuals,
 * without a contract, with where each tenant's rent stands.
 */
export default function Index({ company, filters, facets, summary, rentals }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const place = useRentalPlace();
    const title = t('finance.rentals.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('rentals.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('finance.rentals.add')}
        </Button>
    );

    const columns = [
        {
            id: 'rental',
            header: t('finance.rentals.columns.rental'),
            cell: (rental) => (
                <div className="flex flex-col">
                    <Link href={route('rentals.show', rental.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {rental.number}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {rental.movedOutOn ? t('finance.rentals.stayed', { from: formatDate(rental.startDate), to: formatDate(rental.movedOutOn) }) : t('finance.rentals.since', { date: formatDate(rental.startDate) })}
                    </span>
                </div>
            ),
        },
        {
            id: 'tenant',
            header: t('finance.rentals.columns.tenant'),
            cell: (rental) =>
                rental.tenant ? (
                    <div className="flex max-w-56 flex-col">
                        <Link href={route('clients.show', rental.tenant.id)} dir="auto" className="truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                            {rental.tenant.name}
                        </Link>
                        {rental.tenant.phone && <span className="truncate text-xs text-muted-foreground tabular-nums">{rental.tenant.phone}</span>}
                    </div>
                ) : (
                    '—'
                ),
        },
        {
            id: 'place',
            header: t('finance.rentals.columns.place'),
            cell: (rental) => (
                <div className="flex max-w-56 flex-col">
                    <span className="truncate">{place(rental)}</span>
                    <span className="truncate text-xs text-muted-foreground">{rental.property?.name}</span>
                </div>
            ),
        },
        { id: 'rent', header: t('finance.rentals.columns.rent'), align: 'end', cell: (rental) => <span className="font-medium tabular-nums">{formatMoney(rental.monthlyRent, company.currency)}</span> },
        {
            id: 'standing',
            header: t('finance.rentals.columns.standing'),
            cell: (rental) => (
                <div className="flex flex-col items-start gap-0.5">
                    <RentStandingBadge standing={rental.standing.standing} />
                    <StandingDetail standing={rental.standing} currency={company.currency} />
                </div>
            ),
        },
        { id: 'status', header: t('leasing.common.status'), cell: (rental) => <RentalStatusBadge status={rental.status} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.tenants') }, { label: title }]} title={title} count={rentals?.total} description={t('finance.rentals.description')} actions={company && addButton} />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={KeyRoundIcon} />
            ) : (
                <>
                    <section aria-label={t('finance.rentals.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={KeyRoundIcon}
                            label={t('finance.rentals.stats.active')}
                            value={summary.active}
                            detail={t('finance.rentals.stats.activeDetail', { count: summary.rooms })}
                            href={route('rentals.index', { status: ['active'] })}
                        />
                        <StatCard icon={WalletIcon} tone="gold" label={t('finance.rentals.stats.monthlyRent')} value={formatCurrency(summary.monthlyRent, company.currency)} detail={t('finance.rentals.stats.monthlyRentDetail')} />
                        <StatCard
                            icon={CircleAlertIcon}
                            tone={summary.arrears.count > 0 ? 'warning' : 'success'}
                            label={t('finance.rentals.stats.owed')}
                            value={formatCurrency(summary.arrears.amount, company.currency)}
                            detail={summary.arrears.count > 0 ? t('finance.rentals.stats.owedDetail', { count: summary.arrears.count, overdue: summary.arrears.overdue }) : t('finance.rentals.stats.owedNone')}
                            href={route('rentals.index', { standing: ['due', 'overdue'] })}
                        />
                        <StatCard
                            icon={HandCoinsIcon}
                            tone="success"
                            label={t('finance.rentals.stats.collected')}
                            value={formatCurrency(summary.collectedThisMonth, company.currency)}
                            detail={t('finance.rentals.stats.depositsHeld', { amount: formatCurrency(summary.depositsHeld, company.currency) })}
                            href={route('rental-payments.index', { period: 'this_month' })}
                        />
                    </section>

                    <RecordList
                        routeName="rentals.index"
                        filters={filters}
                        facets={{
                            standing: facets.standing.map((option) => ({ ...option, label: t(`finance.rentals.standing.${option.value}`), icon: STANDING_ICONS[option.value] })),
                            status: facets.status.map((option) => ({ ...option, label: t(`finance.rentals.status.${option.value}`), icon: STATUS_ICONS[option.value] })),
                            unit: facets.unit.map((option) => ({ ...option, label: t(`finance.rentals.units.${option.value}`), icon: UNIT_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{
                            standing: t('finance.rentals.filters.standing'),
                            status: t('leasing.common.status'),
                            unit: t('finance.rentals.filters.unit'),
                            properties: t('finance.rentals.filters.properties'),
                        }}
                        only={['rentals', 'facets']}
                        paginator={rentals}
                        searchLabel={t('finance.rentals.searchLabel')}
                        searchPlaceholder={t('finance.rentals.searchPlaceholder')}
                        empty={<ListEmpty icon={KeyRoundIcon} title={t('finance.rentals.empty.title')} description={t('finance.rentals.empty.description')} action={addButton} />}
                    >
                        <DataTable
                            columns={columns}
                            rows={rentals.data}
                            actions={(rental) => (
                                <RowActions
                                    label={rental.number}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('rentals.show', rental.id), icon: EyeIcon },
                                        ...(rental.status === 'active' ? [{ label: t('finance.rentals.edit'), href: route('rentals.edit', rental.id), icon: PencilIcon }] : []),
                                        ...(rental.tenant ? [{ label: t('finance.rentals.viewTenant'), href: route('clients.show', rental.tenant.id), icon: UserIcon }] : []),
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
