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
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, StoreIcon } from 'lucide-react';
import ShopActions from './ShopActions';
import { AmenityIcons, ShopStatusBadge, useShopPlacement } from './ShopBits';
import { TYPE_ICONS, useShopTypeLabel } from './shopOptions';

/**
 * Table columns in display order. `sort` is the server sort key a header
 * toggles; columns without `hideable: false` can be hidden from the toolbar.
 */
export const SHOP_COLUMNS = [
    { id: 'shop', sort: 'shop', hideable: false },
    { id: 'property' },
    { id: 'type', sort: 'area' },
    { id: 'rent', sort: 'rent', align: 'end' },
    { id: 'amenities' },
    { id: 'status' },
];

export const DEFAULT_HIDDEN_SHOP_COLUMNS = [];

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

function Cell({ column, shop, currency }) {
    const { t, formatCurrency, formatNumber } = useTranslation();
    const placement = useShopPlacement();
    const typeLabel = useShopTypeLabel();

    switch (column.id) {
        case 'shop': {
            const TypeIcon = TYPE_ICONS[shop.type] ?? StoreIcon;

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="size-10 rounded-lg after:rounded-lg">
                        <AvatarFallback className="rounded-lg">
                            <TypeIcon className="size-4" />
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                        <Link href={route('shops.show', shop.id)} className="font-medium hover:underline">
                            {t('shopList.shop', { number: shop.number })}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">{placement(shop) || '—'}</span>
                    </div>
                </div>
            );
        }
        case 'property':
            return (
                <div className="flex max-w-48 flex-col items-start">
                    <span dir="auto" className="max-w-full truncate">{shop.property.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{shop.property.code}</span>
                </div>
            );
        case 'type':
            return (
                <div className="flex flex-col">
                    <span>{shop.type ? typeLabel(shop.type) : '—'}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {shop.areaSqm ? `${formatNumber(shop.areaSqm)} m²` : '—'}
                    </span>
                </div>
            );
        case 'rent':
            return shop.monthlyRent === null ? (
                <span className="text-xs text-muted-foreground">{t('shopList.noRent')}</span>
            ) : (
                <div className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatCurrency(shop.monthlyRent, currency)}</span>
                    {shop.securityDeposit !== null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {t('shopList.deposit', { amount: formatCurrency(shop.securityDeposit, currency) })}
                        </span>
                    )}
                </div>
            );
        case 'amenities':
            return <AmenityIcons amenities={shop.amenities} />;
        case 'status':
            return <ShopStatusBadge status={shop.status} />;
        default:
            return null;
    }
}

/**
 * Shops as a table with sortable headers and a menu per row.
 */
export default function ShopsTable({ shops, currency, query, onSort, hiddenColumns }) {
    const { t } = useTranslation();
    const columns = SHOP_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

    return (
        <Table>
            <TableHeader className={HEADER_BACKGROUND}>
                <TableRow className="hover:bg-transparent">
                    {columns.map((column, index) => {
                        const label = t(`shopList.columns.${column.id}`);
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
                        <span className="sr-only">{t('shopList.columns.actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {shops.map((shop) => (
                    <TableRow key={shop.id} className={cn('group/row', ROW_HOVER_BACKGROUND)}>
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn('py-3', index === 0 && 'ps-4 sm:ps-5', column.align === 'end' && 'text-end')}
                            >
                                <Cell column={column} shop={shop} currency={currency} />
                            </TableCell>
                        ))}
                        <TableCell className="sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5">
                            <ShopActions shop={shop} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
