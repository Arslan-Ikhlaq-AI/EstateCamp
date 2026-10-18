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
    BedDoubleIcon,
    DoorOpenIcon,
    PercentIcon,
    PlusIcon,
    SearchXIcon,
} from 'lucide-react';
import RoomActions from './Partials/RoomActions';
import RoomCard from './Partials/RoomCard';
import { ROOM_FACET_KEYS, useRoomFacetOptions } from './Partials/roomOptions';
import RoomsTable, { DEFAULT_HIDDEN_ROOM_COLUMNS, ROOM_COLUMNS } from './Partials/RoomsTable';

const SEARCH_INPUT_ID = 'room-search';

const DEFAULT_QUERY = {
    search: '',
    properties: [],
    types: [],
    status: [],
    gender: [],
    availability: [],
    sort: 'room',
    direction: 'asc',
    perPage: PER_PAGE_OPTIONS[0],
};

const SORT_OPTIONS = ['room', 'occupancy', 'capacity', 'rent', 'floor', 'created'];
const FIRST_DIRECTION = { room: 'asc', floor: 'asc' };
const LAYOUTS = ['list', 'grid'];
const columnIds = ROOM_COLUMNS.map((column) => column.id);
const defaultLayout = () => (window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list');

function RoomStats({ summary, currency }) {
    const { t, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const { beds } = summary;

    return (
        <section aria-label={t('roomList.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={DoorOpenIcon}
                label={t('roomList.stats.rooms')}
                value={formatNumber(summary.rooms)}
                detail={t('roomList.stats.roomsDetail', { active: summary.active, maintenance: summary.maintenance })}
            />
            <StatCard
                icon={PercentIcon}
                label={t('roomList.stats.occupancy')}
                value={beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                meter={beds.occupancyRate ?? 0}
                detail={t('roomList.stats.occupancyDetail', { occupied: beds.occupied, total: beds.occupied + beds.available })}
            />
            <StatCard
                icon={BedDoubleIcon}
                tone={beds.available > 0 ? 'success' : 'primary'}
                label={t('roomList.stats.available')}
                value={formatNumber(beds.available)}
                detail={
                    beds.outOfService > 0
                        ? t('roomList.stats.availableDetail', { count: beds.outOfService })
                        : t('roomList.stats.availableReady')
                }
            />
            <StatCard
                icon={BanknoteIcon}
                label={t('roomList.stats.rentRoll')}
                value={formatCurrency(summary.rentRoll, currency)}
                detail={t('roomList.stats.rentRollDetail')}
            />
        </section>
    );
}

function EmptyState({ hasRooms, onReset }) {
    const { t } = useTranslation();

    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">{hasRooms ? <SearchXIcon /> : <DoorOpenIcon />}</EmptyMedia>
                <EmptyTitle>{t(hasRooms ? 'roomList.noResults.title' : 'roomList.empty.title')}</EmptyTitle>
                <EmptyDescription>
                    {t(hasRooms ? 'roomList.noResults.description' : 'roomList.empty.description')}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                {hasRooms ? (
                    <Button variant="outline" onClick={onReset}>
                        {t('properties.filters.clearAll')}
                    </Button>
                ) : (
                    <Button nativeButton={false} render={<Link href={route('rooms.create')} />}>
                        <PlusIcon data-icon="inline-start" />
                        {t('roomList.add')}
                    </Button>
                )}
            </EmptyContent>
        </Empty>
    );
}

function RoomList({ company, filters, facets, summary, rooms }) {
    const { t } = useTranslation();
    const { query, search, setSearch, clearSearch, reset, visit, sortBy, isLoading } = useListQuery({
        routeName: 'rooms.index',
        filters,
        defaults: DEFAULT_QUERY,
        facetKeys: ROOM_FACET_KEYS,
        only: ['rooms', 'facets'],
    });
    const facetOptions = useRoomFacetOptions(facets);
    const labels = Object.fromEntries(ROOM_FACET_KEYS.map((key) => [key, t(`roomList.filters.${key}`)]));

    const [layout, setLayout] = useStoredState('estatecamp.rooms.layout', defaultLayout, (value) => LAYOUTS.includes(value));
    const [hiddenColumns, setHiddenColumns] = useStoredState(
        'estatecamp.rooms.hiddenColumns',
        DEFAULT_HIDDEN_ROOM_COLUMNS,
        (value) => Array.isArray(value) && value.every((id) => columnIds.includes(id)),
    );

    let content;

    if (rooms.data.length === 0) {
        content = <EmptyState hasRooms={summary.rooms > 0} onReset={reset} />;
    } else if (layout === 'grid') {
        content = (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:p-6 2xl:grid-cols-3">
                {rooms.data.map((room) => (
                    <RoomCard key={room.id} room={room} currency={company.currency} actions={<RoomActions room={room} onImage />} />
                ))}
            </div>
        );
    } else {
        content = (
            <RoomsTable
                rooms={rooms.data}
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
                            placeholder={t('roomList.searchPlaceholder')}
                            label={t('roomList.searchLabel')}
                            isLoading={isLoading}
                        />
                        {ROOM_FACET_KEYS.filter((key) => facetOptions[key].length > 0).map((key) => (
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
                            options={SORT_OPTIONS.map((value) => ({ value, label: t(`roomList.sort.${value}`) }))}
                            sort={query.sort}
                            direction={query.direction}
                            onSortChange={(sort, direction) => visit({ sort, direction })}
                        />
                        {layout === 'list' && (
                            <ColumnsMenu
                                columns={ROOM_COLUMNS.filter((column) => column.hideable !== false).map((column) => ({
                                    id: column.id,
                                    label: t(`roomList.columns.${column.id}`),
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
                    facetKeys={ROOM_FACET_KEYS}
                    labels={labels}
                    facetOptions={facetOptions}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSearchClear={clearSearch}
                    onReset={reset}
                />
            </div>

            <p role="status" className="sr-only">
                {t('roomList.count', { count: rooms.total })}
            </p>

            <div aria-busy={isLoading} className={cn('transition-opacity', isLoading && 'opacity-60')}>
                {content}
            </div>

            {rooms.total > 0 && (
                <CardFooter className="bg-transparent px-4 py-3 sm:px-5 lg:px-6">
                    <ListPagination
                        paginator={rooms}
                        perPage={query.perPage}
                        onPageChange={(page) => visit({}, page)}
                        onPerPageChange={(perPage) => visit({ perPage })}
                    />
                </CardFooter>
            )}
        </Card>
    );
}

export default function Index({ company, filters, facets, summary, rooms }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('roomList.title')} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.properties'), href: route('properties.index') }, { label: t('roomList.title') }]}
                title={t('roomList.title')}
                count={summary?.rooms}
                description={t('roomList.description')}
                actions={
                    company !== null && (
                        <Button nativeButton={false} render={<Link href={route('rooms.create')} />}>
                            <PlusIcon data-icon="inline-start" />
                            {t('roomList.add')}
                        </Button>
                    )
                }
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={DoorOpenIcon} />
            ) : (
                <>
                    <RoomStats summary={summary} currency={company.currency} />
                    <RoomList company={company} filters={filters} facets={facets} summary={summary} rooms={rooms} />
                </>
            )}
        </DashboardLayout>
    );
}
