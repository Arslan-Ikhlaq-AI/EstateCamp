import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { BanknoteIcon, EyeIcon, FilePlusIcon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import AllocationPanel, { AllocationBar, KIND_ICONS } from './Partials/AllocationPanel';

const KINDS = ['rooms', 'shops', 'apartments'];

const KIND_TONES = { rooms: 'primary', shops: 'gold', apartments: 'violet' };

/**
 * A property's room allocation: how many rooms, shops and apartments are
 * available, then a tab per kind listing every unit with who holds it — a
 * company under contract, an individual, or nobody — and what it brings in.
 */
export default function Allocation({ property, rooms, shops, apartments, summaries, currency }) {
    const { t, tOr, formatNumber, formatCurrency } = useTranslation();
    const rows = { rooms, shops, apartments };
    const [kind, setKind] = useState(() => KINDS.find((key) => rows[key].length > 0) ?? 'rooms');
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const rent = KINDS.reduce(
        (total, key) => ({
            contract: total.contract + summaries[key].rent.contract,
            individual: total.individual + summaries[key].rent.individual,
            overall: total.overall + summaries[key].rent.overall,
        }),
        { contract: 0, individual: 0, overall: 0 },
    );

    return (
        <DashboardLayout>
            <Head title={`${t('propertyAllocation.title')} · ${property.name}`} />

            <PageHeader
                breadcrumbs={[{ label: t('properties.title'), href: route('properties.index') }, { label: t('propertyAllocation.title') }]}
                title={t('propertyAllocation.title')}
                description={[property.name, property.code, type, place].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.show', property.id)} />}>
                            <EyeIcon data-icon="inline-start" />
                            {t('propertyAllocation.viewProperty')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.create')} />}>
                            <UserPlusIcon data-icon="inline-start" />
                            {t('propertyAllocation.rentToIndividual')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                            <FilePlusIcon data-icon="inline-start" />
                            {t('propertyShow.newContract')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <section aria-label={t('propertyAllocation.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {KINDS.map((key) => (
                    <StatCard
                        key={key}
                        icon={KIND_ICONS[key]}
                        tone={KIND_TONES[key]}
                        label={t(`propertyAllocation.stats.available.${key}`)}
                        value={formatNumber(summaries[key].available)}
                        detail={t(`propertyAllocation.stats.of.${key}`, { count: summaries[key].total })}
                    >
                        <AllocationBar summary={summaries[key]} />
                    </StatCard>
                ))}
                <StatCard
                    icon={BanknoteIcon}
                    tone="success"
                    label={t('propertyAllocation.stats.monthlyRent')}
                    value={formatCurrency(rent.overall, currency)}
                    detail={t('propertyAllocation.stats.rentDetail', {
                        contract: formatCurrency(rent.contract, currency),
                        individual: formatCurrency(rent.individual, currency),
                    })}
                />
            </section>

            <Tabs value={kind} onValueChange={setKind} className="flex-col gap-5">
                <TabsList aria-label={t('propertyAllocation.tabs')} className="h-auto w-full max-w-full justify-start overflow-x-auto p-1 sm:w-fit">
                    {KINDS.map((key) => {
                        const Icon = KIND_ICONS[key];

                        return (
                            <TabsTrigger key={key} value={key} className="h-9 flex-none gap-2 px-3.5 text-[0.875rem] data-active:[&_svg]:text-brand-ink">
                                <Icon data-icon="inline-start" />
                                {t(`propertyAllocation.kinds.${key}`)}
                                <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs leading-5 font-semibold tabular-nums">
                                    {formatNumber(summaries[key].total)}
                                </span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                {KINDS.map((key) => (
                    <TabsContent key={key} value={key}>
                        <AllocationPanel kind={key} rows={rows[key]} summary={summaries[key]} currency={currency} propertyId={property.id} />
                    </TabsContent>
                ))}
            </Tabs>
        </DashboardLayout>
    );
}
