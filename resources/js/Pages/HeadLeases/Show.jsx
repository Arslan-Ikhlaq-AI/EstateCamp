import ChequeSchedule from '@/Components/ChequeSchedule';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { LeaseStatusBadge } from '@/Components/LeasingBadges';
import PostButton from '@/Components/PostButton';
import PageHeader from '@/Components/PageHeader';
import PropertyCover from '@/Components/PropertyCover';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    BedDoubleIcon,
    CalendarClockIcon,
    CircleCheckIcon,
    DoorOpenIcon,
    ExternalLinkIcon,
    FilePlusIcon,
    HouseIcon,
    PencilIcon,
    RefreshCwIcon,
    WalletCardsIcon,
    StoreIcon,
    WalletIcon,
} from 'lucide-react';
import DocumentsOnFile from './Partials/DocumentsOnFile';

/**
 * Whole months a lease covers, counting its last day (1 Jan to 31 Dec is 12).
 */
function leaseMonths(start, end) {
    const from = new Date(`${start}T00:00:00`);
    const to = new Date(`${end}T00:00:00`);
    to.setDate(to.getDate() + 1);

    return Math.max((to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0), 1);
}

/**
 * One count of what the property holds, linking to that list for the property.
 */
function UnitTile({ icon: Icon, label, value, detail, href }) {
    return (
        <Link
            href={href}
            className="group/tile flex flex-col gap-1 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/[0.06] transition-colors hover:bg-accent hover:ring-brand-cyan/30"
        >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {label}
            </span>
            <span className="font-heading text-xl font-bold tabular-nums group-hover/tile:text-brand-ink">{value}</span>
            {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
        </Link>
    );
}

export default function Show({ lease, property, documents, stats, cheques, banks, chequeStatuses, currency }) {
    const { t, tOr, formatCurrency, formatMoney, formatDate, formatNumber, formatPercent } = useTranslation();
    const filter = { properties: [property.code] };
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const { period } = useLeasingFormat();
    const canRenew = ['active', 'expired'].includes(lease.status) && lease.renewal === null;

    return (
        <DashboardLayout>
            <Head title={lease.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.landlordsMenu') }, { label: t('leasing.headLeases.title'), href: route('head-leases.index') }, { label: lease.number }]}
                title={lease.number}
                badge={<LeaseStatusBadge status={lease.status} />}
                description={
                    <span>
                        <Link href={route('landlords.show', lease.landlordId)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {lease.landlordName}
                        </Link>{' '}
                        · <span dir="auto">{lease.property.name}</span> · {period(lease.startDate, lease.endDate)}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('head-leases.edit', lease.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        {canRenew && (
                            <Button nativeButton={false} render={<Link href={route('head-leases.create', { renew: lease.id })} />}>
                                <RefreshCwIcon data-icon="inline-start" />
                                {t('leasing.headLeases.renew')}
                            </Button>
                        )}
                    </>
                }
            />

            <FlashMessages errorKeys={['action', 'cheques']} />

            <section aria-label={t('leasing.headLeases.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    label={t('leasing.headLeases.form.fields.annualRent')}
                    value={formatCurrency(lease.annualRent, currency)}
                    detail={t('leasing.headLeases.instalments', { count: lease.paymentsPerYear, amount: formatCurrency(lease.installmentAmount, currency) })}
                />
                <StatCard
                    icon={CircleCheckIcon}
                    tone="success"
                    label={t('leasing.headLeases.show.paid')}
                    value={formatCurrency(stats.paid, currency)}
                    detail={t('leasing.headLeases.show.paidDetail')}
                />
                <StatCard
                    icon={WalletIcon}
                    tone={stats.overdue > 0 || stats.toWrite > 0 ? 'warning' : 'primary'}
                    label={t('leasing.headLeases.stats.outstanding')}
                    value={formatCurrency(stats.outstanding, currency)}
                    detail={
                        stats.toWrite > 0
                            ? t('leasing.cheques.schedule.attention', { count: stats.toWrite })
                            : stats.overdue > 0
                              ? t('leasing.headLeases.stats.overdueDetail', { count: stats.overdue })
                              : t('leasing.headLeases.stats.outstandingDetail')
                    }
                />
                <StatCard
                    icon={CalendarClockIcon}
                    label={t('leasing.headLeases.stats.next')}
                    value={stats.nextPayment ? formatMoney(stats.nextPayment.amount, currency) : '—'}
                    detail={stats.nextPayment ? formatDate(stats.nextPayment.dueDate) : t('leasing.landlords.stats.nothingDue')}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard
                        title={t('leasing.headLeases.show.property')}
                        description={t('leasing.headLeases.show.propertyDescription')}
                        action={
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('properties.show', property.id)} />}>
                                <ExternalLinkIcon data-icon="inline-start" />
                                {t('leasing.headLeases.show.openProperty')}
                            </Button>
                        }
                    >
                        <div className="flex flex-col gap-5 sm:flex-row">
                            <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/[0.08] sm:w-56">
                                <PropertyCover src={property.cover_image_url} />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <Link href={route('properties.show', property.id)} dir="auto" className="font-heading text-lg font-bold hover:text-brand-ink">
                                        {property.name}
                                    </Link>
                                    <span className="text-sm text-muted-foreground">
                                        {[
                                            property.code,
                                            property.type && tOr(`propertyTypes.${property.type.slug}`, property.type.name),
                                            property.address || place,
                                            property.total_floors && property.total_units
                                                ? t('leasing.headLeases.show.size', { floors: property.total_floors, units: property.total_units })
                                                : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <UnitTile
                                        icon={DoorOpenIcon}
                                        label={t('nav.rooms')}
                                        value={formatNumber(property.rooms)}
                                        detail={t('common.beds', { count: property.beds.total })}
                                        href={route('rooms.index', filter)}
                                    />
                                    <UnitTile
                                        icon={BedDoubleIcon}
                                        label={t('properties.stats.occupancy')}
                                        value={property.beds.occupancyRate === null ? '—' : formatPercent(property.beds.occupancyRate)}
                                        detail={t('leasing.headLeases.show.bedsOccupied', { occupied: property.beds.occupied, total: property.beds.occupied + property.beds.available })}
                                        href={route('rooms.index', filter)}
                                    />
                                    <UnitTile icon={StoreIcon} label={t('nav.shops')} value={formatNumber(property.shops)} href={route('shops.index', filter)} />
                                    <UnitTile icon={HouseIcon} label={t('nav.apartments')} value={formatNumber(property.apartments)} href={route('apartments.index', filter)} />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title={t('leasing.cheques.schedule.title')}
                        description={t('leasing.cheques.schedule.description.issued')}
                        flush
                        action={
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('head-leases.edit', lease.id)} />}>
                                <PencilIcon data-icon="inline-start" />
                                {t('leasing.cheques.actions.record')}
                            </Button>
                        }
                    >
                        {cheques.length === 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5 lg:px-6">
                                <p className="max-w-xl text-sm text-muted-foreground">{t('leasing.cheques.schedule.setUpDescription')}</p>
                                <PostButton href={route('head-leases.cheques.store', lease.id)} icon={WalletCardsIcon}>
                                    {t('leasing.cheques.schedule.setUp')}
                                </PostButton>
                            </div>
                        ) : (
                            <ChequeSchedule cheques={cheques} currency={currency} statuses={chequeStatuses} banks={banks} />
                        )}
                    </SectionCard>

                    <SectionCard
                        title={t('leasing.headLeases.show.documents')}
                        description={t('leasing.headLeases.show.documentsDescription')}
                        action={
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('head-leases.edit', lease.id)} />}>
                                <FilePlusIcon data-icon="inline-start" />
                                {t('leasing.headLeases.show.addDocuments')}
                            </Button>
                        }
                    >
                        {documents.length > 0 ? (
                            <DocumentsOnFile documents={documents} leaseId={lease.id} />
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('leasing.headLeases.show.noDocuments')}</p>
                        )}
                    </SectionCard>

                    {lease.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{lease.notes}</p>
                        </SectionCard>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.headLeases.show.terms')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.common.status'), value: <LeaseStatusBadge status={lease.status} /> },
                                {
                                    label: t('leasing.common.property'),
                                    value: (
                                        <Link href={route('properties.show', property.id)} dir="auto" className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {`${property.name} · ${property.code}`}
                                        </Link>
                                    ),
                                },
                                { label: t('leasing.common.startDate'), value: formatDate(lease.startDate) },
                                { label: t('leasing.common.endDate'), value: formatDate(lease.endDate) },
                                {
                                    label: t('leasing.headLeases.show.length'),
                                    value: [
                                        t('leasing.headLeases.show.months', { count: leaseMonths(lease.startDate, lease.endDate) }),
                                        lease.daysLeft < 0
                                            ? t('leasing.headLeases.show.ended', { date: formatDate(lease.endDate) })
                                            : t('leasing.common.daysLeft', { count: lease.daysLeft }),
                                    ].join(' · '),
                                },
                                { label: t('leasing.headLeases.form.fields.annualRent'), value: formatCurrency(lease.annualRent, currency) },
                                {
                                    label: t('leasing.headLeases.form.fields.paymentsPerYear'),
                                    value: t('leasing.headLeases.instalments', { count: lease.paymentsPerYear, amount: formatCurrency(lease.installmentAmount, currency) }),
                                },
                                { label: t('leasing.common.ejariNumber'), value: lease.ejariNumber },
                                { label: t('leasing.common.securityDeposit'), value: lease.securityDeposit === null ? null : formatCurrency(lease.securityDeposit, currency) },
                                {
                                    label: t('leasing.headLeases.form.fields.noticeDays'),
                                    value: lease.noticePeriodDays === null ? null : t('leasing.common.days', { count: lease.noticePeriodDays }),
                                },
                                {
                                    label: t('leasing.headLeases.show.renewedFrom'),
                                    value: lease.renewedFrom && (
                                        <Link href={route('head-leases.show', lease.renewedFrom.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {lease.renewedFrom.number}
                                        </Link>
                                    ),
                                },
                                {
                                    label: t('leasing.headLeases.show.renewedBy'),
                                    value: lease.renewal && (
                                        <Link href={route('head-leases.show', lease.renewal.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                            {lease.renewal.number}
                                        </Link>
                                    ),
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title={t('leasing.headLeases.show.landlord')}>
                        <DetailList
                            columns={1}
                            rows={[
                                {
                                    label: t('leasing.landlords.columns.name'),
                                    value: (
                                        <Link href={route('landlords.show', lease.landlord.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                                            {lease.landlord.name}
                                        </Link>
                                    ),
                                },
                                { label: t('leasing.landlords.form.fields.type'), value: t(`leasing.partyTypes.${lease.landlord.landlord_type}`) },
                                { label: t('leasing.landlords.form.fields.contactPerson'), value: lease.landlord.contact_person_name },
                                { label: t('leasing.landlords.form.fields.phone'), value: lease.landlord.phone },
                                { label: t('leasing.landlords.form.fields.email'), value: lease.landlord.email },
                                { label: t('leasing.landlords.form.fields.bankName'), value: lease.landlord.bank_name },
                                { label: t('leasing.landlords.form.fields.iban'), value: lease.landlord.iban && <span className="font-mono">{lease.landlord.iban}</span> },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>

        </DashboardLayout>
    );
}
