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
import PropertyQuickLinks from './PropertyQuickLinks';
import UnitOccupancyCounts from './UnitOccupancy';

/**
 * Table columns in display order. `sort` is the server sort key a header
 * toggles; columns without `hideable: false` can be hidden from the toolbar.
 */
export const TABLE_COLUMNS = [
    { id: 'property', sort: 'name', hideable: false },
    { id: 'type' },
    { id: 'ownership', sort: 'lease_end' },
    { id: 'occupancy', sort: 'occupancy' },
    { id: 'units' },
    { id: 'rentRoll', sort: 'rent_roll', align: 'end' },
    { id: 'compliance' },
    { id: 'status' },
];

/**
 * Status starts hidden: most properties are active, so the property cell
 * flags only those that are not while the column is off.
 */
export const DEFAULT_HIDDEN_COLUMNS = ['type', 'status'];

// Solid equivalents of the header and hover tints, so the pinned property
// and actions columns match the row they sit on while the rest scrolls under them.
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

/**
 * The property's picture, name, code and where it is. With `flagStatus`,
 * a property that is not active says so under them.
 */
function PropertyCell({ property, flagStatus }) {
    const location = [property.area, property.city].filter(Boolean).join(', ');

    return (
        <div className="flex w-56 items-center gap-3 2xl:w-64">
            <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                <PropertyCover src={property.coverImageUrl} className="transition-transform duration-300 group-hover/row:scale-110 motion-reduce:transform-none" />
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1">
                <Link
                    href={route('properties.show', property.id)}
                    dir="auto"
                    className="max-w-full truncate text-[0.9375rem] leading-tight font-semibold outline-none hover:text-brand-ink focus-visible:underline"
                    title={property.name}
                >
                    {property.name}
                </Link>
                <span className="flex max-w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold tracking-tight text-brand-ink">
                        {property.code}
                    </span>
                    <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0 text-gold" />
                    <span dir="auto" className="truncate" title={property.address ?? undefined}>
                        {location || '—'}
                    </span>
                </span>
                {flagStatus && property.status !== 'active' && <StatusBadge status={property.status} />}
            </div>
        </div>
    );
}

function OccupancyCell({ rooms }) {
    const { t, formatPercent } = useTranslation();

    if (rooms.total === 0) {
        return <span className="text-xs text-muted-foreground">{t('properties.occupancy.noRooms')}</span>;
    }

    return (
        <div className="flex items-center gap-2.5">
            <RadialGauge value={rooms.occupancyRate ?? 0} size={36} thickness={5} label={t('properties.columns.occupancy')} />
            <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold tabular-nums">
                    {rooms.occupancyRate === null ? '—' : formatPercent(rooms.occupancyRate)}
                </span>
                <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {t('properties.occupancy.rooms', { occupied: rooms.occupied, total: rooms.total })}
                </span>
            </div>
        </div>
    );
}

function Cell({ column, property, currency, flagStatus }) {
    const { tOr, formatCurrency } = useTranslation();

    switch (column.id) {
        case 'property':
            return <PropertyCell property={property} flagStatus={flagStatus} />;
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
            return <OccupancyCell rooms={property.roomOccupancy} />;
        case 'units':
            return <UnitOccupancyCounts units={property.unitOccupancy} className="flex-col items-start gap-1" />;
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
 * The property list as a table with sortable headers, the property pinned
 * at the start and its page links and menu pinned at the end, so both stay
 * in view when the table scrolls sideways.
 */
export default function PropertiesTable({ properties, currency, query, onSort, hiddenColumns, className }) {
    const { t } = useTranslation();
    const columns = TABLE_COLUMNS.filter((column) => !hiddenColumns.includes(column.id));

    return (
        <div className={className}>
            <Table>
                <TableHeader className={cn(HEADER_BACKGROUND, '[&_th]:font-semibold [&_th]:tracking-wide [&_th]:uppercase')}>
                    <TableRow className="hover:bg-transparent">
                        {columns.map((column, index) => {
                            const label = t(`properties.columns.${column.id}`);
                            const pinned = index === 0 && cn('sticky start-0 z-10 ps-4 sm:ps-5 lg:ps-6', HEADER_BACKGROUND);

                            return column.sort ? (
                                <SortableHead
                                    key={column.id}
                                    column={column}
                                    query={query}
                                    onSort={onSort}
                                    className={pinned}
                                >
                                    {label}
                                </SortableHead>
                            ) : (
                                <TableHead
                                    key={column.id}
                                    className={cn(pinned, column.align === 'end' && 'text-end')}
                                >
                                    {label}
                                </TableHead>
                            );
                        })}
                        <TableHead className={cn('sticky end-0 z-10 pe-4 text-end sm:pe-5 lg:pe-6', HEADER_BACKGROUND)}>
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
                                        index === 0 && 'sticky start-0 z-10 bg-card ps-4 group-hover/row:bg-inherit sm:ps-5 lg:ps-6',
                                        column.align === 'end' && 'text-end',
                                    )}
                                >
                                    <Cell
                                        column={column}
                                        property={property}
                                        currency={currency}
                                        flagStatus={hiddenColumns.includes('status')}
                                    />
                                </TableCell>
                            ))}
                            <TableCell className="sticky end-0 z-10 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5 lg:pe-6">
                                <PropertyQuickLinks property={property} compact>
                                    <PropertyActions property={property} size="icon-xs" />
                                </PropertyQuickLinks>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
