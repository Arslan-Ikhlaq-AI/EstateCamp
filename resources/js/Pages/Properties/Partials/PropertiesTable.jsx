import PropertyCover from '@/Components/PropertyCover';
import RadialGauge from '@/Components/RadialGauge';
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
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, MapPinIcon } from 'lucide-react';
import {
    ComplianceBadge,
    LeaseNote,
    OwnershipBadge,
    StatusBadge,
} from './PropertyBadges';
import PropertyActions from './PropertyActions';
import UnitOccupancyCounts from './UnitOccupancy';

/**
 * Table columns in display order. `sort` is the server sort key a header
 * toggles; columns without `hideable: false` can be hidden from the toolbar.
 */
export const TABLE_COLUMNS = [
    { id: 'property', sort: 'name', hideable: false },
    { id: 'location' },
    { id: 'type' },
    { id: 'ownership', sort: 'lease_end' },
    { id: 'occupancy', sort: 'occupancy' },
    { id: 'units' },
    { id: 'rentRoll', sort: 'rent_roll', align: 'end' },
    { id: 'compliance' },
    { id: 'status' },
];

export const DEFAULT_HIDDEN_COLUMNS = ['type'];

// Solid equivalents of the header and hover tints, so the pinned actions
// column matches the row it sits on while the rest of the table scrolls under it.
const HEADER_BACKGROUND = 'bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))]';
const ROW_HOVER_BACKGROUND = 'hover:bg-[color-mix(in_oklab,var(--color-brand-cyan)_7%,var(--card))]';

function SortableHead({ column, query, onSort, className, children }) {
    const isSorted = query.sort === column.sort;
    const isAscending = query.direction === 'asc';
    const SortIcon = !isSorted ? ChevronsUpDownIcon : isAscending ? ArrowUpIcon : ArrowDownIcon;

    let ariaSort;

    if (isSorted) {
        ariaSort = isAscending ? 'ascending' : 'descending';
    }

    return (
        <TableHead aria-sort={ariaSort} className={cn(column.align === 'end' && 'text-end', className)}>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort(column.sort)}
                className={cn(
                    'h-7 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase',
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

function PropertyCell({ property }) {
    const { tOr } = useTranslation();

    return (
        <div className="flex max-w-56 items-center gap-3">
            <div className="h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-foreground/10 transition-transform duration-200 group-hover/row:scale-105 motion-reduce:transform-none">
                <PropertyCover src={property.coverImageUrl} />
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1">
                <Link
                    href={route('properties.show', property.id)}
                    dir="auto"
                    className="max-w-full truncate font-semibold outline-none hover:text-brand-ink focus-visible:underline"
                    title={property.name}
                >
                    {property.name}
                </Link>
                <span className="flex max-w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold tracking-tight text-brand-ink">
                        {property.code}
                    </span>
                    {property.type && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">
                                {tOr(`propertyTypes.${property.typeSlug}`, property.type)}
                            </span>
                        </>
                    )}
                </span>
            </div>
        </div>
    );
}

function OccupancyCell({ beds }) {
    const { t, formatPercent } = useTranslation();

    if (beds.total === 0) {
        return <span className="text-xs text-muted-foreground">{t('properties.occupancy.noBeds')}</span>;
    }

    return (
        <div className="flex items-center gap-2.5">
            <RadialGauge value={beds.occupancyRate ?? 0} size={36} thickness={5} label={t('properties.columns.occupancy')} />
            <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold tabular-nums">
                    {beds.occupancyRate === null ? '—' : formatPercent(beds.occupancyRate)}
                </span>
                <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {t('properties.occupancy.beds', { occupied: beds.occupied, total: beds.total })}
                </span>
            </div>
        </div>
    );
}

function Cell({ column, property, currency }) {
    const { tOr, formatCurrency } = useTranslation();

    switch (column.id) {
        case 'property':
            return <PropertyCell property={property} />;
        case 'location':
            return (
                <div className="flex max-w-36 items-start gap-1.5">
                    <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
                    <div className="flex min-w-0 flex-col items-start">
                        <span dir="auto" className="max-w-full truncate font-medium" title={property.address ?? undefined}>
                            {property.area ?? '—'}
                        </span>
                        <span dir="auto" className="max-w-full truncate text-xs text-muted-foreground">
                            {property.city ?? property.address}
                        </span>
                    </div>
                </div>
            );
        case 'type':
            return property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : '—';
        case 'ownership':
            return (
                <div className="flex flex-col items-start gap-1">
                    <OwnershipBadge ownership={property.ownership} />
                    <LeaseNote property={property} />
                </div>
            );
        case 'occupancy':
            return <OccupancyCell beds={property.beds} />;
        case 'units':
            return <UnitOccupancyCounts units={property.unitOccupancy} className="flex-nowrap" />;
        case 'rentRoll':
            return (
                <span className="font-bold tabular-nums">
                    {formatCurrency(property.rentRoll, currency)}
                </span>
            );
        case 'compliance':
            return <ComplianceBadge documents={property.documents} />;
        case 'status':
            return <StatusBadge status={property.status} />;
        default:
            return null;
    }
}

/**
 * The property list as a table with sortable headers and a menu per row.
 */
export default function PropertiesTable({ properties, currency, query, onSort, hiddenColumns }) {
    const { t } = useTranslation();
    const columns = TABLE_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

    return (
        <Table>
            <TableHeader className={cn(HEADER_BACKGROUND, '[&_th]:font-semibold [&_th]:tracking-wide [&_th]:uppercase')}>
                <TableRow className="hover:bg-transparent">
                    {columns.map((column, index) => {
                        const label = t(`properties.columns.${column.id}`);
                        const padding = index === 0 && 'ps-4 sm:ps-5 lg:ps-6';

                        return column.sort ? (
                            <SortableHead
                                key={column.id}
                                column={column}
                                query={query}
                                onSort={onSort}
                                className={padding}
                            >
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
                    <TableHead className={cn('sticky end-0 w-12 pe-4 sm:pe-5 lg:pe-6', HEADER_BACKGROUND)}>
                        <span className="sr-only">{t('properties.columns.actions')}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {properties.map((property) => (
                    <TableRow key={property.id} className={cn('group/row transition-colors', ROW_HOVER_BACKGROUND)}>
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn(
                                    'py-3.5',
                                    index === 0 &&
                                        'relative ps-4 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-e-full before:bg-linear-to-b before:from-brand-cyan before:to-gold before:opacity-0 before:transition-opacity group-hover/row:before:opacity-100 sm:ps-5 lg:ps-6',
                                    column.align === 'end' && 'text-end',
                                )}
                            >
                                <Cell column={column} property={property} currency={currency} />
                            </TableCell>
                        ))}
                        <TableCell className="sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5 lg:pe-6 before:pointer-events-none before:absolute before:inset-y-0 before:-start-4 before:w-4 before:bg-linear-to-l before:from-black/[0.04] before:to-transparent rtl:before:bg-linear-to-r dark:before:from-black/30">
                            <PropertyActions property={property} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
