import { ContractStatusBadge } from '@/Components/LeasingBadges';
import ListPagination from '@/Components/ListPagination';
import { ListSearch } from '@/Components/ListToolbar';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { CalendarClockIcon, DoorOpenIcon, FileTextIcon, HouseIcon, PlusIcon, StoreIcon, UserRoundIcon } from 'lucide-react';
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

const PER_PAGE = 50;

const HOLDING_ROUTES = { contract: 'contracts.show', rental: 'rentals.show' };

const HOLDING_ICONS = { contract: FileTextIcon, rental: UserRoundIcon };

/**
 * The block, floor and type of a unit as short phrases, such as
 * "Block A", "Floor 1" and "Dormitory".
 */
function unitDetails(kind, row, t, tOr) {
    return [
        row.block && t('propertyAllocation.unit.block', { block: row.block }),
        row.floor !== null && t('propertyAllocation.unit.floor', { floor: row.floor }),
        kind === 'rooms' && row.type && tOr(`roomTypes.${row.type.slug}`, row.type.name),
        kind === 'shops' && row.type && tOr(`shopTypes.${row.type}`, row.type),
        kind === 'apartments' && (row.bedrooms === 0 ? t('propertyAllocation.unit.studio') : t('propertyAllocation.unit.bedrooms', { count: row.bedrooms })),
    ].filter(Boolean);
}

/**
 * The header and rows of a CSV of one kind's units for the month, followed
 * by its summary. Amounts stay plain numbers so a spreadsheet can add them up.
 */
export function allocationCsv({ kind, rows, summary, currency, periodLabel, includesToday, t, tOr }) {
    const header = [
        t(`propertyAllocation.columns.unit.${kind}`),
        t('propertyAllocation.csv.details'),
        t('propertyAllocation.columns.allocation'),
        t('propertyAllocation.csv.unitStatus'),
        t('propertyAllocation.columns.customer'),
        t('propertyAllocation.columns.reference'),
        t('propertyAllocation.csv.start'),
        t('propertyAllocation.csv.end'),
        t('propertyAllocation.csv.freeFrom'),
        ...(kind === 'rooms' && includesToday ? [t('propertyAllocation.columns.people')] : []),
        `${t('propertyAllocation.columns.standardRent')} (${currency})`,
        `${t('propertyAllocation.columns.actualRent')} (${currency})`,
    ];
    const body = rows.map((row) => [
        row.number,
        unitDetails(kind, row, t, tOr).join(' · '),
        t(`propertyAllocation.allocation.${row.allocation}`),
        row.inService ? t('propertyAllocation.csv.inService') : tOr(`properties.status.${row.status}`, t(`status.${row.status}`)),
        row.holdings.map((holding) => holding.client.name).join('; '),
        row.holdings.map((holding) => holding.reference.number).join('; '),
        row.holdings[0]?.startsOn ?? '',
        row.holdings[0] ? (row.holdings[0].endsOn ?? t('propertyAllocation.openEnded')) : '',
        row.freeFrom ?? '',
        ...(kind === 'rooms' && includesToday ? [row.people] : []),
        row.standardRent ?? '',
        row.allocation === 'empty' ? '' : row.monthly,
    ]);

    return {
        header,
        rows: [
            ...body,
            [],
            [`${t('propertyAllocation.summary.title')} · ${periodLabel}`],
            ...summaryLines(kind, summary, periodLabel, t).map(({ label, value }) => [label, value]),
        ],
    };
}

/**
 * The summary as label and value lines, in two groups: the units, then the
 * rent. Money lines carry `isMoney`; the actual rent is the group's total.
 */
