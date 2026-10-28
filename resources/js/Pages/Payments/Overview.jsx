import ChangeBadge from '@/Components/ChangeBadge';
import DataTable from '@/Components/DataTable';
import DonutChart, { DonutLegend } from '@/Components/DonutChart';
import { CASH_CATEGORIES, METHOD_ICONS, transactionHref } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { useCanOpen } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDownLeftIcon,
    ArrowRightIcon,
    ArrowUpRightIcon,
    BanknoteIcon,
    ChevronDownIcon,
    FileSignatureIcon,
    FileStackIcon,
    HandCoinsIcon,
    KeyRoundIcon,
    LandmarkIcon,
    PlusIcon,
    ReceiptTextIcon,
    ScaleIcon,
    ScrollTextIcon,
    WalletIcon,
    WrenchIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const IN = ['client_payment', 'rental_payment'];
const OUT = ['landlord_rent', 'salary', 'maintenance', 'maintenance_contract', 'deposit_refund', 'other_payment'];

const sum = (totals, categories) => categories.reduce((total, category) => total + (totals?.[category]?.amount ?? 0), 0);
const count = (totals, categories) => categories.reduce((total, category) => total + (totals?.[category]?.count ?? 0), 0);

/**
 * Twelve months of money in and out, ending with the period's last month.
 * Money in in the brand blue, money out in gold, as on the dashboard.
 */
