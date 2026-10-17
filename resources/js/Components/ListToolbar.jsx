import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import {
    ArrowDownNarrowWideIcon,
    ArrowDownWideNarrowIcon,
    ArrowUpDownIcon,
    Columns3Icon,
    LayoutGridIcon,
    ListIcon,
    SearchIcon,
    XIcon,
} from 'lucide-react';
import { useEffect } from 'react';

/**
 * Building blocks for a list page's toolbar: search, sorting, column
 * visibility and the list/grid switch.
 */

const isTyping = (element) =>
    element instanceof HTMLElement &&
    (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));

/**
 * A search box that also takes focus when "/" is pressed anywhere on the page.
 */
export function ListSearch({ id, value, onChange, placeholder, label, isLoading }) {
    const { t } = useTranslation();

    useEffect(() => {
        const focusSearch = (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
                return;
            }

            event.preventDefault();
            document.getElementById(id)?.focus();
        };

        window.addEventListener('keydown', focusSearch);

        return () => window.removeEventListener('keydown', focusSearch);
    }, [id]);

    return (
        <InputGroup className="w-full sm:w-64 2xl:w-80">
            <InputGroupAddon>
                <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && value && onChange('')}
                placeholder={placeholder}
                aria-label={label}
                autoComplete="off"
                enterKeyHint="search"
            />
            <InputGroupAddon align="inline-end">
                {isLoading && <Spinner />}
                {!isLoading && value && (
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={t('properties.toolbar.clearSearch')}
                        onClick={() => onChange('')}
                    >
                        <XIcon />
                    </InputGroupButton>
                )}
                {!isLoading && !value && <Kbd className="hidden sm:inline-flex">/</Kbd>}
            </InputGroupAddon>
        </InputGroup>
    );
}

/**
 * @param {{ options: Array<{ value: string, label: string }>, sort: string, direction: string, onSortChange: (sort: string, direction: string) => void }} props
 */
export function SortMenu({ options, sort, direction, onSortChange }) {
    const { t } = useTranslation();
    const current = options.find((option) => option.value === sort);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                <ArrowUpDownIcon data-icon="inline-start" />
                <span className="hidden xl:inline">{t('properties.toolbar.sort')}:</span>
                <span className="font-normal text-muted-foreground xl:-ms-0.5">{current?.label}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('properties.toolbar.sortBy')}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSortChange(value, direction)}>
                        {options.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('properties.toolbar.order')}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={direction} onValueChange={(value) => onSortChange(sort, value)}>
                        <DropdownMenuRadioItem value="asc">
                            <ArrowDownNarrowWideIcon />
                            {t('properties.toolbar.ascending')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="desc">
                            <ArrowDownWideNarrowIcon />
                            {t('properties.toolbar.descending')}
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * @param {{ columns: Array<{ id: string, label: string }>, hiddenColumns: string[], onHiddenColumnsChange: (ids: string[]) => void }} props
 */
export function ColumnsMenu({ columns, hiddenColumns, onHiddenColumnsChange }) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" aria-label={t('properties.toolbar.columns')} />}>
                <Columns3Icon data-icon="inline-start" />
                <span className="hidden 2xl:inline">{t('properties.toolbar.columns')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('properties.toolbar.toggleColumns')}</DropdownMenuLabel>
                    {columns.map((column) => (
                        <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={!hiddenColumns.includes(column.id)}
                            onCheckedChange={(isChecked) =>
                                onHiddenColumnsChange(
                                    isChecked
                                        ? hiddenColumns.filter((id) => id !== column.id)
                                        : [...hiddenColumns, column.id],
                                )
                            }
                        >
                            {column.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function LayoutToggle({ layout, onLayoutChange }) {
    const { t } = useTranslation();

    const layouts = [
        { value: 'list', icon: ListIcon, label: t('properties.toolbar.list') },
        { value: 'grid', icon: LayoutGridIcon, label: t('properties.toolbar.grid') },
    ];

    return (
        <ToggleGroup
            aria-label={t('properties.toolbar.layout')}
            variant="outline"
            spacing={0}
            value={[layout]}
            onValueChange={([value]) => value && onLayoutChange(value)}
        >
            {layouts.map(({ value, icon: Icon, label }) => (
                <Tooltip key={value}>
                    <TooltipTrigger render={<ToggleGroupItem value={value} aria-label={label} />}>
                        <Icon />
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                </Tooltip>
            ))}
        </ToggleGroup>
    );
}
