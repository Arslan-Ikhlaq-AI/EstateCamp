import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { SearchIcon, XIcon } from 'lucide-react';

function FilterChip({ label, value, icon: Icon, onRemove }) {
    const { t } = useTranslation();

    return (
        <Badge variant="secondary" className="h-7 gap-1.5 rounded-md ps-2 pe-1 text-[0.875rem] font-normal">
            {Icon && <Icon data-icon="inline-start" className="text-muted-foreground" />}
            <span className="text-muted-foreground">{label}:</span>
            <span className="max-w-48 truncate font-medium">{value}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={t('properties.filters.remove', { label: `${label}: ${value}` })}
                className="flex size-5 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
                <XIcon className="size-3.5" />
            </button>
        </Badge>
    );
}

/**
 * The search term and every selected filter value as a removable chip, so
 * what narrows the list is always in view. `labels` names each facet key.
 */
export default function ActiveFilters({ query, facetKeys, labels, facetOptions, onFilterChange, onSearchClear, onReset }) {
    const { t } = useTranslation();

    const chips = facetKeys.flatMap((key) =>
        query[key].map((value) => {
            const option = facetOptions[key].find((item) => item.value === value);

            return {
                id: `${key}:${value}`,
                label: labels[key],
                value: option?.label ?? value,
                icon: option?.icon,
                onRemove: () => onFilterChange(key, query[key].filter((item) => item !== value)),
            };
        }),
    );

    if (query.search) {
        chips.unshift({
            id: 'search',
            label: t('properties.filters.search'),
            value: `“${query.search}”`,
            icon: SearchIcon,
            onRemove: onSearchClear,
        });
    }

    if (chips.length === 0) {
        return null;
    }

    return (
        <div
            role="group"
            aria-label={t('properties.filters.active')}
            className="flex flex-wrap items-center gap-1.5"
        >
            {chips.map(({ id, ...chip }) => (
                <FilterChip key={id} {...chip} />
            ))}
            <Button variant="link" size="sm" className="h-7 px-1.5" onClick={onReset}>
                {t('properties.filters.clearAll')}
            </Button>
        </div>
    );
}