function summaryLines(kind, summary, periodLabel, t) {
    return [
        { group: 'units', label: t(`propertyAllocation.summary.total.${kind}`), value: summary.total, isTotal: true },
        { group: 'units', label: t('propertyAllocation.summary.underContract'), value: summary.contract, swatch: 'bg-success' },
        { group: 'units', label: t('propertyAllocation.summary.withIndividuals'), value: summary.individual, swatch: 'bg-violet-500' },
        { group: 'units', label: t('propertyAllocation.summary.empty'), value: summary.empty, swatch: 'bg-gold' },
        { group: 'units', label: t('propertyAllocation.summary.available'), value: summary.available, isIndented: true },
        { group: 'units', label: t('propertyAllocation.summary.freeing', { period: periodLabel }), value: summary.freeing, isIndented: true },
        { group: 'rent', label: t('propertyAllocation.summary.standardLet'), value: summary.standardRent.let, isMoney: true, isMuted: true },
        {
            group: 'rent',
            label: t('propertyAllocation.summary.contractRent', { count: summary.clients.contract }),
            value: summary.rent.contract,
            isMoney: true,
            swatch: 'bg-success',
        },
        {
            group: 'rent',
            label: t('propertyAllocation.summary.individualRent', { count: summary.clients.individual }),
            value: summary.rent.individual,
            isMoney: true,
            swatch: 'bg-violet-500',
        },
        { group: 'rent', label: t('propertyAllocation.summary.actualRent'), value: summary.rent.overall, isMoney: true, isTotal: true },
        { group: 'rent', label: t('propertyAllocation.summary.difference'), value: summary.difference, isMoney: true, isDifference: true },
        { group: 'rent', label: t('propertyAllocation.summary.expected', { period: periodLabel }), value: summary.expected, isMoney: true },
        { group: 'rent', label: t('propertyAllocation.summary.yearly'), value: summary.rent.overall * 12, isMoney: true },
        { group: 'rent', label: t('propertyAllocation.summary.availableStandard'), value: summary.standardRent.available, isMoney: true, isMuted: true },
    ];
}

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
    const details = unitDetails(kind, row, t, tOr);

    return (
        <div className="flex flex-col gap-0.5">
            <span dir="auto" className="font-semibold whitespace-nowrap">
                {row.number}
            </span>
            {details.length > 0 && <span className="text-xs whitespace-nowrap text-muted-foreground">{details.join(' · ')}</span>}
        </div>
    );
}

/**
 * Who holds the unit, each with the contract or rental they hold it under.
 * Holders the latest ones replaced during the period are muted.
 */
