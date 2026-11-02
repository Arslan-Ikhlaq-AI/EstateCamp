import FacetFilter from '@/Components/FacetFilter';
import { ColumnsMenu, LayoutToggle, ListSearch, SortMenu } from '@/Components/ListToolbar';
import { useTranslation } from '@/hooks/use-translation';
import { FACET_KEYS } from './facets';
import { TABLE_COLUMNS } from './PropertiesTable';

export const SEARCH_INPUT_ID = 'property-search';

const SORT_OPTIONS = ['name', 'occupancy', 'rooms', 'rent_roll', 'lease_end', 'created'];

/**
 * Search, filters, sorting and layout controls above the property list.
 * Below `xl` the search shares the first row with the layout switch, and
 * sorting and the filters scroll sideways in one row below; from `xl` they
 * all sit in one line, with sorting and layout at the end.
 */
export default function PropertyToolbar({
    search,
    onSearchChange,
    query,
    facetOptions,
    onFilterChange,
    onSortChange,
    layout,
    onLayoutChange,
    hiddenColumns,
    onHiddenColumnsChange,
    isLoading,
}) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-wrap items-center gap-2">
            <ListSearch
                id={SEARCH_INPUT_ID}
                value={search}
                onChange={onSearchChange}
                placeholder={t('properties.toolbar.search')}
                label={t('properties.toolbar.searchLabel')}
                isLoading={isLoading}
                className="min-w-0 flex-1 xl:w-64 xl:flex-none 2xl:w-80"
            />

            <div className="flex items-center gap-2 xl:order-last">
                {layout === 'list' && (
                    <div className="hidden lg:contents">
                        <ColumnsMenu
                            columns={TABLE_COLUMNS.filter((column) => column.hideable !== false).map((column) => ({
                                id: column.id,
                                label: t(`properties.columns.${column.id}`),
                            }))}
                            hiddenColumns={hiddenColumns}
                            onHiddenColumnsChange={onHiddenColumnsChange}
                        />
                    </div>
                )}
                <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
            </div>

            <div className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] xl:contents [&::-webkit-scrollbar]:hidden">
                <div className="flex shrink-0 xl:order-1 xl:ms-auto">
                    <SortMenu
                        options={SORT_OPTIONS.map((value) => ({ value, label: t(`properties.sort.${value}`) }))}
                        sort={query.sort}
                        direction={query.direction}
                        onSortChange={onSortChange}
                    />
                </div>

                {FACET_KEYS.filter((key) => facetOptions[key].length > 0).map((key) => (
                    <FacetFilter
                        key={key}
                        title={t(`properties.filters.${key}`)}
                        options={facetOptions[key]}
                        selected={query[key]}
                        onChange={(values) => onFilterChange(key, values)}
                    />
                ))}
            </div>
        </div>
    );
}
