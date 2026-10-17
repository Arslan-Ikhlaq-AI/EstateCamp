import ActiveFilters from '@/Components/ActiveFilters';
import FlashMessages from '@/Components/FlashMessages';
import ListPagination, { PER_PAGE_OPTIONS } from '@/Components/ListPagination';
import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
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
import { Building2Icon, PlusIcon, SearchXIcon } from 'lucide-react';
import { FACET_KEYS, useFacetOptions } from './Partials/facets';
import PortfolioStats from './Partials/PortfolioStats';
import PropertiesGrid from './Partials/PropertiesGrid';
import PropertiesTable, { DEFAULT_HIDDEN_COLUMNS, TABLE_COLUMNS } from './Partials/PropertiesTable';
import PropertyToolbar, { SEARCH_INPUT_ID } from './Partials/PropertyToolbar';

const DEFAULT_QUERY = {
    search: '',
    types: [],
    status: [],
    ownership: [],
    cities: [],
    sort: 'name',
    direction: 'asc',
    perPage: PER_PAGE_OPTIONS[0],
};

/**
 * The direction a column sorts in when first chosen: text and dates A→Z,
 * figures largest first.
 */
const FIRST_DIRECTION = { name: 'asc', code: 'asc', lease_end: 'asc' };

const LAYOUTS = ['list', 'grid'];
const columnIds = TABLE_COLUMNS.map((column) => column.id);

// Phones start on cards, where a wide table would need sideways scrolling.
const defaultLayout = () => (window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list');

function NoProperties() {
    const { t } = useTranslation();

    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Building2Icon />
                </EmptyMedia>
                <EmptyTitle>{t('properties.empty.title')}</EmptyTitle>
                <EmptyDescription>{t('properties.empty.description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button nativeButton={false} render={<Link href={route('properties.create')} />}>
                    <PlusIcon data-icon="inline-start" />
                    {t('properties.add')}
                </Button>
            </EmptyContent>
        </Empty>
    );
}

function NoResults({ onReset }) {
    const { t } = useTranslation();

    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>{t('properties.noResults.title')}</EmptyTitle>
                <EmptyDescription>{t('properties.noResults.description')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button variant="outline" onClick={onReset}>
                    {t('properties.filters.clearAll')}
                </Button>
            </EmptyContent>
        </Empty>
    );
}

function PropertyList({ company, filters, facets, summary, properties }) {
    const { t } = useTranslation();
    const { query, search, setSearch, clearSearch, reset, visit, sortBy, isLoading } = useListQuery({
        routeName: 'properties.index',
        filters,
        defaults: DEFAULT_QUERY,
        facetKeys: FACET_KEYS,
        only: ['properties', 'facets'],
    });
    const facetOptions = useFacetOptions(facets);

    const [layout, setLayout] = useStoredState('estatecamp.properties.layout', defaultLayout, (value) =>
        LAYOUTS.includes(value),
    );
    const [hiddenColumns, setHiddenColumns] = useStoredState(
        'estatecamp.properties.hiddenColumns',
        DEFAULT_HIDDEN_COLUMNS,
        (value) => Array.isArray(value) && value.every((id) => columnIds.includes(id)),
    );

    const resetAndFocus = () => {
        reset();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
    };


    let content;

    if (summary.properties === 0) {
        content = <NoProperties />;
    } else if (properties.data.length === 0) {
        content = <NoResults onReset={resetAndFocus} />;
    } else if (layout === 'grid') {
        content = <PropertiesGrid properties={properties.data} currency={company.currency} />;
    } else {
        content = (
            <PropertiesTable
                properties={properties.data}
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
                <PropertyToolbar
                    search={search}
                    onSearchChange={setSearch}
                    query={query}
                    facetOptions={facetOptions}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSortChange={(sort, direction) => visit({ sort, direction })}
                    layout={layout}
                    onLayoutChange={setLayout}
                    hiddenColumns={hiddenColumns}
                    onHiddenColumnsChange={setHiddenColumns}
                    isLoading={isLoading}
                />
                <ActiveFilters
                    query={query}
                    facetKeys={FACET_KEYS}
                    labels={Object.fromEntries(FACET_KEYS.map((key) => [key, t(`properties.filters.${key}`)]))}
                    facetOptions={facetOptions}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSearchClear={clearSearch}
                    onReset={reset}
                />
            </div>

            <p role="status" className="sr-only">
                {t('properties.count', { count: properties.total })}
            </p>

            <div
                aria-busy={isLoading}
                className={cn('transition-opacity', isLoading && 'opacity-60')}
            >
                {content}
            </div>

            {properties.total > 0 && (
                <CardFooter className="bg-transparent px-4 py-3 sm:px-5">
                    <ListPagination
                        paginator={properties}
                        perPage={query.perPage}
                        onPageChange={(page) => visit({}, page)}
                        onPerPageChange={(perPage) => visit({ perPage })}
                    />
                </CardFooter>
            )}
        </Card>
    );
}

export default function Index({ company, filters, facets, summary, properties }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('properties.title')} />

            <PageHeader
                breadcrumbs={[{ label: t('properties.title') }]}
                title={t('properties.title')}
                count={summary?.properties}
                description={t('properties.description')}
                actions={
                    company !== null && (
                        <Button nativeButton={false} render={<Link href={route('properties.create')} />}>
                            <PlusIcon data-icon="inline-start" />
                            {t('properties.add')}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={Building2Icon} />
            ) : (
                <>
                    <PortfolioStats summary={summary} currency={company.currency} />
                    <PropertyList
                        company={company}
                        filters={filters}
                        facets={facets}
                        summary={summary}
                        properties={properties}
                    />
                </>
            )}
        </DashboardLayout>
    );
}
