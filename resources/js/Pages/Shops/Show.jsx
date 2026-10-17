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
    Building2Icon,
    PencilIcon,
    RulerIcon,
    ShieldCheckIcon,
    StoreIcon,
} from 'lucide-react';
import { ShopStatusBadge, useShopPlacement } from './Partials/ShopBits';
import { AMENITY_ICONS, TYPE_ICONS, useShopTypeLabel } from './Partials/shopOptions';

/**
 * Label and value pairs in a grid; a missing value shows a dash.
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

export default function Show({ shop, currency }) {
    const { t, formatCurrency, formatNumber, formatDate } = useTranslation();
    const placement = useShopPlacement();
    const typeLabel = useShopTypeLabel();
    const title = t('shopList.shop', { number: shop.number });
    const TypeIcon = TYPE_ICONS[shop.type] ?? StoreIcon;
    const money = (amount) => (amount === null ? null : formatCurrency(amount, currency));
    const floor = shop.floor === null ? null : Number(shop.floor) === 0 ? t('shopList.ground') : formatNumber(shop.floor);

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[
                    { label: t('nav.properties'), href: route('properties.index') },
                    { label: t('shopList.title'), href: route('shops.index') },
                    { label: title },
                ]}
                title={title}
                badge={<ShopStatusBadge status={shop.status} />}
                description={
                    <span className="flex flex-wrap items-center gap-x-2">
                        <Building2Icon className="size-4 shrink-0" />
                        <span dir="auto">{shop.property.name}</span>
                        {placement(shop) && <span aria-hidden="true">·</span>}
                        {placement(shop)}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('shops.index')} />}>
                            <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                            {t('shopShow.back')}
                        </Button>
                        <Button nativeButton={false} render={<Link href={route('shops.edit', shop.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('shopShow.edit')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('shopShow.summary')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={BanknoteIcon}
                    label={t('shopShow.stats.rent')}
                    value={money(shop.monthlyRent) ?? '—'}
                    detail={t('shopShow.stats.rentDetail')}
                />
                <StatCard
                    icon={ShieldCheckIcon}
                    label={t('shopShow.stats.deposit')}
                    value={money(shop.securityDeposit) ?? '—'}
                    detail={t('shopShow.stats.depositDetail')}
                />
                <StatCard
                    icon={RulerIcon}
                    label={t('shopShow.stats.area')}
                    value={shop.areaSqm ? `${formatNumber(shop.areaSqm)} m²` : '—'}
                    detail={t('shopShow.stats.areaDetail')}
                />
                <StatCard
                    icon={TypeIcon}
                    label={t('shopShow.stats.type')}
                    value={shop.type ? typeLabel(shop.type) : '—'}
                    detail={t('shopShow.stats.typeDetail')}
                />
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="flex flex-col gap-6 xl:col-span-2">
                    <Section title={t('shopShow.sections.details.title')} description={t('shopShow.sections.details.description')}>
                        <DetailList
                            rows={[
                                { label: t('shopForm.fields.property'), value: `${shop.property.name} · ${shop.property.code}` },
                                { label: t('shopForm.fields.shopNumber'), value: shop.number },
                                { label: t('shopForm.fields.block'), value: shop.block },
                                { label: t('shopForm.fields.floor'), value: floor },
                                { label: t('shopForm.fields.type'), value: shop.type ? typeLabel(shop.type) : null },
                                { label: t('shopForm.fields.area'), value: shop.areaSqm ? `${formatNumber(shop.areaSqm)} m²` : null },
                            ]}
                        />
                    </Section>

                    <Section title={t('shopShow.sections.amenities.title')} description={t('shopShow.sections.amenities.description')}>
                        {shop.amenities.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('shopShow.noAmenities')}</p>
                        ) : (
                            <ul className="flex flex-wrap gap-2">
                                {shop.amenities.map((amenity) => {
                                    const Icon = AMENITY_ICONS[amenity];

                                    return (
                                        <li key={amenity}>
                                            <Badge variant="outline" className="h-7 gap-1.5 rounded-full px-3 text-[0.8125rem] font-normal">
                                                {Icon && <Icon data-icon="inline-start" />}
                                                {t(`shopAmenities.${amenity}`)}
                                            </Badge>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Section>

                    <Section title={t('shopShow.sections.notes.title')}>
                        {shop.notes ? (
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{shop.notes}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t('shopShow.noNotes')}</p>
                        )}
                    </Section>
                </div>

                <div className="flex flex-col gap-6">
                    <Section title={t('shopShow.sections.pricing.title')} description={t('shopShow.sections.pricing.description')}>
                        <DetailList
                            columns="grid-cols-1"
                            rows={[
                                { label: t('shopForm.fields.rent'), value: money(shop.monthlyRent) },
                                { label: t('shopForm.fields.deposit'), value: money(shop.securityDeposit) },
                                {
                                    label: t('shopForm.annual'),
                                    value: shop.monthlyRent === null ? null : money(shop.monthlyRent * 12),
                                },
                                {
                                    label: t('shopForm.fields.utilityAccount'),
                                    value: shop.utilityAccountNumber ? <span className="font-mono">{shop.utilityAccountNumber}</span> : null,
                                },
                            ]}
                        />
                    </Section>

                    <Section title={t('shopShow.sections.record.title')}>
                        <DetailList
                            columns="grid-cols-1"
                            rows={[
                                { label: t('shopShow.added'), value: formatDate(shop.createdAt) },
                                { label: t('shopShow.updated'), value: formatDate(shop.updatedAt) },
                            ]}
                        />
                    </Section>
                </div>
            </div>
        </DashboardLayout>
    );
}
