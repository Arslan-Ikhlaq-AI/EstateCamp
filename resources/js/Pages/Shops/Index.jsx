import ActiveFilters from '@/Components/ActiveFilters';
import FacetFilter from '@/Components/FacetFilter';
import FlashMessages from '@/Components/FlashMessages';
import ListPagination, { PER_PAGE_OPTIONS } from '@/Components/ListPagination';
import {
    ColumnsMenu,
    LayoutToggle,
    ListSearch,
    SortMenu,
} from '@/Components/ListToolbar';
import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardFooter } from '@/components/ui/card';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useListQuery } from '@/hooks/use-list-query';
import { useStoredState } from '@/hooks/use-stored-state';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    DoorOpenIcon,
    PercentIcon,
    PlusIcon,
    SearchXIcon,
    StoreIcon,
} from 'lucide-react';
import ShopActions from './Partials/ShopActions';
import ShopCard from './Partials/ShopCard';
import ShopsTable, { DEFAULT_HIDDEN_SHOP_COLUMNS, SHOP_COLUMNS } from './Partials/ShopsTable';
import { SHOP_FACET_KEYS, useShopFacetOptions } from './Partials/shopOptions';

const SEARCH_INPUT_ID = 'shop-search';

const DEFAULT_QUERY = {
    search: '',
    properties: [],
    status: [],
    types: [],
    sort: 'shop',
    direction: 'asc',
    perPage: PER_PAGE_OPTIONS[0],
};

