import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import { PartyTypeBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    Building2Icon,
    CalendarClockIcon,
    EyeIcon,
    FileSignatureIcon,
    KeyRoundIcon,
    PencilIcon,
    PlusIcon,
    UserIcon,
    UsersIcon,
} from 'lucide-react';

const TYPE_ICONS = { company: Building2Icon, individual: UserIcon };

export default function Index({ company, filters, facets, summary, landlords }) {
    const { t, formatNumber, formatCurrency, formatDate } = useTranslation();
    const title = t('leasing.landlords.title');

    const addButton = (
        <Button nativeButton={false} render={<Link href={route('landlords.create')} />}>
            <PlusIcon data-icon="inline-start" />
            {t('leasing.landlords.add')}
        </Button>
    );

    const columns = [
        {
            id: 'name',
            header: t('leasing.landlords.columns.name'),
            cell: (landlord) => (
                <div className="flex min-w-0 flex-col">
                    <Link href={route('landlords.show', landlord.id)} dir="auto" className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {landlord.name}
                    </Link>
                    <span className="truncate text-xs text-muted-foreground">{landlord.contactPerson || '—'}</span>
                </div>
            ),
        },
        { id: 'type', header: t('leasing.landlords.columns.type'), cell: (landlord) => <PartyTypeBadge type={landlord.type} /> },
        {
            id: 'contact',
            header: t('leasing.landlords.columns.contact'),
            cell: (landlord) => (
                <div className="flex flex-col text-sm">
                    <span className="tabular-nums">{landlord.phone || '—'}</span>
                    <span className="text-xs text-muted-foreground">{landlord.email}</span>
                </div>
            ),
        },
        { id: 'leases', header: t('leasing.landlords.columns.leases'), cell: (landlord) => formatNumber(landlord.activeLeases) },
        {
            id: 'rent',
            header: t('leasing.landlords.columns.annualRent'),
            align: 'end',
            cell: (landlord) => (
                <span className="font-medium tabular-nums">{landlord.annualRent > 0 ? formatCurrency(landlord.annualRent, company.currency) : '—'}</span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.landlordsMenu') }, { label: title }]}
                title={title}
                count={summary?.landlords}
                description={t('leasing.landlords.description')}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={KeyRoundIcon} />
            ) : (
                <>
                    <section aria-label={t('leasing.landlords.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={UsersIcon}
                            label={t('leasing.landlords.stats.landlords')}
                            value={formatNumber(summary.landlords)}
                            detail={t('leasing.landlords.stats.landlordsDetail')}
                        />
                        <StatCard
                            icon={FileSignatureIcon}
                            label={t('leasing.landlords.stats.activeLeases')}
                            value={formatNumber(summary.activeLeases)}
                            detail={t('leasing.landlords.stats.activeLeasesDetail')}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            label={t('leasing.landlords.stats.annualRent')}
                            value={formatCurrency(summary.annualRent, company.currency)}
                            detail={t('leasing.landlords.stats.annualRentDetail')}
                        />
                        <StatCard
                            icon={CalendarClockIcon}
                            tone="warning"
                            label={t('leasing.landlords.stats.nextPayment')}
                            value={summary.nextPayment ? formatCurrency(summary.nextPayment.amount, company.currency) : '—'}
                            detail={
                                summary.nextPayment
                                    ? t('leasing.landlords.stats.nextPaymentDetail', {
                                          date: formatDate(summary.nextPayment.dueDate),
                                          landlord: summary.nextPayment.landlord,
                                      })
                                    : t('leasing.landlords.stats.nothingDue')
                            }
                        />
                    </section>

                    <RecordList
                        routeName="landlords.index"
                        filters={filters}
                        facets={{
                            types: facets.types.map((option) => ({
                                ...option,
                                label: t(`leasing.partyTypes.${option.value}`),
                                icon: TYPE_ICONS[option.value],
                            })),
                        }}
                        labels={{ types: t('leasing.landlords.filters.types') }}
                        only={['landlords', 'facets']}
                        paginator={landlords}
                        searchLabel={t('leasing.landlords.searchLabel')}
                        searchPlaceholder={t('leasing.landlords.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={KeyRoundIcon}
                                title={t('leasing.landlords.empty.title')}
                                description={t('leasing.landlords.empty.description')}
                                action={addButton}
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={landlords.data}
                            actions={(landlord) => (
                                <RowActions
                                    label={landlord.name}
                                    items={[
                                        { label: t('leasing.common.view'), href: route('landlords.show', landlord.id), icon: EyeIcon },
                                        { label: t('leasing.common.edit'), href: route('landlords.edit', landlord.id), icon: PencilIcon },
                                        {
                                            label: t('leasing.landlords.newLease'),
                                            href: route('head-leases.create', { landlord: landlord.id }),
                                            icon: FileSignatureIcon,
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
