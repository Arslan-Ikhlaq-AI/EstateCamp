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
const HEADER_BACKGROUND = 'bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]';
const ROW_HOVER_BACKGROUND = 'hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]';

// The first and last columns line up with the card's own padding.
const edgePadding = (index, count, hasActions) =>
    cn(index === 0 && 'ps-4 sm:ps-5', index === count - 1 && !hasActions && 'pe-4 sm:pe-5');

/**
 * A plain table: `columns` are `{ id, header, cell: (row) => node, align?, className? }`.
 * `actions(row)` adds a pinned last column, such as a "more" menu or a button.
 */
export default function DataTable({ columns, rows, rowKey = 'id', actions, footer }) {
    const { t } = useTranslation();

    return (
        <Table>
            <TableHeader className={HEADER_BACKGROUND}>
                <TableRow className="hover:bg-transparent">
                    {columns.map((column, index) => (
                        <TableHead
                            key={column.id}
                            className={cn(edgePadding(index, columns.length, Boolean(actions)), column.align === 'end' && 'text-end', column.className)}
                        >
                            {column.header}
                        </TableHead>
                    ))}
                    {actions && (
                        <TableHead className={cn('sticky end-0 w-12 pe-4 sm:pe-5', HEADER_BACKGROUND)}>
                            <span className="sr-only">{t('leasing.common.actions')}</span>
                        </TableHead>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row[rowKey]} className={cn('group/row', ROW_HOVER_BACKGROUND)}>
                        {columns.map((column, index) => (
                            <TableCell
                                key={column.id}
                                className={cn('py-3', edgePadding(index, columns.length, Boolean(actions)), column.align === 'end' && 'text-end', column.className)}
                            >
                                {column.cell(row)}
                            </TableCell>
                        ))}
                        {actions && (
                            <TableCell className="sticky end-0 bg-card pe-4 text-end group-hover/row:bg-inherit sm:pe-5">{actions(row)}</TableCell>
                        )}
                    </TableRow>
                ))}
                {footer}
            </TableBody>
        </Table>
    );
}
