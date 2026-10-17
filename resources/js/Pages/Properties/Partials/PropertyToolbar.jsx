import FacetFilter from '@/Components/FacetFilter';
import { ColumnsMenu, LayoutToggle, ListSearch, SortMenu } from '@/Components/ListToolbar';
import { useTranslation } from '@/hooks/use-translation';
import { FACET_KEYS } from './facets';
import { TABLE_COLUMNS } from './PropertiesTable';

export const SEARCH_INPUT_ID = 'property-search';

const SORT_OPTIONS = ['name', 'occupancy', 'beds', 'rooms', 'rent_roll', 'lease_end', 'created'];

/**
 * Search, filters, sorting and layout controls above the property list.
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
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
                <ListSearch
                    id={SEARCH_INPUT_ID}
                    value={search}
                    onChange={onSearchChange}
                    placeholder={t('properties.toolbar.search')}
                    label={t('properties.toolbar.searchLabel')}
                    isLoading={isLoading}
                />

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

            <div className="flex items-center gap-2">
                <SortMenu
                    options={SORT_OPTIONS.map((value) => ({ value, label: t(`properties.sort.${value}`) }))}
                    sort={query.sort}
                    direction={query.direction}
                    onSortChange={onSortChange}
                />
                {layout === 'list' && (
                    <ColumnsMenu
                        columns={TABLE_COLUMNS.filter((column) => column.hideable !== false).map((column) => ({
                            id: column.id,
                            label: t(`properties.columns.${column.id}`),
                        }))}
                        hiddenColumns={hiddenColumns}
                        onHiddenColumnsChange={onHiddenColumnsChange}
                    />
                )}
                <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
            </div>
        </div>
    );
}
