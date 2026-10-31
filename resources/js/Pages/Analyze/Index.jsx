import ChangeBadge from '@/Components/ChangeBadge';
import { CASH_CATEGORIES } from '@/Components/FinanceBadges';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { todayIso } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { Building2Icon, ChartNoAxesCombinedIcon, CoinsIcon, InfoIcon, PlusIcon, ReceiptIcon, ScaleIcon, TrophyIcon } from 'lucide-react';
import { useState } from 'react';
import MoneyMix from './Partials/MoneyMix';
import ProfitByProperty from './Partials/ProfitByProperty';
import PropertyRanking from './Partials/PropertyRanking';
import PropertyTrends from './Partials/PropertyTrends';
import RevenueByProperty from './Partials/RevenueByProperty';
import RevenueColumns from './Partials/RevenueColumns';
import { SOURCE_COLORS, SOURCES } from './Partials/chartParts';

/**
 * What the company spends on its properties, in the colours and icons the
 * payments section gives the same money. The order keeps the violet of the
 * bills away from the grey of other payments, which sit too close on the
 * dark theme to touch round the donut.
 */
const SPENDING = {
    landlord: CASH_CATEGORIES.landlord_rent,
    bills: CASH_CATEGORIES.maintenance,
    contracts: CASH_CATEGORIES.maintenance_contract,
    others: CASH_CATEGORIES.other_payment,
};

const SOURCE_ICONS = {
    contract_rent: CASH_CATEGORIES.client_payment.icon,
    short_term: CASH_CATEGORIES.rental_payment.icon,
    extra_income: CASH_CATEGORIES.extra_income.icon,
};

const PRESSED = 'aria-pressed:bg-primary aria-pressed:text-primary-foreground';

const COLUMNS_ID = 'analyze-revenue-columns';

/**
 * The filters over the whole page, in one row: the period, the kind of
 * property and how the timeline groups its days.
 */
