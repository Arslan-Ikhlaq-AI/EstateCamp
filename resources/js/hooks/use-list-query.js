import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 300;

/**
 * The query string for a list query, leaving out anything at its default
 * so links stay short.
 */
function toQueryString(query, defaults, page) {
    const params = Object.fromEntries(
        Object.entries(query).filter(([key, value]) =>
            Array.isArray(value) ? value.length > 0 : value !== defaults[key],
        ),
    );

    return page > 1 ? { ...params, page } : params;
}

/**
 * Keeps a list's search, filters, sorting and paging in the URL. Changes
 * apply straight away in the UI and reload only `only` from the server; the
 * search box waits for a pause in typing.
 *
 * @param {{ routeName: string, filters: object, defaults: object, facetKeys: string[], only: string[] }} options
 */
export function useListQuery({ routeName, filters, defaults, facetKeys, only }) {
    const [query, setQuery] = useState(filters);
    const [search, setSearch] = useState(filters.search);
    const [isLoading, setIsLoading] = useState(false);
    const latestQuery = useRef(filters);

    useEffect(() => {
        latestQuery.current = filters;
        setQuery(filters);
    }, [filters]);

    const visit = useCallback(
        (changes, page = 1) => {
            const next = { ...latestQuery.current, ...changes };

            latestQuery.current = next;
            setQuery(next);

            router.get(route(routeName), toQueryString(next, defaults, page), {
                only: [...only, 'filters'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setIsLoading(true),
                onFinish: () => setIsLoading(false),
            });
        },
        // The other options are constants of the calling page.
        [routeName],
    );

    useEffect(() => {
        const term = search.trim();

        if (term === latestQuery.current.search) {
            return undefined;
        }

        const timeout = setTimeout(() => visit({ search: term }), SEARCH_DELAY_MS);

        return () => clearTimeout(timeout);
    }, [search, visit]);

    const clearSearch = () => {
        setSearch('');
        visit({ search: '' });
    };

    const reset = () => {
        setSearch('');
        visit({ search: '', ...Object.fromEntries(facetKeys.map((key) => [key, []])) });
    };

    /**
     * Sorts by a column, flipping the direction when it is already chosen.
     */
    const sortBy = (sort, firstDirection = 'desc') =>
        visit({
            sort,
            direction:
                query.sort === sort ? (query.direction === 'asc' ? 'desc' : 'asc') : firstDirection,
        });

    return { query, search, setSearch, clearSearch, reset, visit, sortBy, isLoading };
}