const SORT_OPTIONS = ['shop', 'rent', 'area', 'floor', 'created'];
const FIRST_DIRECTION = { shop: 'asc', area: 'asc' };
const LAYOUTS = ['list', 'grid'];
const columnIds = SHOP_COLUMNS.map((column) => column.id);
const defaultLayout = () => (window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list');

function ShopStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();

    return (
        <section aria-label={t('shopList.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={StoreIcon}
                label={t('shopList.stats.shops')}
                value={formatNumber(summary.shops)}
                detail={t('shopList.stats.shopsDetail', { reserved: summary.reserved, maintenance: summary.maintenance })}
            />
            <StatCard
                icon={PercentIcon}
                label={t('shopList.stats.occupancy')}
                value={summary.occupancyRate === null ? '—' : formatPercent(summary.occupancyRate)}
                meter={summary.occupancyRate ?? 0}
                detail={t('shopList.stats.occupancyDetail', { occupied: summary.occupied, total: summary.inService })}
            />
            <StatCard
                icon={DoorOpenIcon}
                tone={summary.vacant > 0 ? 'success' : 'primary'}
                label={t('shopList.stats.vacant')}
                value={formatNumber(summary.vacant)}
                detail={t('shopList.stats.vacantDetail')}
            />
            <StatCard
                icon={BanknoteIcon}
                label={t('shopList.stats.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                detail={t('shopList.stats.rentRollDetail')}
            />
        </section>
    );
}

function EmptyState({ hasShops, onReset }) {
    const { t } = useTranslation();

    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">{hasShops ? <SearchXIcon /> : <StoreIcon />}</EmptyMedia>
                <EmptyTitle>{t(hasShops ? 'shopList.noResults.title' : 'shopList.empty.title')}</EmptyTitle>
                <EmptyDescription>
                    {t(hasShops ? 'shopList.noResults.description' : 'shopList.empty.description')}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {hasShops ? (
                    <Button variant="outline" onClick={onReset}>
                        {t('properties.filters.clearAll')}
                    </Button>
                ) : (
                    <Button nativeButton={false} render={<Link href={route('shops.create')} />}>
                        <PlusIcon data-icon="inline-start" />
                        {t('shopList.add')}
                    </Button>
                )}
            </EmptyContent>
        </Empty>
    );
}

function ShopList({ company, filters, facets, summary, shops }) {
    const { t } = useTranslation();
    const { query, search, setSearch, clearSearch, reset, visit, sortBy, isLoading } = useListQuery({
        routeName: 'shops.index',
        filters,
        defaults: DEFAULT_QUERY,
        facetKeys: SHOP_FACET_KEYS,
        only: ['shops', 'facets'],
    });
    const facetOptions = useShopFacetOptions(facets);
    const labels = Object.fromEntries(SHOP_FACET_KEYS.map((key) => [key, t(`shopList.filters.${key}`)]));

    const [layout, setLayout] = useStoredState('estatecamp.shops.layout', defaultLayout, (value) => LAYOUTS.includes(value));
    const [hiddenColumns, setHiddenColumns] = useStoredState(
        'estatecamp.shops.hiddenColumns',
        DEFAULT_HIDDEN_SHOP_COLUMNS,
        (value) => Array.isArray(value) && value.every((id) => columnIds.includes(id)),
    );

    let content;

    if (shops.data.length === 0) {
        content = <EmptyState hasShops={summary.shops > 0} onReset={reset} />;
    } else if (layout === 'grid') {
        content = (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:p-6 2xl:grid-cols-3">
                {shops.data.map((shop) => (
                    <ShopCard
                        key={shop.id}
                        shop={shop}
                        currency={company.currency}
                        actions={<ShopActions shop={shop} onImage />}
                    />
                ))}
            </div>
        );
    } else {
        content = (
            <ShopsTable
                shops={shops.data}
                currency={company.currency}
                query={query}
                onSort={(sort) => sortBy(sort, FIRST_DIRECTION[sort])}
                hiddenColumns={hiddenColumns}
            />
        );
    }

    return (
        <Card className="gap-0 py-0">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5 lg:px-6">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                        <ListSearch
                            id={SEARCH_INPUT_ID}
                            value={search}
                            onChange={setSearch}
                            placeholder={t('shopList.searchPlaceholder')}
                            label={t('shopList.searchLabel')}
                            isLoading={isLoading}
                        />
                        {SHOP_FACET_KEYS.filter((key) => facetOptions[key].length > 0).map((key) => (
                            <FacetFilter
                                key={key}
                                title={labels[key]}
                                options={facetOptions[key]}
                                selected={query[key]}
                                onChange={(values) => visit({ [key]: values })}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <SortMenu
                            options={SORT_OPTIONS.map((value) => ({ value, label: t(`shopList.sort.${value}`) }))}
                            sort={query.sort}
                            direction={query.direction}
                            onSortChange={(sort, direction) => visit({ sort, direction })}
                        />
                        {layout === 'list' && (
                            <ColumnsMenu
                                columns={SHOP_COLUMNS.filter((column) => column.hideable !== false).map((column) => ({
                                    id: column.id,
                                    label: t(`shopList.columns.${column.id}`),
                                }))}
                                hiddenColumns={hiddenColumns}
                                onHiddenColumnsChange={setHiddenColumns}
                            />
                        )}
                        <LayoutToggle layout={layout} onLayoutChange={setLayout} />
                    </div>
                </div>
                <ActiveFilters
                    query={query}
                    facetKeys={SHOP_FACET_KEYS}
                    labels={labels}
                    facetOptions={facetOptions}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSearchClear={clearSearch}
                    onReset={reset}
                />
            </div>

            <p role="status" className="sr-only">
                {t('shopList.count', { count: shops.total })}
            </p>

            <div aria-busy={isLoading} className={cn('transition-opacity', isLoading && 'opacity-60')}>
                {content}
            </div>

            {shops.total > 0 && (
                <CardFooter className="bg-transparent px-4 py-3 sm:px-5 lg:px-6">
                    <ListPagination
                        paginator={shops}
                        perPage={query.perPage}
                        onPageChange={(page) => visit({}, page)}
                        onPerPageChange={(perPage) => visit({ perPage })}
                    />
                </CardFooter>
            )}
        </Card>
    );
}

export default function Index({ company, filters, facets, summary, shops }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('shopList.title')} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.properties'), href: route('properties.index') }, { label: t('shopList.title') }]}
                title={t('shopList.title')}
                count={summary?.shops}
                description={t('shopList.description')}
                actions={
                    company !== null && (
                        <Button nativeButton={false} render={<Link href={route('shops.create')} />}>
                            <PlusIcon data-icon="inline-start" />
                            {t('shopList.add')}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={StoreIcon} />
            ) : (
                <>
                    <ShopStats summary={summary} currency={company.currency} />
                    <ShopList company={company} filters={filters} facets={facets} summary={summary} shops={shops} />
                </>
            )}
        </DashboardLayout>
    );
}
