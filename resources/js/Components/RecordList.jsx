import ActiveFilters from '@/Components/ActiveFilters';
import FacetFilter from '@/Components/FacetFilter';
import ListPagination, { PER_PAGE_OPTIONS } from '@/Components/ListPagination';
import { ListSearch } from '@/Components/ListToolbar';
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
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { SearchXIcon } from 'lucide-react';

/**
 * A searchable, filterable, paginated list in a card, kept in the URL like
 * the Rooms list. `facets` maps each filter key to its options
 * (`{ value, label, count, icon }`) and `labels` names each filter. The
 * table goes in `children`; `empty` is shown when there is nothing yet, and
 * a "no matches" message when the filters hide everything.
 */
export default function RecordList({ routeName, filters, facets, labels, only, paginator, searchLabel, searchPlaceholder, empty, children }) {
    const { t } = useTranslation();
    const facetKeys = Object.keys(facets);
    const defaults = { search: '', perPage: PER_PAGE_OPTIONS[0], ...Object.fromEntries(facetKeys.map((key) => [key, []])) };
    const { query, search, setSearch, clearSearch, reset, visit, isLoading } = useListQuery({ routeName, filters, defaults, facetKeys, only });
    const isFiltered = query.search !== '' || facetKeys.some((key) => query[key].length > 0);

    let content = children;

    if (paginator.data.length === 0) {
        content = isFiltered ? (
            <Empty className="py-16">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('leasing.list.noResults.title')}</EmptyTitle>
                    <EmptyDescription>{t('leasing.list.noResults.description')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" onClick={reset}>
                        {t('properties.filters.clearAll')}
                    </Button>
                </EmptyContent>
            </Empty>
        ) : (
            empty
        );
    }

    return (
        <Card className="gap-0 py-0">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:px-5">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <ListSearch
                        id={`${routeName}-search`}
                        value={search}
                        onChange={setSearch}
                        placeholder={searchPlaceholder}
                        label={searchLabel}
                        isLoading={isLoading}
                    />
                    {facetKeys
                        .filter((key) => facets[key].length > 0)
                        .map((key) => (
                            <FacetFilter
                                key={key}
                                title={labels[key]}
                                options={facets[key]}
                                selected={query[key]}
                                onChange={(values) => visit({ [key]: values })}
                            />
                        ))}
                </div>
                <ActiveFilters
                    query={query}
                    facetKeys={facetKeys}
                    labels={labels}
                    facetOptions={facets}
                    onFilterChange={(key, values) => visit({ [key]: values })}
                    onSearchClear={clearSearch}
                    onReset={reset}
                />
            </div>

            <div aria-busy={isLoading} className={cn('transition-opacity', isLoading && 'opacity-60')}>
                {content}
            </div>

            {paginator.total > 0 && (
                <CardFooter className="bg-transparent px-4 py-3 sm:px-5">
                    <ListPagination
                        paginator={paginator}
                        perPage={query.perPage}
                        onPageChange={(page) => visit({}, page)}
                        onPerPageChange={(perPage) => visit({ perPage })}
                    />
                </CardFooter>
            )}
        </Card>
    );
}

/**
 * Shown instead of a list to a user who does not belong to a company.
 */
export function NoCompany({ icon: Icon }) {
    const { t } = useTranslation();

    return (
        <Empty className="border bg-card py-16 shadow-(--card-shadow)">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon />
                </EmptyMedia>
                <EmptyTitle>{t('dashboard.noCompany.title')}</EmptyTitle>
                <EmptyDescription>{t('dashboard.noCompany.description')}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

/**
 * The "nothing here yet" message for a list, with its icon and an action such as "Add client".
 */
export function ListEmpty({ icon: Icon, title, description, action }) {
    return (
        <Empty className="py-16">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Icon />
                </EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {action && <EmptyContent>{action}</EmptyContent>}
        </Empty>
    );
}
