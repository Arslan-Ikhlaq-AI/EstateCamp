import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsLeftIcon,
    ChevronsRightIcon,
} from 'lucide-react';

export const PER_PAGE_OPTIONS = [10, 25, 50];

/**
 * The range shown, a page-size picker and first/previous/next/last buttons
 * for a Laravel paginator.
 */
export default function ListPagination({ paginator, perPage, onPageChange, onPerPageChange }) {
    const { t } = useTranslation();
    const { current_page: page, last_page: lastPage, from, to, total } = paginator;

    const pageButtons = [
        { label: t('properties.pagination.first'), icon: ChevronsLeftIcon, target: 1, disabled: page <= 1, className: 'hidden sm:inline-flex' },
        { label: t('properties.pagination.previous'), icon: ChevronLeftIcon, target: page - 1, disabled: page <= 1 },
        { label: t('properties.pagination.next'), icon: ChevronRightIcon, target: page + 1, disabled: page >= lastPage },
        { label: t('properties.pagination.last'), icon: ChevronsRightIcon, target: lastPage, disabled: page >= lastPage, className: 'hidden sm:inline-flex' },
    ];

    return (
        <div className="flex w-full flex-col-reverse items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground tabular-nums">
                {t('properties.pagination.showing', { from: from ?? 0, to: to ?? 0, total })}
            </p>

            <div className="flex items-center gap-4 lg:gap-6">
                <div className="hidden items-center gap-2 sm:flex">
                    <span id="rows-per-page" className="text-sm font-medium">
                        {t('properties.pagination.rowsPerPage')}
                    </span>
                    <Select
                        items={PER_PAGE_OPTIONS.map((option) => ({ value: option, label: String(option) }))}
                        value={perPage}
                        onValueChange={onPerPageChange}
                    >
                        <SelectTrigger size="sm" className="w-18" aria-labelledby="rows-per-page">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {PER_PAGE_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <span className="text-sm font-medium tabular-nums">
                    {t('properties.pagination.page', { page, pages: lastPage })}
                </span>

                <div className="flex items-center gap-1">
                    {pageButtons.map(({ label, icon: Icon, target, disabled, className }) => (
                        <Button
                            key={label}
                            variant="outline"
                            size="icon-sm"
                            aria-label={label}
                            disabled={disabled}
                            onClick={() => onPageChange(target)}
                            className={className}
                        >
                            <Icon className="rtl:rotate-180" />
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
