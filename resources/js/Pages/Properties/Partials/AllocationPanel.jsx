import { ContractStatusBadge } from '@/Components/LeasingBadges';
import { ListSearch } from '@/Components/ListToolbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { DoorOpenIcon, HouseIcon, PlusIcon, StoreIcon } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from './PropertyBadges';

export const KIND_ICONS = { rooms: DoorOpenIcon, shops: StoreIcon, apartments: HouseIcon };

/**
 * How a unit is held, each with its colour: green for a company under
 * contract, violet for an individual, gold for nobody. Rows are tinted to
 * match, and the label always shows too, so colour never carries it alone.
 */
export const ALLOCATIONS = [
    { key: 'contract', swatch: 'bg-success', pill: 'bg-success/12 text-success', row: 'bg-success/[0.06] hover:bg-success/[0.1]' },
    {
        key: 'individual',
        swatch: 'bg-violet-500',
        pill: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
        row: 'bg-violet-500/[0.06] hover:bg-violet-500/[0.1]',
    },
    { key: 'empty', swatch: 'bg-gold', pill: 'bg-gold/20 text-gold-ink', row: 'hover:bg-muted/50' },
];

const ALLOCATION_STYLES = Object.fromEntries(ALLOCATIONS.map((allocation) => [allocation.key, allocation]));

/**
 * A stacked bar of contract, individual and empty units.
 */
export function AllocationBar({ summary, className }) {
    const { t } = useTranslation();

    if (summary.total === 0) {
        return <div className={cn('h-2.5 rounded-full bg-muted', className)} />;
    }

    return (
        <div role="img" aria-label={t('propertyAllocation.bar', summary)} className={cn('flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full', className)}>
            {ALLOCATIONS.filter(({ key }) => summary[key] > 0).map(({ key, swatch }) => (
                <span key={key} className={cn('h-full min-w-1', swatch)} style={{ width: `${(summary[key] / summary.total) * 100}%` }} />
            ))}
        </div>
    );
}

function AllocationPill({ allocation }) {
    const { t } = useTranslation();
    const { swatch, pill } = ALLOCATION_STYLES[allocation];

    return (
        <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold whitespace-nowrap', pill)}>
            <span aria-hidden="true" className={cn('size-1.5 rounded-full', swatch)} />
            {t(`propertyAllocation.allocation.${allocation}`)}
        </span>
    );
}

function UnitCell({ kind, row }) {
    const { t, tOr } = useTranslation();
    const details = [
        row.block && t('propertyAllocation.unit.block', { block: row.block }),
        row.floor !== null && t('propertyAllocation.unit.floor', { floor: row.floor }),
        kind === 'rooms' && row.type && tOr(`roomTypes.${row.type.slug}`, row.type.name),
        kind === 'shops' && row.type && tOr(`shopTypes.${row.type}`, row.type),
        kind === 'apartments' &&
            (row.bedrooms === 0 ? t('propertyAllocation.unit.studio') : t('propertyAllocation.unit.bedrooms', { count: row.bedrooms })),
    ].filter(Boolean);

    return (
        <div className="flex flex-col gap-0.5">
            <span dir="auto" className="font-semibold whitespace-nowrap">
                {row.number}
            </span>
            {details.length > 0 && <span className="text-xs whitespace-nowrap text-muted-foreground">{details.join(' · ')}</span>}
        </div>
    );
}

function CustomerCell({ holdings }) {
    const { t } = useTranslation();
    const [main, ...others] = holdings;

    if (!main) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex max-w-60 flex-col items-start gap-0.5">
            <Link
                href={route('clients.show', main.client.id)}
                dir="auto"
                className="max-w-full truncate font-medium outline-none hover:text-brand-ink focus-visible:underline"
                title={main.client.name}
            >
                {main.client.name}
            </Link>
            {others.length > 0 && (
                <span className="text-xs text-muted-foreground" title={others.map((holding) => holding.client.name).join(', ')}>
                    {t('propertyAllocation.moreHolders', { count: others.length })}
                </span>
            )}
        </div>
    );
}

function ReferenceCell({ holdings }) {
    const { t } = useTranslation();

    if (holdings.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            {holdings.map(({ reference }) => (
                <div key={`${reference.kind}-${reference.id}`} className="flex items-center gap-2">
                    <Link
                        href={reference.kind === 'contract' ? route('contracts.show', reference.id) : route('rentals.show', reference.id)}
                        className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-xs font-semibold whitespace-nowrap text-brand-ink outline-none hover:bg-brand-cyan/20 focus-visible:ring-2 focus-visible:ring-ring/50"
                        title={t(`propertyAllocation.reference.${reference.kind}`)}
                    >
                        {reference.number}
                    </Link>
                    {reference.kind === 'contract' && reference.status !== 'active' && <ContractStatusBadge status={reference.status} />}
                </div>
            ))}
        </div>
    );
}