function CustomerCell({ holdings }) {
    const { t } = useTranslation();

    if (holdings.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col items-start gap-2">
            {holdings.map(({ client, reference, isLatest }) => (
                <div key={`${reference.kind}-${reference.id}`} className={cn('flex max-w-64 flex-col items-start gap-1', !isLatest && 'opacity-60')}>
                    <Link
                        href={route('clients.show', client.id)}
                        dir="auto"
                        className="max-w-full truncate font-medium outline-none hover:text-brand-ink focus-visible:underline"
                        title={client.name}
                    >
                        {client.name}
                    </Link>
                    <div className="flex items-center gap-2">
                        <span
                            className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink"
                            title={t(`propertyAllocation.reference.${reference.kind}`)}
                        >
                            {reference.number}
                        </span>
                        {reference.kind === 'contract' && reference.status !== 'active' && <ContractStatusBadge status={reference.status} />}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * A button for each holding that opens its contract, or the individual's
 * rental with the renter, ready to view.
 */
function OpenCell({ holdings }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-end gap-1">
            {holdings.map(({ client, reference }) => {
                const Icon = HOLDING_ICONS[reference.kind];
                const label = t(`propertyAllocation.open.${reference.kind}`, { number: reference.number, name: client.name });

                return (
                    <Tooltip key={`${reference.kind}-${reference.id}`}>
                        <TooltipTrigger
                            render={
                                <Link
                                    href={route(HOLDING_ROUTES[reference.kind], reference.id)}
                                    aria-label={label}
                                    className={cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'text-brand-ink hover:border-brand-cyan/40 hover:bg-brand-cyan/10')}
                                />
                            }
                        >
                            <Icon />
                        </TooltipTrigger>
                        <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}

/**
 * The days each holding runs, in the same order as the customers.
 */
function PeriodCell({ holdings }) {
    const { t, formatDate } = useTranslation();

    if (holdings.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <div className="flex flex-col gap-2">
            {holdings.map(({ reference, startsOn, endsOn, isLatest }) => (
                <div
                    key={`${reference.kind}-${reference.id}`}
                    className={cn('flex flex-col text-[0.8125rem] leading-snug whitespace-nowrap tabular-nums', !isLatest && 'opacity-60')}
                >
                    <span>{formatDate(startsOn)}</span>
                    <span className="text-muted-foreground">– {endsOn ? formatDate(endsOn) : t('propertyAllocation.openEnded')}</span>
                </div>
            ))}
        </div>
    );
}

function Money({ value, currency, className }) {
    const { formatCurrency } = useTranslation();

    if (value === null) {
        return <span className="text-muted-foreground">—</span>;
    }

    return <span className={cn('whitespace-nowrap tabular-nums', className)}>{formatCurrency(value, currency)}</span>;
}

/**
 * One line of the summary statement: a label with an optional colour key,
 * and its count or amount at the end. A total line is set in bold over a rule.
 */
function SummaryLine({ line, currency }) {
    const { formatNumber, formatCurrency } = useTranslation();
    let value = line.isMoney ? formatCurrency(line.value, currency) : formatNumber(line.value);

    if (line.isDifference && line.value > 0) {
        value = `+${value}`;
    }

    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-6 border-b border-foreground/[0.07] py-2.5 last:border-b-0',
                line.isTotal && 'border-t-2 border-t-foreground/15 font-bold first:border-t-0',
            )}
        >
            <dt className={cn('flex min-w-0 items-center gap-2 text-[0.875rem]', line.isIndented && 'ps-5', line.isMuted || line.isIndented ? 'text-muted-foreground' : 'text-foreground')}>
                {line.swatch && <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', line.swatch)} />}
                {line.label}
            </dt>
            <dd
                className={cn(
                    'shrink-0 text-[0.9375rem] tabular-nums',
                    line.isTotal ? 'text-base' : 'font-semibold',
                    line.isMuted && 'font-medium text-muted-foreground',
                    line.isDifference && line.value > 0 && 'text-success',
                    line.isDifference && line.value < 0 && 'text-destructive',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

/**
 * The totals under a tab, set out as a statement: the units by who holds
 * them, then the rent — standard against actual, what contracts and
 * individuals pay, and what the month should bring in.
 */
function AllocationSummary({ kind, summary, currency, periodLabel }) {
    const { t } = useTranslation();
    const lines = summaryLines(kind, summary, periodLabel, t);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('propertyAllocation.summary.title')}</CardTitle>
                <CardDescription>{t(`propertyAllocation.summary.description.${kind}`, { period: periodLabel })}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
                {['units', 'rent'].map((group) => (
                    <section key={group} aria-labelledby={`allocation-${kind}-${group}`} className="flex flex-col gap-2">
                        <h3 id={`allocation-${kind}-${group}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t(`propertyAllocation.summary.groups.${group}`)}
                        </h3>
                        {group === 'units' && <AllocationBar summary={summary} className="my-1 h-2" />}
                        <dl className="flex flex-col">
                            {lines
                                .filter((line) => line.group === group)
                                .map((line) => (
                                    <SummaryLine key={line.label} line={line} currency={currency} />
                                ))}
                        </dl>
                    </section>
                ))}
            </CardContent>
        </Card>
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

const matchesFilter = (row, filter) => filter === 'all' || (filter === 'freeing' ? row.freeFrom !== null : row.allocation === filter);

/**
 * One tab of the allocation page: every unit of one kind in the month as a
 * row tinted by who holds it, narrowed by holder and search, 50 to a page,
 * with the kind's summary below.
 */
export default function AllocationPanel({ kind, rows, summary, currency, propertyId, periodLabel, includesToday }) {
    const { t, formatNumber, formatDate } = useTranslation();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(PER_PAGE);

    if (rows.length === 0) {
        return <NoUnits kind={kind} propertyId={propertyId} />;
    }

    const needle = search.trim().toLowerCase();
    const visibleRows = rows.filter((row) => matchesFilter(row, filter) && (needle === '' || matchesSearch(row, needle)));
    const lastPage = Math.max(1, Math.ceil(visibleRows.length / perPage));
    const currentPage = Math.min(page, lastPage);
    const pageRows = visibleRows.slice((currentPage - 1) * perPage, currentPage * perPage);
    const showsPeople = kind === 'rooms' && includesToday;
    const filters = [
        { key: 'all', count: summary.total },
        ...ALLOCATIONS.map(({ key, swatch }) => ({ key, swatch, count: summary[key] })),
        { key: 'freeing', icon: CalendarClockIcon, count: summary.freeing },
    ];

    return (
        <div className="flex flex-col gap-6">
            <Card className="gap-0 overflow-hidden py-0">
                <div className="flex flex-col gap-3 border-b p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[filter]}
                        onValueChange={([value]) => {
                            if (value) {
                                setFilter(value);
                                setPage(1);
                            }
                        }}
                        aria-label={t('propertyAllocation.filter')}
                        className="max-w-full overflow-x-auto"
                    >
                        {filters.map(({ key, swatch, icon: Icon, count }) => (
                            <ToggleGroupItem key={key} value={key} className="gap-2 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                                {swatch && <span aria-hidden="true" className={cn('size-2 rounded-full', swatch)} />}
                                {Icon && <Icon data-icon="inline-start" />}
                                {key === 'all' ? t('propertyAllocation.all') : t(`propertyAllocation.allocation.${key}`)}
                                <span className="text-xs opacity-70 tabular-nums">{formatNumber(count)}</span>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <ListSearch
                        id={`allocation-search-${kind}`}
                        value={search}
                        onChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
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
                            <TableHead>{t('propertyAllocation.columns.period')}</TableHead>
                            {showsPeople && <TableHead className="text-end">{t('propertyAllocation.columns.people')}</TableHead>}
                            <TableHead className="text-end">{t('propertyAllocation.columns.standardRent')}</TableHead>
                            <TableHead className="text-end">{t('propertyAllocation.columns.actualRent')}</TableHead>
                            <TableHead className="w-12 pe-4 sm:pe-5 lg:pe-6">
                                <span className="sr-only">{t('propertyAllocation.columns.open')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.map((row) => (
                            <TableRow key={row.id} className={cn('transition-colors', ALLOCATION_STYLES[row.allocation].row)}>
                                <TableCell className="py-3 ps-4 sm:ps-5 lg:ps-6">
                                    <UnitCell kind={kind} row={row} />
                                </TableCell>
                                <TableCell className="py-3">
                                    <div className="flex flex-col items-start gap-1">
                                        <AllocationPill allocation={row.allocation} />
                                        {row.freeFrom && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-gold-ink">
                                                <CalendarClockIcon aria-hidden="true" className="size-3.5" />
                                                {t('propertyAllocation.freeFrom', { date: formatDate(row.freeFrom) })}
                                            </span>
                                        )}
                                        {!row.inService && <StatusBadge status={row.status} />}
                                    </div>
                                </TableCell>
                                <TableCell className="py-3">
                                    <CustomerCell holdings={row.holdings} />
                                </TableCell>
                                <TableCell className="py-3">
                                    <PeriodCell holdings={row.holdings} />
                                </TableCell>
                                {showsPeople && <TableCell className="py-3 text-end tabular-nums">{formatNumber(row.people)}</TableCell>}
                                <TableCell className="py-3 text-end">
                                    <Money value={row.standardRent} currency={currency} className="text-muted-foreground" />
                                </TableCell>
                                <TableCell className="py-3 text-end">
                                    <Money value={row.allocation === 'empty' ? null : row.monthly} currency={currency} className="font-bold" />
                                </TableCell>
                                <TableCell className="py-3 pe-4 sm:pe-5 lg:pe-6">
                                    <OpenCell holdings={row.holdings} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {visibleRows.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t(`propertyAllocation.noMatches.${kind}`)}</p>
                ) : (
                    <div className="border-t px-4 py-3 sm:px-5 lg:px-6">
                        <ListPagination
                            paginator={{
                                current_page: currentPage,
                                last_page: lastPage,
                                from: (currentPage - 1) * perPage + 1,
                                to: Math.min(currentPage * perPage, visibleRows.length),
                                total: visibleRows.length,
                            }}
                            perPage={perPage}
                            onPageChange={setPage}
                            onPerPageChange={(value) => {
                                setPerPage(value);
                                setPage(1);
                            }}
                        />
                    </div>
                )}
            </Card>

            <AllocationSummary kind={kind} summary={summary} currency={currency} periodLabel={periodLabel} />
        </div>
    );
}