function Filters({ period, type, propertyTypes, by, buckets, onChange }) {
    const { t, formatNumber } = useTranslation();

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <PeriodFilter period={period} allowsAll={false} onChange={(value) => onChange({ period: value || undefined, by: undefined })} />

            {propertyTypes.length > 1 && (
                <div className="max-w-full overflow-x-auto">
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[type ?? 'all']}
                        onValueChange={([value]) => value && onChange({ type: value === 'all' ? undefined : value })}
                        aria-label={t('analyze.filters.type')}
                    >
                        <ToggleGroupItem value="all" className={PRESSED}>
                            <Building2Icon data-icon="inline-start" />
                            {t('analyze.filters.allTypes')}
                        </ToggleGroupItem>
                        {propertyTypes.map((option) => (
                            <ToggleGroupItem key={option.value} value={option.value} className={cn('gap-2', PRESSED)}>
                                {option.label}
                                <span className="text-xs opacity-70 tabular-nums">{formatNumber(option.count)}</span>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            )}

            {buckets.length > 1 && (
                <div className="flex items-center gap-2 sm:ms-auto">
                    <span className="text-sm text-muted-foreground">{t('analyze.filters.groupBy')}</span>
                    <ToggleGroup variant="outline" spacing={0} value={[by]} onValueChange={([value]) => value && onChange({ by: value })} aria-label={t('analyze.filters.groupBy')}>
                        {buckets.map((bucket) => (
                            <ToggleGroupItem key={bucket} value={bucket} className={PRESSED}>
                                {t(`analyze.filters.${bucket}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            )}
        </div>
    );
}

export default function Index({ company, period, through, isToDate, previousPeriod, by, buckets, type, propertyTypes, timeline, totals, properties, unlinked }) {
    const { t, formatCurrency, formatDate, formatPercent } = useTranslation();
    const { full, range } = usePeriodLabel();
    const [isLoading, setIsLoading] = useState(false);
    const [focus, setFocus] = useState('all');
    const title = t('analyze.title');

    if (company === null) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={[{ label: title }]} title={title} description={t('analyze.description')} />
                <NoCompany icon={ChartNoAxesCombinedIcon} />
            </DashboardLayout>
        );
    }

    const currency = company.currency;
    const previousLabel = previousPeriod ? range(previousPeriod) : null;
    const top = properties[0]?.revenue > 0 ? properties[0] : null;
    const earning = properties.filter((property) => property.revenue > 0).length;
    const isAhead = period.from > todayIso();

    const visit = (params) =>
        router.get(route('analyze'), { ...route().params, ...params }, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setIsLoading(true),
            onFinish: () => setIsLoading(false),
        });

    const toggleFocus = (id) => {
        if (focus === String(id)) {
            setFocus('all');

            return;
        }

        setFocus(String(id));
        document.getElementById(COLUMNS_ID)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };

    const sources = SOURCES.map((source) => ({ key: source, label: t(`analyze.sources.${source}`), value: totals.sources[source], color: SOURCE_COLORS[source], icon: SOURCE_ICONS[source] }));
    const spending = Object.entries(SPENDING).map(([kind, category]) => ({ key: kind, label: t(`analyze.spending.${kind}`), value: totals.spending[kind], color: category.color, icon: category.icon }));

    return (
        <DashboardLayout>
            <Head title={`${title} · ${full(period)}`} />

            <PageHeader breadcrumbs={[{ label: title }]} title={title} description={t('analyze.description')} />

            <div className="flex flex-col gap-2.5">
                <Filters period={period} type={type} propertyTypes={propertyTypes} by={by} buckets={buckets} onChange={visit} />
                <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                    {previousLabel && <span>{t('analyze.comparedWith', { period: previousLabel })}</span>}
                    {previousLabel && isToDate && <span aria-hidden="true">·</span>}
                    {isToDate && <span>{t('analyze.countedTo', { date: formatDate(through) })}</span>}
                </p>
            </div>

            {properties.length === 0 ? (
                <Card className="py-0">
                    <ListEmpty
                        icon={Building2Icon}
                        title={t('analyze.empty.title')}
                        description={t('analyze.empty.description')}
                        action={
                            <Button nativeButton={false} render={<Link href={route('properties.create')} />}>
                                <PlusIcon data-icon="inline-start" />
                                {t('properties.add')}
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <div aria-busy={isLoading} className={cn('flex flex-col gap-6 transition-opacity duration-200 lg:gap-8', isLoading && 'opacity-60')}>
                    {isAhead && (
                        <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                            <InfoIcon className="size-4 shrink-0 text-brand-ink" />
                            {t('analyze.future')}
                        </p>
                    )}

                    <RevenueColumns
                        id={COLUMNS_ID}
                        timeline={timeline}
                        by={by}
                        totals={totals}
                        properties={properties}
                        focus={focus}
                        onFocusChange={setFocus}
                        previousLabel={previousLabel}
                        currency={currency}
                    />

                    <section aria-label={t('analyze.stats.label')} className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={CoinsIcon}
                            label={t('analyze.stats.revenue')}
                            value={formatCurrency(totals.revenue, currency)}
                            detail={t('analyze.stats.earning', { count: earning, total: properties.length })}
                            badge={<ChangeBadge current={totals.revenue} previous={totals.previous?.revenue} previousLabel={previousLabel} />}
                        />
                        <StatCard
                            icon={ReceiptIcon}
                            tone="gold"
                            label={t('analyze.stats.expenses')}
                            value={formatCurrency(totals.expenses, currency)}
                            detail={t('analyze.stats.expensesDetail')}
                            badge={<ChangeBadge current={totals.expenses} previous={totals.previous?.expenses} isGoodWhenUp={false} previousLabel={previousLabel} />}
                        />
                        <StatCard
                            icon={ScaleIcon}
                            tone={totals.net < 0 ? 'warning' : 'success'}
                            label={t('analyze.stats.net')}
                            value={formatCurrency(totals.net, currency)}
                            detail={totals.net < 0 ? t('analyze.stats.loss') : totals.revenue > 0 ? t('analyze.stats.margin', { percent: formatPercent((totals.net / totals.revenue) * 100) }) : null}
                            badge={<ChangeBadge current={totals.net} previous={totals.previous?.net} previousLabel={previousLabel} />}
                        />
                        <StatCard
                            icon={TrophyIcon}
                            tone="violet"
                            label={t('analyze.stats.top')}
                            value={
                                top ? (
                                    <span dir="auto" className="block truncate">
                                        {top.name}
                                    </span>
                                ) : (
                                    '—'
                                )
                            }
                            detail={
                                top
                                    ? `${formatCurrency(top.revenue, currency)} · ${t('analyze.stats.topShare', { percent: formatPercent((top.revenue / totals.revenue) * 100) })}`
                                    : t('analyze.stats.noTop')
                            }
                            href={top ? route('properties.show', top.id) : undefined}
                        />
                    </section>

                    <div className="grid items-start gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <RevenueByProperty properties={properties} totals={totals} currency={currency} />
                        <MoneyMix
                            title={t('analyze.sources.title')}
                            description={t('analyze.sources.description')}
                            totalLabel={t('analyze.sources.total')}
                            segments={sources}
                            currency={currency}
                            empty={t('analyze.stats.noTop')}
                        />
                    </div>

                    <PropertyTrends
                        properties={properties}
                        totals={totals}
                        timeline={timeline}
                        by={by}
                        previousLabel={previousLabel}
                        currency={currency}
                        focus={focus}
                        onFocus={toggleFocus}
                    />

                    <div className="grid items-start gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
                        <ProfitByProperty properties={properties} currency={currency} />
                        <MoneyMix
                            title={t('analyze.spending.title')}
                            description={t('analyze.spending.description')}
                            totalLabel={t('analyze.spending.total')}
                            segments={spending}
                            currency={currency}
                            empty={t('analyze.spending.none')}
                        />
                    </div>

                    <PropertyRanking properties={properties} totals={totals} unlinked={unlinked} period={period} previousLabel={previousLabel} currency={currency} />

                    <p className="max-w-4xl text-[0.8125rem] text-pretty text-muted-foreground">{t('analyze.notes')}</p>
                </div>
            )}
        </DashboardLayout>
    );
}
