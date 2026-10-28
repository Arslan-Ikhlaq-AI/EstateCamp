import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDownLeftIcon,
    ArrowUpRightIcon,
    EyeIcon,
    FileSignatureIcon,
    HandCoinsIcon,
    LayoutPanelLeftIcon,
    ReceiptIcon,
    ScrollTextIcon,
    WalletIcon,
    WrenchIcon,
} from 'lucide-react';
import { useState } from 'react';
import BillingPanel from './Partials/BillingPanel';
import IncomingCheques from './Partials/IncomingCheques';
import MaintenanceBillsPanel from './Partials/MaintenanceBillsPanel';
import OtherPaymentsPanel from './Partials/OtherPaymentsPanel';
import OutgoingAgreements from './Partials/OutgoingAgreements';

/**
 * Named periods the filter offers, looking both back and ahead; any month
 * or range of days can be chosen too.
 */
const PERIOD_PRESETS = ['this_month', 'next_month', 'last_month', 'this_quarter', 'next_quarter', 'last_quarter', 'this_year', 'last_year'];

const TAB_ICONS = { in: ArrowDownLeftIcon, out: ArrowUpRightIcon };

/**
 * A property's payments over a period. Payments in: every cheque from its
 * clients, whose status can be changed in place, then each company's bill
 * for the units it holds, paid by typing the amount and ticking. Payments
 * out: the landlord's lease and the maintenance contracts (drainage and the
 * rest) with their cheques, the maintenance bills to pay, and one-off
 * payments such as a permit fee. Maintenance added from here is paid as it
 * is added and lands in those bills; an other payment is added here too.
 * Cheques are marked cashed (in) or paid (out) in one step.
 */
export default function Payments({
    property,
    period,
    tab: initialTab,
    incoming,
    outgoing,
    summary,
    chequeStatuses,
    banks,
    collectionMethods,
    billPaymentMethods,
    otherPaymentMethods,
    currency,
}) {
    const { t, tOr, formatNumber, formatCurrency, formatDate } = useTranslation();
    const { range } = usePeriodLabel();
    const periodLabel = range(period);
    const [tab, setTab] = useState(initialTab);
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const changePeriod = (value) =>
        router.get(route('properties.payments', property.id), value ? { period: value } : {}, { preserveScroll: true, preserveState: true });
    const counts = {
        in: incoming.cheques.length + incoming.accounts.length,
        out: outgoing.agreements.length + outgoing.bills.length + outgoing.others.length,
    };

    return (
        <DashboardLayout>
            <Head title={`${t('propertyPayments.title')} · ${property.name}`} />

            <PageHeader
                breadcrumbs={[
                    { label: t('properties.title'), href: route('properties.index') },
                    { label: property.name, href: route('properties.show', property.id) },
                    { label: t('propertyPayments.title') },
                ]}
                title={t('propertyPayments.title')}
                description={[property.name, property.code, type, place].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.show', property.id)} />}>
                            <EyeIcon data-icon="inline-start" />
                            {t('propertyAllocation.viewProperty')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.allocation', property.id)} />}>
                            <LayoutPanelLeftIcon data-icon="inline-start" />
                            {t('properties.actions.allocation')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.tenant-contracts', property.id)} />}>
                            <FileSignatureIcon data-icon="inline-start" />
                            {t('properties.actions.tenantContracts')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('maintenance.create', { property: property.id, from: 'payments' })} />}>
                            <WrenchIcon data-icon="inline-start" />
                            {t('propertyPayments.addMaintenance')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('other-payments.create', { property: property.id })} />}>
                            <ReceiptIcon data-icon="inline-start" />
                            {t('propertyPayments.addOtherPayment')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <PeriodFilter period={period} onChange={changePeriod} presets={PERIOD_PRESETS} allowsAll={false} />
                <p className="min-w-0 flex-1 basis-72 text-[0.875rem] text-pretty text-muted-foreground">{t('propertyPayments.periodHint', { period: periodLabel })}</p>
            </div>

            <section aria-label={t('propertyPayments.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={ArrowDownLeftIcon}
                    tone="success"
                    label={t('propertyPayments.stats.received')}
                    value={formatCurrency(summary.received, currency)}
                    detail={t('propertyPayments.stats.receivedDetail', { period: periodLabel })}
                />
                <StatCard
                    icon={HandCoinsIcon}
                    tone="gold"
                    label={t('propertyPayments.stats.toCollect')}
                    value={formatCurrency(summary.toCollect, currency)}
                    detail={t('propertyPayments.stats.toCollectDetail', { count: summary.owing })}
                    badge={
                        summary.chequesInHand.count > 0 && (
                            <ToneBadge tone="primary" icon={ScrollTextIcon}>
                                {t('propertyPayments.stats.chequesInHand', {
                                    count: summary.chequesInHand.count,
                                    amount: formatCurrency(summary.chequesInHand.amount, currency),
                                })}
                            </ToneBadge>
                        )
                    }
                />
                <StatCard
                    icon={ArrowUpRightIcon}
                    label={t('propertyPayments.stats.paidOut')}
                    value={formatCurrency(summary.paidOut, currency)}
                    detail={t('propertyPayments.stats.paidOutDetail', { period: periodLabel })}
                />
                <StatCard
                    icon={WalletIcon}
                    tone="warning"
                    label={t('propertyPayments.stats.toPay')}
                    value={formatCurrency(summary.toPay, currency)}
                    detail={t('propertyPayments.stats.toPayDetail', { date: formatDate(period.to) })}
                />
            </section>

            <Tabs value={tab} onValueChange={setTab} className="flex-col gap-5">
                <TabsList aria-label={t('propertyPayments.tabs.label')} className="h-auto w-full max-w-full justify-start overflow-x-auto p-1 sm:w-fit">
                    {['in', 'out'].map((key) => {
                        const Icon = TAB_ICONS[key];

                        return (
                            <TabsTrigger key={key} value={key} className="h-9 flex-none gap-2 px-3.5 text-[0.875rem] data-active:[&_svg]:text-brand-ink">
                                <Icon data-icon="inline-start" />
                                {t(`propertyPayments.tabs.${key}`)}
                                <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs leading-5 font-semibold tabular-nums">{formatNumber(counts[key])}</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                <TabsContent value="in">
                    <div className="flex flex-col gap-6">
                        <IncomingCheques cheques={incoming.cheques} statuses={chequeStatuses} banks={banks} currency={currency} periodLabel={periodLabel} />
                        <BillingPanel
                            accounts={incoming.accounts}
                            currency={currency}
                            propertyId={property.id}
                            period={period}
                            periodLabel={periodLabel}
                            methods={collectionMethods}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="out">
                    <div className="flex flex-col gap-6">
                        <OutgoingAgreements
                            agreements={outgoing.agreements}
                            currency={currency}
                            statuses={chequeStatuses}
                            banks={banks}
                            period={period}
                            periodLabel={periodLabel}
                        />
                        <MaintenanceBillsPanel bills={outgoing.bills} currency={currency} methods={billPaymentMethods} periodLabel={periodLabel} />
                        <OtherPaymentsPanel
                            payments={outgoing.others}
                            propertyId={property.id}
                            currency={currency}
                            methods={otherPaymentMethods}
                            periodLabel={periodLabel}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}
