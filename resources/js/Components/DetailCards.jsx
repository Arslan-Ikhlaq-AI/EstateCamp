import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A titled card for one part of a record's page. `flush` lets a table run
 * edge to edge, straight under the header.
 */
export function SectionCard({ title, description, action, className, contentClassName, flush = false, children }) {
    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
                {action && <CardAction>{action}</CardAction>}
            </CardHeader>
            <CardContent className={cn(flush && '-my-(--card-spacing) px-0', contentClassName)}>{children}</CardContent>
        </Card>
    );
}

/**
 * Label and value pairs in a grid; a missing value shows a dash.
 * `rows` are `{ label, value }`.
 */
export function DetailList({ rows, columns = 2 }) {
    return (
        <dl className={cn('grid gap-x-6 gap-y-4', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
            {rows.map((row) => (
                <div key={row.label} className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                    <dd className="text-sm font-medium break-words">{row.value === null || row.value === undefined || row.value === '' ? '—' : row.value}</dd>
                </div>
            ))}
        </dl>
    );
}
