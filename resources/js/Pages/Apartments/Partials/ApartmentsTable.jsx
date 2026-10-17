import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, HouseIcon } from 'lucide-react';
import ApartmentActions from './ApartmentActions';
import { AmenityIcons, ApartmentStatusBadge, useApartmentLayout, useApartmentPlacement } from './ApartmentBits';
import { FURNISHING_ICONS } from './apartmentOptions';

/**
 * Table columns in display order. `sort` is the server sort key a header
 * toggles; columns without `hideable: false` can be hidden from the toolbar.
 */
export const APARTMENT_COLUMNS = [
    { id: 'apartment', sort: 'apartment', hideable: false },
    { id: 'property' },
    { id: 'layout', sort: 'bedrooms' },
    { id: 'rent', sort: 'rent', align: 'end' },
    { id: 'amenities' },
    { id: 'status' },
];

export const DEFAULT_HIDDEN_APARTMENT_COLUMNS = [];

// Solid equivalents of the header and hover tints, so the pinned actions
// column matches the row it sits on while the rest of the table scrolls under it.
const HEADER_BACKGROUND = 'bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]';
const ROW_HOVER_BACKGROUND = 'hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]';

function SortableHead({ column, query, onSort, className, children }) {
    const isSorted = query.sort === column.sort;
    const isAscending = query.direction === 'asc';
    const SortIcon = !isSorted ? ChevronsUpDownIcon : isAscending ? ArrowUpIcon : ArrowDownIcon;

    return (
        <TableHead
            aria-sort={isSorted ? (isAscending ? 'ascending' : 'descending') : undefined}
            className={cn(column.align === 'end' && 'text-end', className)}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort(column.sort)}
                className={cn(
                    'h-7 px-2 text-muted-foreground',
                    column.align === 'end' ? '-me-2' : '-ms-2',
                    isSorted && 'text-foreground',
                )}
            >
                {children}
                <SortIcon data-icon="inline-end" className={cn(!isSorted && 'opacity-50')} />
            </Button>
        </TableHead>
    );
}

function Cell({ column, apartment, currency }) {
    const { t, formatCurrency, formatNumber } = useTranslation();
    const placement = useApartmentPlacement();
    const layout = useApartmentLayout();

    switch (column.id) {
        case 'apartment':
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="size-10 rounded-lg after:rounded-lg">
                        <AvatarFallback className="rounded-lg">
                            <HouseIcon className="size-4" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                        <Link href={route('apartments.show', apartment.id)} className="font-medium hover:underline">
                            {t('apartmentList.apartment', { number: apartment.number })}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">{placement(apartment) || '—'}</span>
                    </div>
                </div>
            );
        case 'property':
            return (
                <div className="flex max-w-48 flex-col items-start">
                    <span dir="auto" className="max-w-full truncate">{apartment.property.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{apartment.property.code}</span>
                </div>
            );
        case 'layout': {
            const FurnishingIcon = FURNISHING_ICONS[apartment.furnishing];

            return (
                <div className="flex flex-col">
                    <span className="tabular-nums">{layout(apartment)}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        {apartment.areaSqm ? `${formatNumber(apartment.areaSqm)} m²` : '—'}
                        {FurnishingIcon && (
                            <>
                                <span aria-hidden="true">·</span>
                                <FurnishingIcon className="size-3" />
                                {t(`furnishing.${apartment.furnishing}`)}
                            </>
                        )}
                    </span>
                </div>
            );
        }
        case 'rent':
            return apartment.monthlyRent === null ? (
                <span className="text-xs text-muted-foreground">{t('apartmentList.noRent')}</span>
            ) : (
                <div className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatCurrency(apartment.monthlyRent, currency)}</span>
                    {apartment.securityDeposit !== null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {t('apartmentList.deposit', { amount: formatCurrency(apartment.securityDeposit, currency) })}
                        </span>
                    )}
                </div>
            );
        case 'amenities':
            return <AmenityIcons amenities={apartment.amenities} />;
        case 'status':
            return <ApartmentStatusBadge status={apartment.status} />;
        default:
            return null;
    }
}

/**
 * Apartments as a table with sortable headers and a menu per row.
 */
export default function ApartmentsTable({ apartments, currency, query, onSort, hiddenColumns }) {
    const { t } = useTranslation();
    const columns = APARTMENT_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

    return (
        <Table>
            <TableHeader className={HEADER_BACKGROUND}>
                <TableRow className="hover:bg-transparent">
                    {columns.map((column, index) => {
                        const label = t(`apartmentList.columns.${column.id}`);
                        const padding = index === 0 && 'ps-4 sm:ps-5';

                        return column.sort ? (
                            <SortableHead key={column.id} column={column} query={query} onSort={onSort} className={padding}>
                                {label}
                            </SortableHead>
                        ) : (
                            <TableHead
                                key={column.id}
                                className={cn(padding, column.align === 'end' && 'text-end')}
                            >
                                {label}
                            </TableHead>
                        );
                    })}
                    <TableHead className={cn('sticky end-0 w-12 pe-4 sm:pe-5', HEADER_BACKGROUND)}>
                        <span className="sr-only">{t('apartmentList.columns.actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {apartments.map((apartment) => (
                    <TableRow key={apartment.id} className={cn('group/row', ROW_HOVER_BACKGROUND)}>
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn('py-3', index === 0 && 'ps-4 sm:ps-5', column.align === 'end' && 'text-end')}
                            >
                                <Cell column={column} apartment={apartment} currency={currency} />
                            </TableCell>
                        ))}
                        <TableCell className="sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5">
                            <ApartmentActions apartment={apartment} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