function PeriodCell({ holding }) {
    const { t, formatDate } = useTranslation();

    if (!holding) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="text-[0.8125rem] whitespace-nowrap tabular-nums">
            {formatDate(holding.startsOn)} – {holding.endsOn ? formatDate(holding.endsOn) : t('propertyAllocation.openEnded')}
        </span>
    );
}

function RentCell({ row, currency }) {
    const { t, formatCurrency } = useTranslation();

    if (row.allocation !== 'empty') {
        return <span className="font-bold whitespace-nowrap tabular-nums">{formatCurrency(row.monthly, currency)}</span>;
    }

    if (row.listRent === null) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="text-[0.8125rem] whitespace-nowrap text-muted-foreground tabular-nums">
            {t('propertyAllocation.listRent', { amount: formatCurrency(row.listRent, currency) })}
        </span>
    );
}

function SummaryTile({ label, value, detail, swatch, isHighlighted = false }) {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-col gap-1.5 rounded-xl p-4 ring-1',
                isHighlighted ? 'bg-primary text-primary-foreground ring-primary' : 'bg-card ring-foreground/10',
            )}
        >
            <dt className={cn('flex items-center gap-2 text-[0.8125rem] font-medium', isHighlighted ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                {swatch && <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', swatch)} />}
                {label}
            </dt>
            <dd className="truncate font-heading text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</dd>
            {detail && <dd className={cn('text-xs', isHighlighted ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{detail}</dd>}
        </div>
    );
}

/**
 * The totals under a tab: how many units each kind of holder has, what
 * contracts and individuals pay a month, both together, and the list rent
 * of what is still available.
 */
function AllocationSummary({ kind, summary, currency }) {
    const { t, formatNumber, formatCurrency } = useTranslation();

    return (
        <section aria-labelledby={`allocation-summary-${kind}`} className="flex flex-col gap-3">
            <h2 id={`allocation-summary-${kind}`} className="font-heading text-lg font-bold tracking-tight">
                {t('propertyAllocation.summary.title')}
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="flex min-w-0 flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                    <dt className="text-[0.8125rem] font-medium text-muted-foreground">{t(`propertyAllocation.summary.total.${kind}`)}</dt>
                    <dd className="font-heading text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{formatNumber(summary.total)}</dd>
                    <dd>
                        <AllocationBar summary={summary} className="h-2" />
                    </dd>
                    <dd>
                        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {ALLOCATIONS.map(({ key, swatch }) => (
                                <li key={key} className="flex items-center gap-1.5">
                                    <span aria-hidden="true" className={cn('size-2 rounded-[2px]', swatch)} />
                                    <span className="text-muted-foreground">{t(`propertyAllocation.allocation.${key}`)}</span>
                                    <span className="font-semibold tabular-nums">{formatNumber(summary[key])}</span>
                                </li>
                            ))}
                        </ul>
                    </dd>
                </div>
                <SummaryTile
                    swatch="bg-success"
                    label={t('propertyAllocation.summary.contractRent')}
                    value={formatCurrency(summary.rent.contract, currency)}
                    detail={t('propertyAllocation.summary.companies', { count: summary.clients.contract })}
                />
                <SummaryTile
                    swatch="bg-violet-500"
                    label={t('propertyAllocation.summary.individualRent')}
                    value={formatCurrency(summary.rent.individual, currency)}
                    detail={t('propertyAllocation.summary.customers', { count: summary.clients.individual })}
                />
                <SummaryTile
                    isHighlighted
                    label={t('propertyAllocation.summary.overallRent')}
                    value={formatCurrency(summary.rent.overall, currency)}
                    detail={t('propertyAllocation.summary.yearly', { amount: formatCurrency(summary.rent.overall * 12, currency) })}
                />
                <SummaryTile
                    swatch="bg-gold"
                    label={t('propertyAllocation.summary.availableRent')}
                    value={formatCurrency(summary.availableListRent, currency)}
                    detail={t(`propertyAllocation.summary.available.${kind}`, { count: summary.available })}
                />
            </dl>
        </section>
    );
}

function NoUnits({ kind, propertyId }) {
    const { t } = useTranslation();
    const Icon = KIND_ICONS[kind];

    return (
        <Card>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon />
                    </EmptyMedia>
                    <EmptyTitle>{t(`propertyAllocation.noUnits.${kind}.title`)}</EmptyTitle>
                    <EmptyDescription>{t(`propertyAllocation.noUnits.${kind}.description`)}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" nativeButton={false} render={<Link href={route('properties.edit', propertyId)} />}>
                        <PlusIcon data-icon="inline-start" />
                        {t('propertyAllocation.noUnits.add')}
                    </Button>
                </EmptyContent>
            </Empty>
        </Card>
    );
}

const matchesSearch = (row, needle) =>
    [row.number, ...row.holdings.flatMap((holding) => [holding.client.name, holding.reference.number])].some((value) =>
        value?.toLowerCase().includes(needle),
    );

/**
 * One tab of the allocation page: every unit of one kind as a row tinted by
 * who holds it, narrowed by holder and search, with the kind's summary below.
 */
export default function AllocationPanel({ kind, rows, summary, currency, propertyId }) {
    const { t, formatNumber } = useTranslation();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    if (rows.length === 0) {
        return <NoUnits kind={kind} propertyId={propertyId} />;
    }

    const needle = search.trim().toLowerCase();
    const visibleRows = rows.filter((row) => (filter === 'all' || row.allocation === filter) && (needle === '' || matchesSearch(row, needle)));
    const filters = [{ key: 'all', count: summary.total }, ...ALLOCATIONS.map(({ key, swatch }) => ({ key, swatch, count: summary[key] }))];

    return (
        <div className="flex flex-col gap-6">
            <Card className="gap-0 overflow-hidden py-0">
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[filter]}
                        onValueChange={([value]) => value && setFilter(value)}
                        aria-label={t('propertyAllocation.filter')}
                        className="max-w-full overflow-x-auto"
                    >
                        {filters.map(({ key, swatch, count }) => (
                            <ToggleGroupItem key={key} value={key} className="gap-2 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                                {swatch && <span aria-hidden="true" className={cn('size-2 rounded-full', swatch)} />}
                                {key === 'all' ? t('propertyAllocation.all') : t(`propertyAllocation.allocation.${key}`)}
                                <span className="text-xs opacity-70 tabular-nums">{formatNumber(count)}</span>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <ListSearch
                        id={`allocation-search-${kind}`}
                        value={search}
                        onChange={setSearch}
                        placeholder={t('propertyAllocation.search')}
                        label={t('propertyAllocation.searchLabel')}
                    />
                </div>

                <Table>
                    <TableHeader className="bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))] [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="ps-4 sm:ps-5 lg:ps-6">{t(`propertyAllocation.columns.unit.${kind}`)}</TableHead>
                            <TableHead>{t('propertyAllocation.columns.allocation')}</TableHead>
                            <TableHead>{t('propertyAllocation.columns.customer')}</TableHead>
                            <TableHead>{t('propertyAllocation.columns.reference')}</TableHead>
                            <TableHead>{t('propertyAllocation.columns.period')}</TableHead>
                            {kind === 'rooms' && <TableHead className="text-end">{t('propertyAllocation.columns.people')}</TableHead>}
                            <TableHead className="pe-4 text-end sm:pe-5 lg:pe-6">{t('propertyAllocation.columns.rent')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleRows.map((row) => (
                            <TableRow key={row.id} className={cn('transition-colors', ALLOCATION_STYLES[row.allocation].row)}>
                                <TableCell className="py-3 ps-4 sm:ps-5 lg:ps-6">
                                    <UnitCell kind={kind} row={row} />
                                </TableCell>
                                <TableCell className="py-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <AllocationPill allocation={row.allocation} />
                                        {!row.inService && <StatusBadge status={row.status} />}
                                    </div>
                                </TableCell>
                                <TableCell className="py-3">
                                    <CustomerCell holdings={row.holdings} />
                                </TableCell>
                                <TableCell className="py-3">
                                    <ReferenceCell holdings={row.holdings} />
                                </TableCell>
                                <TableCell className="py-3">
                                    <PeriodCell holding={row.holdings[0]} />
                                </TableCell>
                                {kind === 'rooms' && <TableCell className="py-3 text-end tabular-nums">{formatNumber(row.people)}</TableCell>}
                                <TableCell className="py-3 pe-4 text-end sm:pe-5 lg:pe-6">
                                    <RentCell row={row} currency={currency} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {visibleRows.length === 0 && (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t(`propertyAllocation.noMatches.${kind}`)}</p>
                )}
            </Card>

            <AllocationSummary kind={kind} summary={summary} currency={currency} />
        </div>
    );
}
