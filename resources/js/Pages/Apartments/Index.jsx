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
    HouseIcon,
    PercentIcon,
    PlusIcon,
    SearchXIcon,
} from 'lucide-react';
import ApartmentActions from './Partials/ApartmentActions';
import ApartmentCard from './Partials/ApartmentCard';
import ApartmentsTable, { APARTMENT_COLUMNS, DEFAULT_HIDDEN_APARTMENT_COLUMNS } from './Partials/ApartmentsTable';
import { APARTMENT_FACET_KEYS, useApartmentFacetOptions } from './Partials/apartmentOptions';

const SEARCH_INPUT_ID = 'apartment-search';

const DEFAULT_QUERY = {
    search: '',
    properties: [],
    status: [],
    furnishing: [],
    bedrooms: [],
    sort: 'apartment',
    direction: 'asc',
    perPage: PER_PAGE_OPTIONS[0],
};

const SORT_OPTIONS = ['apartment', 'rent', 'area', 'bedrooms', 'floor', 'created'];
const FIRST_DIRECTION = { apartment: 'asc', bedrooms: 'asc' };
const LAYOUTS = ['list', 'grid'];
const columnIds = APARTMENT_COLUMNS.map((column) => column.id);
const defaultLayout = () => (window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list');

function ApartmentStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();

    return (
        <section aria-label={t('apartmentList.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={HouseIcon}
                label={t('apartmentList.stats.apartments')}
                value={formatNumber(summary.apartments)}
                detail={t('apartmentList.stats.apartmentsDetail', { reserved: summary.reserved, maintenance: summary.maintenance })}
            />
            <StatCard
                icon={PercentIcon}
                label={t('apartmentList.stats.occupancy')}
                value={summary.occupancyRate === null ? '—' : formatPercent(summary.occupancyRate)}
                meter={summary.occupancyRate ?? 0}
                detail={t('apartmentList.stats.occupancyDetail', { occupied: summary.occupied, total: summary.inService })}
            />
            <StatCard
                icon={DoorOpenIcon}
                tone={summary.vacant > 0 ? 'success' : 'primary'}
                label={t('apartmentList.stats.vacant')}
                value={formatNumber(summary.vacant)}
                detail={t('apartmentList.stats.vacantDetail')}
            />
            <StatCard
                icon={BanknoteIcon}
                label={t('apartmentList.stats.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                detail={t('apartmentList.stats.rentRollDetail')}
            />
        </section>
    );
}

function EmptyState({ hasApartments, onReset }) {
    const { t } = useTranslation();

    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">{hasApartments ? <SearchXIcon /> : <HouseIcon />}</EmptyMedia>
                <EmptyTitle>{t(hasApartments ? 'apartmentList.noResults.title' : 'apartmentList.empty.title')}</EmptyTitle>
                <EmptyDescription>
                    {t(hasApartments ? 'apartmentList.noResults.description' : 'apartmentList.empty.description')}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {hasApartments ? (
                    <Button variant="outline" onClick={onReset}>
                        {t('properties.filters.clearAll')}
                    </Button>
                ) : (
                    <Button nativeButton={false} render={<Link href={route('apartments.create')} />}>
                        <PlusIcon data-icon="inline-start" />
                        {t('apartmentList.add')}
                    </Button>
                )}
            </EmptyContent>
        </Empty>
    );
}

function ApartmentList({ company, filters, facets, summary, apartments }) {
    const { t } = useTranslation();
    const { query, search, setSearch, clearSearch, reset, visit, sortBy, isLoading } = useListQuery({
        routeName: 'apartments.index',
        filters,
        defaults: DEFAULT_QUERY,
        facetKeys: APARTMENT_FACET_KEYS,
        only: ['apartments', 'facets'],
    });
    const facetOptions = useApartmentFacetOptions(facets);
    const labels = Object.fromEntries(APARTMENT_FACET_KEYS.map((key) => [key, t(`apartmentList.filters.${key}`)]));

    const [layout, setLayout] = useStoredState('estatecamp.apartments.layout', defaultLayout, (value) => LAYOUTS.includes(value));
    const [hiddenColumns, setHiddenColumns] = useStoredState(
        'estatecamp.apartments.hiddenColumns',
        DEFAULT_HIDDEN_APARTMENT_COLUMNS,
        (value) => Array.isArray(value) && value.every((id) => columnIds.includes(id)),
    );

    let content;

    if (apartments.data.length === 0) {
        content = <EmptyState hasApartments={summary.apartments > 0} onReset={reset} />;
    } else if (layout === 'grid') {
        content = (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
                {apartments.data.map((apartment) => (
                    <ApartmentCard
                        key={apartment.id}
                        apartment={apartment}
                        currency={company.currency}
                        actions={<ApartmentActions apartment={apartment} onImage />}
                    />
                ))}
            </div>
        );
    } else {
        content = (
            <ApartmentsTable
                apartments={apartments.data}
                currency={company.currency}
                query={query}
                onSort={(sort) => sortBy(sort, FIRST_DIRECTION[sort])}
                hiddenColumns={hiddenColumns}
            />
        );
    }

    return (
        <Card className="gap-0 py-0">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                        <ListSearch
                            id={SEARCH_INPUT_ID}
                            value={search}
                            onChange={setSearch}
                            placeholder={t('apartmentList.searchPlaceholder')}
                            label={t('apartmentList.searchLabel')}
                            isLoading={isLoading}
                        />
                        {APARTMENT_FACET_KEYS.filter((key) => facetOptions[key].length > 0).map((key) => (
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
                            options={SORT_OPTIONS.map((value) => ({ value, label: t(`apartmentList.sort.${value}`) }))}
                            sort={query.sort}
                            direction={query.direction}
                            onSortChange={(sort, direction) => visit({ sort, direction })}
                        />
                        {layout === 'list' && (
                            <ColumnsMenu
                                columns={APARTMENT_COLUMNS.filter((column) => column.hideable !== false).map((column) => ({
                                    id: column.id,
                                    label: t(`apartmentList.columns.${column.id}`),
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
                    facetKeys={APARTMENT_FACET_KEYS}
                    labels={labels}
                    facetOptions={facetOptions}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSearchClear={clearSearch}
                    onReset={reset}
                />
            </div>

            <p role="status" className="sr-only">
                {t('apartmentList.count', { count: apartments.total })}
            </p>

            <div aria-busy={isLoading} className={cn('transition-opacity', isLoading && 'opacity-60')}>
                {content}
            </div>

            {apartments.total > 0 && (
                <CardFooter className="bg-transparent px-4 py-3 sm:px-5">
                    <ListPagination
                        paginator={apartments}
                        perPage={query.perPage}
                        onPageChange={(page) => visit({}, page)}
                        onPerPageChange={(perPage) => visit({ perPage })}
                    />
                </CardFooter>
            )}
        </Card>
    );
}

export default function Index({ company, filters, facets, summary, apartments }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('apartmentList.title')} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.properties'), href: route('properties.index') }, { label: t('apartmentList.title') }]}
                title={t('apartmentList.title')}
                count={summary?.apartments}
                description={t('apartmentList.description')}
                actions={
                    company !== null && (
                        <Button nativeButton={false} render={<Link href={route('apartments.create')} />}>
                            <PlusIcon data-icon="inline-start" />
                            {t('apartmentList.add')}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={HouseIcon} />
            ) : (
                <>
                    <ApartmentStats summary={summary} currency={company.currency} />
                    <ApartmentList company={company} filters={filters} facets={facets} summary={summary} apartments={apartments} />
                </>
            )}
        </DashboardLayout>
    );
}
