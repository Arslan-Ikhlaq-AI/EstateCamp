import { Checkbox } from '@/components/ui/checkbox';
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

// Solid equivalents of the header and hover tints, so the pinned actions
// column matches the row it sits on while the rest of the table scrolls under it.
const HEADER_BACKGROUND = 'bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))]';
const ROW_HOVER_BACKGROUND = 'hover:bg-[color-mix(in_oklab,var(--color-brand-cyan)_7%,var(--card))]';
const ROW_SELECTED_BACKGROUND = 'data-[state=selected]:bg-[color-mix(in_oklab,var(--color-brand-cyan)_9%,var(--card))]';
const PINNED_SELECTED_BACKGROUND = 'group-data-[state=selected]/row:bg-[color-mix(in_oklab,var(--color-brand-cyan)_9%,var(--card))]';

// The first and last columns line up with the card's own padding.
const edgePadding = (index, count, hasActions) =>
    cn(index === 0 && 'ps-4 sm:ps-5 lg:ps-6', index === count - 1 && !hasActions && 'pe-4 sm:pe-5 lg:pe-6');

/**
 * A plain table: `columns` are `{ id, header, cell: (row) => node, align?, className? }`.
 * `actions(row)` adds a pinned last column, such as a "more" menu or a button.
 * `selection` adds a first column of checkboxes: `{ selected: keys[], onChange: (keys) => void,
 * label: (row) => string, allLabel: string }`.
 */
export default function DataTable({ columns, rows, rowKey = 'id', actions, footer, selection }) {
    const { t } = useTranslation();
    const selectedCount = selection ? rows.filter((row) => selection.selected.includes(row[rowKey])).length : 0;

    const toggle = (key, checked) =>
        selection.onChange(checked ? [...selection.selected, key] : selection.selected.filter((selectedKey) => selectedKey !== key));

    return (
        <Table>
            <TableHeader className={HEADER_BACKGROUND}>
                <TableRow className="hover:bg-transparent">
                    {selection && (
                        <TableHead className="w-10 ps-4 pe-0 sm:ps-5 lg:ps-6">
                            <Checkbox
                                aria-label={selection.allLabel}
                                checked={rows.length > 0 && selectedCount === rows.length}
                                onCheckedChange={(checked) => selection.onChange(checked ? rows.map((row) => row[rowKey]) : [])}
                            />
                        </TableHead>
                    )}
                    {columns.map((column, index) => (
                        <TableHead
                            key={column.id}
                            className={cn(
                                edgePadding(index, columns.length, Boolean(actions)),
                                selection && index === 0 && 'ps-3 sm:ps-3 lg:ps-3',
                                column.align === 'end' && 'text-end',
                                column.className,
                            )}
                        >
                            {column.header}
                        </TableHead>
                    ))}
                    {actions && (
                        <TableHead className={cn('sticky end-0 w-12 pe-4 sm:pe-5 lg:pe-6', HEADER_BACKGROUND)}>
                            <span className="sr-only">{t('leasing.common.actions')}</span>
                        </TableHead>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow
                        key={row[rowKey]}
                        data-state={selection?.selected.includes(row[rowKey]) ? 'selected' : undefined}
                        className={cn('group/row', ROW_HOVER_BACKGROUND, ROW_SELECTED_BACKGROUND)}
                    >
                        {selection && (
                            <TableCell className="w-10 ps-4 pe-0 sm:ps-5 lg:ps-6">
                                <Checkbox
                                    aria-label={selection.label(row)}
                                    checked={selection.selected.includes(row[rowKey])}
                                    onCheckedChange={(checked) => toggle(row[rowKey], checked)}
                                />
                            </TableCell>
                        )}
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn(
                                    'py-3',
                                    edgePadding(index, columns.length, Boolean(actions)),
                                    selection && index === 0 && 'ps-3 sm:ps-3 lg:ps-3',
                                    column.align === 'end' && 'text-end',
                                    column.className,
                                )}
                            >
                                {column.cell(row)}
                            </TableCell>
                        ))}
                        {actions && (
                            <TableCell
                                className={cn(
                                    'sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5 lg:pe-6',
                                    PINNED_SELECTED_BACKGROUND,
                                )}
                            >
                                {actions(row)}
                            </TableCell>
                        )}
                    </TableRow>
                ))}
                {footer}
            </TableBody>
        </Table>
    );
}

/**
 * A totals row for a DataTable's `footer`: `values` holds what each column
 * shows by its id, the first usually naming the row.
 */
export function TotalsRow({ columns, values }) {
    return (
        <TableRow className="border-t-2 bg-muted/40 font-semibold hover:bg-muted/40">
            {columns.map((column, index) => (
                <TableCell key={column.id} className={cn('py-3', edgePadding(index, columns.length, false), column.align === 'end' && 'text-end', column.className)}>
                    {values[column.id] ?? null}
                </TableCell>
            ))}
        </TableRow>
    );
}
