import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    BanknoteIcon,
    BedDoubleIcon,
    Building2Icon,
    PencilIcon,
    RulerIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import {
    ApartmentStatusBadge,
    useApartmentLayout,
    useApartmentPlacement,
} from './Partials/ApartmentBits';
import { AMENITY_ICONS, FURNISHING_ICONS } from './Partials/apartmentOptions';

/**
 * Label and value pairs in a two-column grid; a missing value shows a dash.
 */
function DetailList({ rows, columns = 'sm:grid-cols-2' }) {
    return (
        <dl className={`grid gap-x-6 gap-y-4 ${columns}`}>
            {rows.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="truncate text-sm font-medium">{row.value ?? '—'}</dd>
                </div>
            ))}
        </dl>
    );
}

function Section({ title, description, children }) {
    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export default function Show({ apartment, currency }) {
    const { t, formatCurrency, formatNumber, formatDate } = useTranslation();
    const placement = useApartmentPlacement();
    const layout = useApartmentLayout();
    const title = t('apartmentList.apartment', { number: apartment.number });
    const FurnishingIcon = FURNISHING_ICONS[apartment.furnishing];
    const money = (amount) => (amount === null ? null : formatCurrency(amount, currency));
    const floor =
        apartment.floor === null ? null : Number(apartment.floor) === 0 ? t('apartmentList.ground') : formatNumber(apartment.floor);

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[
                    { label: t('nav.properties'), href: route('properties.index') },
                    { label: t('apartmentList.title'), href: route('apartments.index') },
                    { label: title },
                ]}
                title={title}
                badge={<ApartmentStatusBadge status={apartment.status} />}
                description={
                    <span className="flex flex-wrap items-center gap-x-2">
                        <Building2Icon className="size-4 shrink-0" />
                        <span dir="auto">{apartment.property.name}</span>
                        {placement(apartment) && <span aria-hidden="true">·</span>}
                        {placement(apartment)}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('apartments.index')} />}>
                            <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                            {t('apartmentShow.back')}
                        </Button>
                        <Button nativeButton={false} render={<Link href={route('apartments.edit', apartment.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('apartmentShow.edit')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('apartmentShow.summary')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    label={t('apartmentShow.stats.rent')}
                    value={money(apartment.monthlyRent) ?? '—'}
                    detail={t('apartmentShow.stats.rentDetail')}
                />
                <StatCard
                    icon={ShieldCheckIcon}
                    label={t('apartmentShow.stats.deposit')}
                    value={money(apartment.securityDeposit) ?? '—'}
                    detail={t('apartmentShow.stats.depositDetail')}
                />
                <StatCard
                    icon={RulerIcon}
                    label={t('apartmentShow.stats.area')}
                    value={apartment.areaSqm ? `${formatNumber(apartment.areaSqm)} m²` : '—'}
                    detail={t('apartmentShow.stats.areaDetail')}
                />
                <StatCard
                    icon={BedDoubleIcon}
                    label={t('apartmentShow.stats.layout')}
                    value={Number(apartment.bedrooms) === 0 ? t('apartmentList.studio') : t('apartmentList.bed', { count: apartment.bedrooms })}
                    detail={t('apartmentList.bath', { count: apartment.bathrooms })}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Section title={t('apartmentShow.sections.details.title')} description={t('apartmentShow.sections.details.description')}>
                        <DetailList
                            rows={[
                                { label: t('apartmentForm.fields.property'), value: `${apartment.property.name} · ${apartment.property.code}` },
                                { label: t('apartmentForm.fields.apartmentNumber'), value: apartment.number },
                                { label: t('apartmentForm.fields.block'), value: apartment.block },
                                { label: t('apartmentForm.fields.floor'), value: floor },
                                { label: t('apartmentForm.fields.layout'), value: layout(apartment) },
                                {
                                    label: t('apartmentForm.fields.furnishing'),
                                    value: apartment.furnishing ? (
                                        <span className="flex items-center gap-1.5">
                                            {FurnishingIcon && <FurnishingIcon className="size-4 shrink-0" />}
                                            {t(`furnishing.${apartment.furnishing}`)}
                                        </span>
                                    ) : null,
                                },
                                { label: t('apartmentForm.fields.maxOccupants'), value: apartment.maxOccupants },
                            ]}
                        />
                    </Section>

                    <Section title={t('apartmentShow.sections.amenities.title')} description={t('apartmentShow.sections.amenities.description')}>
                        {apartment.amenities.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('apartmentShow.noAmenities')}</p>
                        ) : (
                            <ul className="flex flex-wrap gap-2">
                                {apartment.amenities.map((amenity) => {
                                    const Icon = AMENITY_ICONS[amenity];

                                    return (
                                        <li key={amenity}>
                                            <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-3 text-[0.875rem] font-normal">
                                                {Icon && <Icon data-icon="inline-start" />}
                                                {t(`apartmentAmenities.${amenity}`)}
                                            </Badge>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Section>

                    <Section title={t('apartmentShow.sections.notes.title')}>
                        {apartment.notes ? (
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{apartment.notes}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('apartmentShow.noNotes')}</p>
                        )}
                    </Section>
                </div>

                <div className="flex flex-col gap-6">
                    <Section title={t('apartmentShow.sections.pricing.title')} description={t('apartmentShow.sections.pricing.description')}>
                        <DetailList
                            columns="grid-cols-1"
                            rows={[
                                { label: t('apartmentForm.fields.rent'), value: money(apartment.monthlyRent) },
                                { label: t('apartmentForm.fields.deposit'), value: money(apartment.securityDeposit) },
                                {
                                    label: t('apartmentForm.annual'),
                                    value: apartment.monthlyRent === null ? null : money(apartment.monthlyRent * 12),
                                },
                                {
                                    label: t('apartmentForm.fields.utilityAccount'),
                                    value: apartment.utilityAccountNumber ? (
                                        <span className="font-mono">{apartment.utilityAccountNumber}</span>
                                    ) : null,
                                },
                            ]}
                        />
                    </Section>

                    <Section title={t('apartmentShow.sections.record.title')}>
                        <DetailList
                            columns="grid-cols-1"
                            rows={[
                                { label: t('apartmentShow.added'), value: formatDate(apartment.createdAt) },
                                { label: t('apartmentShow.updated'), value: formatDate(apartment.updatedAt) },
                            ]}
                        />
                    </Section>
                </div>
            </div>
        </DashboardLayout>
    );
}