function CashFlowChart({ trend, currency }) {
    const { t, locale, dir, isRtl, formatCurrency, formatMoney } = useTranslation();
    const intl = LOCALES[locale].intl;
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const monthFormat = new Intl.DateTimeFormat(intl, { month: 'short' });
    const fullMonthFormat = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' });
    const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });
    const toDate = (month) => new Date(`${month}-01T00:00:00`);
    const data = trend.map((point) => ({ ...point, label: monthFormat.format(toDate(point.month)) }));
    const totalIn = trend.reduce((total, point) => total + point.in, 0);
    const totalOut = trend.reduce((total, point) => total + point.out, 0);
    const config = {
        in: { label: t('finance.directions.in'), color: 'var(--cash-in)' },
        out: { label: t('finance.directions.out'), color: 'var(--cash-out)' },
    };

    return (
        <Card className="min-w-0 xl:col-span-2">
            <CardHeader>
                <CardTitle>{t('finance.overview.trend.title')}</CardTitle>
                <CardDescription>{t('finance.overview.trend.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                    {['in', 'out'].map((key) => (
                        <div key={key} className="flex flex-col gap-0.5">
                            <dt className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                                <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: config[key].color }} />
                                {config[key].label}
                            </dt>
                            <dd className="text-lg font-bold tracking-tight tabular-nums">{formatCurrency(key === 'in' ? totalIn : totalOut, currency)}</dd>
                        </div>
                    ))}
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-[0.8125rem] text-muted-foreground">{t('finance.overview.trend.net')}</dt>
                        <dd className={cn('text-lg font-bold tracking-tight tabular-nums', totalIn - totalOut < 0 && 'text-destructive')}>{formatCurrency(totalIn - totalOut, currency)}</dd>
                    </div>
                </dl>
                <ChartContainer config={config} dir="ltr" className="aspect-auto h-64 w-full flex-1" initialDimension={{ width: 640, height: 256 }}>
                    <AreaChart accessibilityLayer data={data} margin={{ top: 8, left: 4, right: 4, bottom: 0 }}>
                        <defs>
                            {['in', 'out'].map((key) => (
                                <linearGradient key={key} id={`cash-flow-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={0.28} />
                                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={0.02} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" />
                        <YAxis orientation={isRtl ? 'right' : 'left'} tickLine={false} axisLine={false} width={48} tickFormatter={(value) => compact.format(value)} />
                        <ChartTooltip
                            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                            content={
                                <ChartTooltipContent
                                    dir={dir}
                                    indicator="line"
                                    valueFormatter={(value) => formatMoney(value, currency)}
                                    labelFormatter={(_, payload) => fullMonthFormat.format(toDate(payload[0].payload.month))}
                                />
                            }
                        />
                        <Area dataKey="out" type="monotone" stroke="var(--color-out)" strokeWidth={2} fill="url(#cash-flow-out)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }} isAnimationActive={isAnimated} />
                        <Area
                            dataKey="in"
                            type="monotone"
                            stroke="var(--color-in)"
                            strokeWidth={2.5}
                            fill="url(#cash-flow-in)"
                            dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--color-in)' }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                            isAnimationActive={isAnimated}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

/**
 * A row of the "waiting today" panel: what it is, how many, how much, and
 * a link to the list behind it.
 */
function Waiting({ icon: Icon, label, detail, amount, href, tone }) {
    return (
        <li>
            <Link
                href={href}
                className="group/waiting flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                <span
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        tone === 'in' ? 'bg-brand-cyan/12 text-brand-ink' : 'bg-gold/15 text-gold-ink',
                    )}
                >
                    <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{label}</span>
                    <span className="truncate text-xs text-muted-foreground">{detail}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{amount}</span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/waiting:opacity-100 rtl:rotate-180" />
            </Link>
        </li>
    );
}

/**
 * What is still to collect and to pay today, whatever period is shown.
 */
function WaitingPanel({ outstanding, currency }) {
    const { t, formatCurrency } = useTranslation();
    const money = (value) => formatCurrency(value, currency);

    const collect = [
        {
            key: 'invoices',
            icon: ReceiptTextIcon,
            label: t('finance.overview.waiting.invoices'),
            detail: t('finance.overview.waiting.invoicesDetail', { count: outstanding.invoices.count, overdue: outstanding.overdueInvoices.count }),
            amount: outstanding.invoices.amount,
            href: route('invoices.index', { status: ['issued', 'partially_paid'] }),
        },
        {
            key: 'rent',
            icon: KeyRoundIcon,
            label: t('finance.overview.waiting.rentOwed'),
            detail: t('finance.overview.waiting.tenants', { count: outstanding.rentOwed.count }),
            amount: outstanding.rentOwed.amount,
            href: route('rentals.index', { standing: ['due', 'overdue'] }),
        },
        {
            key: 'cheques',
            icon: ScrollTextIcon,
            label: t('finance.overview.waiting.chequesToBank'),
            detail: t('finance.overview.waiting.cheques', { count: outstanding.chequesToBank.count }),
            amount: outstanding.chequesToBank.amount,
            href: route('cheques.index', { direction: ['received'], stage: ['received', 'deposited'] }),
        },
    ];
    const pay = [
        {
            key: 'landlords',
            icon: LandmarkIcon,
            label: t('finance.overview.waiting.landlordCheques'),
            detail: t('finance.overview.waiting.cheques', { count: outstanding.landlordCheques.count }),
            amount: outstanding.landlordCheques.amount,
            href: route('cheques.index', { direction: ['issued'], due: ['next_30_days'] }),
        },
        {
            key: 'contractors',
            icon: FileStackIcon,
            label: t('finance.overview.waiting.contractorCheques'),
            detail: t('finance.overview.waiting.cheques', { count: outstanding.contractorCheques.count }),
            amount: outstanding.contractorCheques.amount,
            href: route('cheques.index', { direction: ['issued'], due: ['next_30_days'] }),
        },
        {
            key: 'maintenance',
            icon: WrenchIcon,
            label: t('finance.overview.waiting.maintenanceBills'),
            detail: t('finance.overview.waiting.bills', { count: outstanding.maintenanceBills.count }),
            amount: outstanding.maintenanceBills.amount,
            href: route('maintenance-bills.index', { status: ['unpaid'] }),
        },
        ...(outstanding.salaries
            ? [
                  {
                      key: 'salaries',
                      icon: BanknoteIcon,
                      label: t('finance.overview.waiting.salaries'),
                      detail: t('finance.overview.waiting.salariesDetail', { count: outstanding.salaries.count }),
                      amount: outstanding.salaries.amount,
                      href: route('salaries.index', { status: ['pending'] }),
                  },
              ]
            : []),
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('finance.overview.waiting.title')}</CardTitle>
                <CardDescription>{t('finance.overview.waiting.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {[
                    { key: 'collect', label: t('finance.overview.waiting.collect'), rows: collect, tone: 'in', icon: ArrowDownLeftIcon },
                    { key: 'pay', label: t('finance.overview.waiting.pay'), rows: pay, tone: 'out', icon: ArrowUpRightIcon },
                ].map((group) => (
                    <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
                        <h3 className="flex items-center justify-between gap-2 px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            <span className="flex items-center gap-1.5">
                                <group.icon className="size-3.5" />
                                {group.label}
                            </span>
                            <span className="tabular-nums">{money(group.rows.reduce((total, row) => total + row.amount, 0))}</span>
                        </h3>
                        <ul className="flex flex-col">
                            {group.rows.map(({ key, ...row }) => (
                                <Waiting key={key} {...row} amount={money(row.amount)} tone={group.tone} />
                            ))}
                        </ul>
                    </section>
                ))}
            </CardContent>
        </Card>
    );
}

/**
 * Where the period's money came from, or went: a donut of the kinds with
 * a legend naming each one's amount and share.
 */
function Breakdown({ title, description, categories, totals, currency, emptyLabel }) {
    const { t, locale, formatCurrency, formatPercent } = useTranslation();
    const compact = new Intl.NumberFormat(LOCALES[locale].intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });
    const segments = categories
        .filter((category) => totals[category])
        .map((category) => ({ key: category, label: t(`finance.categories.${category}`), value: totals[category].amount, color: CASH_CATEGORIES[category].color, icon: CASH_CATEGORIES[category].icon }));
    const total = segments.reduce((value, segment) => value + segment.value, 0);
    const money = (value) => formatCurrency(value, currency);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
                {total > 0 ? (
                    <>
                        <DonutChart segments={segments} label={title} valueFormatter={money}>
                            <span className="text-xs text-muted-foreground">{currency}</span>
                            <span className="font-heading text-2xl font-bold tracking-tight">{compact.format(total)}</span>
                        </DonutChart>
                        <DonutLegend segments={segments} total={total} valueFormatter={money} formatShare={formatPercent} />
                    </>
                ) : (
                    <p className="flex min-h-32 w-full items-center justify-center rounded-xl bg-muted/50 text-sm text-muted-foreground">{emptyLabel}</p>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * How the period's money moved: cash, transfer, cheque or card, in and out.
 */
function Methods({ methods, currency }) {
    const { t, formatCurrency, formatPercent } = useTranslation();
    const keys = ['cash', 'bank_transfer', 'cheque', 'card'];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('finance.overview.methods.title')}</CardTitle>
                <CardDescription>{t('finance.overview.methods.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {['in', 'out'].map((direction) => {
                    const total = keys.reduce((value, key) => value + (methods[direction][key] ?? 0), 0);

                    return (
                        <section key={direction} aria-label={t(`finance.directions.${direction}`)} className="flex flex-col gap-2.5">
                            <h3 className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t(`finance.directions.${direction}`)}
                                <span className="tabular-nums">{formatCurrency(total, currency)}</span>
                            </h3>
                            <ul className="flex flex-col gap-2">
                                {keys.map((key) => {
                                    const Icon = METHOD_ICONS[key];
                                    const value = methods[direction][key] ?? 0;
                                    const share = total > 0 ? (value / total) * 100 : 0;

                                    return (
                                        <li key={key} className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Icon className="size-3.5 text-muted-foreground" />
                                                <span className="flex-1">{t(`leasing.methods.${key}`)}</span>
                                                <span className="font-medium tabular-nums">{formatCurrency(value, currency)}</span>
                                                <span className="w-11 text-end text-xs text-muted-foreground tabular-nums">{total > 0 ? formatPercent(share) : '—'}</span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                                <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: direction === 'in' ? 'var(--cash-in)' : 'var(--cash-out)' }} />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </CardContent>
        </Card>
    );
}

/**
 * Shortcuts to record money in or out, from the pages that do it.
 */
function RecordMenu() {
    const { t } = useTranslation();
    const canOpen = useCanOpen();
    const items = [
        { label: t('finance.overview.record.clientPayment'), href: route('payments.create'), icon: FileSignatureIcon },
        { label: t('finance.overview.record.rentPayment'), href: route('rentals.index', { status: ['active'] }), icon: KeyRoundIcon },
        { label: t('finance.overview.record.newRental'), href: route('rentals.create'), icon: PlusIcon },
        { label: t('finance.overview.record.maintenanceBill'), href: route('maintenance-bills.index', { status: ['unpaid'] }), icon: WrenchIcon },
        ...(canOpen({ ability: 'viewStaff' }) ? [{ label: t('finance.overview.record.salaries'), href: route('payroll.index'), icon: BanknoteIcon }] : []),
    ];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button />}>
                <PlusIcon data-icon="inline-start" />
                {t('finance.overview.record.button')}
                <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('finance.overview.record.label')}</DropdownMenuLabel>
                    {items.map((item) => (
                        <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
                            <item.icon />
                            {item.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The payments overview: money in and out over a period against the one
 * before it, a year of cash flow, where the money came from and went, what
 * is waiting today, and every transaction of the period in one ledger.
 */
export default function Overview({ company, period, previousPeriod, filters, totals, previousTotals, methods, trend, outstanding, facets, transactions, canSeeSalaries }) {
    const { t, formatCurrency, formatMoney, formatDate } = useTranslation();
    const { full, range } = usePeriodLabel();
    const title = t('finance.overview.title');

    if (company === null) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} description={t('finance.overview.description')} />
                <NoCompany icon={WalletIcon} />
            </DashboardLayout>
        );
    }

    const changePeriod = (value) =>
        router.get(route('payments.overview'), { ...route().params, period: value || undefined, page: undefined }, { preserveScroll: true, preserveState: true });

    const moneyIn = sum(totals, IN);
    const moneyOut = sum(totals, OUT);
    const previousLabel = previousPeriod ? range(previousPeriod) : null;
    const previousIn = previousTotals ? sum(previousTotals, IN) : null;
    const previousOut = previousTotals ? sum(previousTotals, OUT) : null;
    const outCategories = OUT.filter((category) => canSeeSalaries || category !== 'salary');
    const owed = outstanding.invoices.amount + outstanding.rentOwed.amount;
    // The period is chosen above the page, so the ledger keeps it in the URL only when it is not the default.
    const ledgerFilters = filters.period ? filters : Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'period'));

    const columns = [
        {
            id: 'date',
            header: t('finance.overview.ledger.columns.date'),
            cell: (row) => (
                <div className="flex flex-col">
                    <span className="font-medium tabular-nums">{formatDate(row.date)}</span>
                    <span className="text-xs text-muted-foreground">{t(`finance.category.${row.category}`)}</span>
                </div>
            ),
        },
        {
            id: 'transaction',
            header: t('finance.overview.ledger.columns.transaction'),
            cell: (row) => {
                const Icon = CASH_CATEGORIES[row.category].icon;

                return (
                    <div className="flex min-w-0 items-center gap-3">
                        <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `color-mix(in oklab, ${CASH_CATEGORIES[row.category].color} 14%, transparent)`, color: CASH_CATEGORIES[row.category].color }}
                        >
                            <Icon className="size-4" />
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <Link href={transactionHref(row)} className="max-w-56 truncate font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                {row.number ?? t(`finance.category.${row.category}`)}
                            </Link>
                            {row.detail && (
                                <span dir="auto" className="max-w-56 truncate text-xs text-muted-foreground">
                                    {row.detail}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'party',
            header: t('finance.overview.ledger.columns.party'),
            cell: (row) => (
                <span dir="auto" className="block max-w-56 truncate">
                    {row.party ?? '—'}
                </span>
            ),
        },
        {
            id: 'method',
            header: t('finance.overview.ledger.columns.method'),
            cell: (row) => {
                const Icon = METHOD_ICONS[row.method];

                return row.method ? (
                    <span className="flex items-center gap-1.5 text-sm">
                        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                        {t(`leasing.methods.${row.method}`)}
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                );
            },
        },
        {
            id: 'amount',
            header: t('finance.overview.ledger.columns.amount'),
            align: 'end',
            cell: (row) => (
                <span className={cn('font-semibold tabular-nums', row.direction === 'in' && 'text-success')}>
                    {row.direction === 'in' ? '+' : '−'}
                    {formatMoney(row.amount, company.currency)}
                </span>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <Head title={`${title} · ${full(period)}`} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} description={t('finance.overview.description')} actions={<RecordMenu />} />

            <FlashMessages />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <PeriodFilter period={period} onChange={changePeriod} />
                {previousLabel && <span className="text-sm text-muted-foreground">{t('finance.overview.comparedWith', { period: previousLabel })}</span>}
            </div>

            <section aria-label={t('finance.overview.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={ArrowDownLeftIcon}
                    label={t('finance.overview.stats.moneyIn')}
                    value={formatCurrency(moneyIn, company.currency)}
                    detail={t('finance.overview.stats.payments', { count: count(totals, IN) })}
                    badge={<ChangeBadge current={moneyIn} previous={previousIn} previousLabel={previousLabel} />}
                />
                <StatCard
                    icon={ArrowUpRightIcon}
                    tone="gold"
                    label={t('finance.overview.stats.moneyOut')}
                    value={formatCurrency(moneyOut, company.currency)}
                    detail={t('finance.overview.stats.payments', { count: count(totals, outCategories) })}
                    badge={<ChangeBadge current={moneyOut} previous={previousOut} isGoodWhenUp={false} previousLabel={previousLabel} />}
                />
                <StatCard
                    icon={ScaleIcon}
                    tone={moneyIn - moneyOut < 0 ? 'warning' : 'success'}
                    label={t('finance.overview.stats.net')}
                    value={formatCurrency(moneyIn - moneyOut, company.currency)}
                    detail={moneyIn - moneyOut < 0 ? t('finance.overview.stats.netNegative') : t('finance.overview.stats.netPositive')}
                />
                <StatCard
                    icon={HandCoinsIcon}
                    tone={outstanding.overdueInvoices.count > 0 || outstanding.rentOwed.count > 0 ? 'warning' : 'primary'}
                    label={t('finance.overview.stats.outstanding')}
                    value={formatCurrency(owed, company.currency)}
                    detail={t('finance.overview.stats.outstandingDetail')}
                    href={route('invoices.index', { due: ['overdue'] })}
                />
            </section>

            <div className="grid gap-4 xl:grid-cols-3">
                <CashFlowChart trend={trend} currency={company.currency} />
                <WaitingPanel outstanding={outstanding} currency={company.currency} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <Breakdown
                    title={t('finance.overview.breakdown.inTitle')}
                    description={t('finance.overview.breakdown.inDescription', { period: full(period) })}
                    categories={IN}
                    totals={totals}
                    currency={company.currency}
                    emptyLabel={t('finance.overview.breakdown.emptyIn')}
                />
                <Breakdown
                    title={t('finance.overview.breakdown.outTitle')}
                    description={t('finance.overview.breakdown.outDescription', { period: full(period) })}
                    categories={outCategories}
                    totals={totals}
                    currency={company.currency}
                    emptyLabel={t('finance.overview.breakdown.emptyOut')}
                />
                <Methods methods={methods} currency={company.currency} />
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2 className="font-heading text-lg font-bold">{t('finance.overview.ledger.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('finance.overview.ledger.description', { period: full(period) })}</p>
                </div>
                <RecordList
                    routeName="payments.overview"
                    filters={ledgerFilters}
                    facets={{
                        direction: facets.direction.map((option) => ({ ...option, label: t(`finance.directions.${option.value}`), icon: option.value === 'in' ? ArrowDownLeftIcon : ArrowUpRightIcon })),
                        category: facets.category.map((option) => ({ ...option, label: t(`finance.categories.${option.value}`), icon: CASH_CATEGORIES[option.value].icon })),
                        method: facets.method.map((option) => ({ ...option, label: t(`leasing.methods.${option.value}`), icon: METHOD_ICONS[option.value] })),
                    }}
                    labels={{
                        direction: t('finance.overview.ledger.filters.direction'),
                        category: t('finance.overview.ledger.filters.category'),
                        method: t('finance.overview.ledger.filters.method'),
                    }}
                    only={['transactions', 'facets']}
                    paginator={transactions}
                    searchLabel={t('finance.overview.ledger.searchLabel')}
                    searchPlaceholder={t('finance.overview.ledger.searchPlaceholder')}
                    empty={<ListEmpty icon={WalletIcon} title={t('finance.overview.ledger.empty.title')} description={t('finance.overview.ledger.empty.description')} />}
                >
                    <DataTable columns={columns} rows={transactions.data} rowKey="key" />
                </RecordList>
            </div>
        </DashboardLayout>
    );
}
