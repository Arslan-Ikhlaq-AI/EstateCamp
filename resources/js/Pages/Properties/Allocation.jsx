import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { downloadCsv } from '@/lib/csv';
import { Head, Link, router } from '@inertiajs/react';
import { BanknoteIcon, ChevronDownIcon, DownloadIcon, EyeIcon, FilePlusIcon, FileSpreadsheetIcon, KeyRoundIcon, ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';
import AllocationPanel, { AllocationBar, KIND_ICONS, allocationCsv } from './Partials/AllocationPanel';
import BillingPanel from './Partials/BillingPanel';

const KINDS = ['rooms', 'shops', 'apartments'];

const KIND_TONES = { rooms: 'primary', shops: 'gold', apartments: 'violet' };

/**
 * Named periods the filter offers, looking both back and ahead; any month
 * or range of days can be chosen too.
 */
const PERIOD_PRESETS = ['this_month', 'next_month', 'last_month', 'this_quarter', 'next_quarter', 'last_quarter', 'this_year', 'last_year'];

/**
 * Downloads of the period's units as CSV files that open in Excel: one
 * kind, or every kind one after another, each followed by its summary.
 */
function ExportMenu({ property, rows, summaries, currency, period, periodLabel, includesToday }) {
    const { t, tOr } = useTranslation();
    const csvFor = (kind) => allocationCsv({ kind, rows: rows[kind], summary: summaries[kind], currency, periodLabel, includesToday, t, tOr });
    const download = (name, header, lines) => downloadCsv(`room-allocation-${property.code}-${name}-${period.from}-to-${period.to}.csv`, header, lines);

    const downloadAll = () => {
        const sections = KINDS.filter((kind) => rows[kind].length > 0).map((kind) => ({ kind, ...csvFor(kind) }));

        download(
            'all',
            [`${property.name} · ${t('propertyAllocation.title')} · ${periodLabel}`],
            sections.flatMap(({ kind, header, rows: lines }, index) => [...(index > 0 ? [[]] : []), [t(`propertyAllocation.kinds.${kind}`)], header, ...lines]),
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                <DownloadIcon data-icon="inline-start" />
                {t('reports.common.export')}
                <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('reports.common.exportLabel')}</DropdownMenuLabel>
                    {KINDS.map((kind) => {
                        const Icon = KIND_ICONS[kind];

                        return (
                            <DropdownMenuItem
                                key={kind}
                                disabled={rows[kind].length === 0}
                                onClick={() => {
                                    const { header, rows: lines } = csvFor(kind);
                                    download(kind, header, lines);
                                }}
                            >
                                <Icon />
                                {t(`propertyAllocation.kinds.${kind}`)}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={downloadAll}>
                        <FileSpreadsheetIcon />
                        {t('propertyAllocation.exportAll')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * A property's room allocation over a period: how many rooms, shops and
 * apartments are available, then a tab per kind listing every unit with who
 * holds it — a contract, a short-term rental, or nobody — its
 * standard and actual rent, and a summary. The billing tab bills each
 * company for the period as a whole and collects its payments.
 */
export default function Allocation({ property, period, includesToday, rooms, shops, apartments, summaries, accounts, collectionMethods, currency }) {
    const { t, tOr, formatNumber, formatCurrency } = useTranslation();
    const { range } = usePeriodLabel();
    const periodLabel = range(period);
    const changePeriod = (value) =>
        router.get(route('properties.allocation', property.id), value ? { period: value } : {}, { preserveScroll: true, preserveState: true });
    const rows = { rooms, shops, apartments };
    const [kind, setKind] = useState(() => KINDS.find((key) => rows[key].length > 0) ?? 'rooms');
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const rent = KINDS.reduce(
        (total, key) => ({
            contract: total.contract + summaries[key].rent.contract,
            shortTerm: total.shortTerm + summaries[key].rent.short_term,
            overall: total.overall + summaries[key].rent.overall,
        }),
        { contract: 0, shortTerm: 0, overall: 0 },
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
                        <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.create', { property: property.id })} />}>
                            <KeyRoundIcon data-icon="inline-start" />
                            {t('propertyAllocation.rentShortTerm')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                            <FilePlusIcon data-icon="inline-start" />
                            {t('propertyShow.newContract')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                    <PeriodFilter period={period} onChange={changePeriod} presets={PERIOD_PRESETS} allowsAll={false} />
                    <p className="min-w-0 flex-1 basis-72 text-[0.875rem] text-pretty text-muted-foreground">{t('propertyAllocation.periodHint', { period: periodLabel })}</p>
                </div>
                <ExportMenu
                    property={property}
                    rows={rows}
                    summaries={summaries}
                    currency={currency}
                    period={period}
                    periodLabel={periodLabel}
                    includesToday={includesToday}
                />
            </div>

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
                        shortTerm: formatCurrency(rent.shortTerm, currency),
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
                    <TabsTrigger value="billing" className="h-9 flex-none gap-2 px-3.5 text-[0.875rem] data-active:[&_svg]:text-brand-ink">
                        <ReceiptTextIcon data-icon="inline-start" />
                        {t('propertyAllocation.billing.tab')}
                        <span className="rounded-full bg-foreground/[0.07] px-1.5 text-xs leading-5 font-semibold tabular-nums">{formatNumber(accounts.length)}</span>
                    </TabsTrigger>
                </TabsList>

                {KINDS.map((key) => (
                    <TabsContent key={key} value={key}>
                        <AllocationPanel
                            kind={key}
                            rows={rows[key]}
                            summary={summaries[key]}
                            currency={currency}
                            propertyId={property.id}
                            periodLabel={periodLabel}
                            includesToday={includesToday}
                        />
                    </TabsContent>
                ))}

                <TabsContent value="billing">
                    <BillingPanel
                        accounts={accounts}
                        currency={currency}
                        propertyId={property.id}
                        period={period}
                        periodLabel={periodLabel}
                        methods={collectionMethods}
                    />
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}
