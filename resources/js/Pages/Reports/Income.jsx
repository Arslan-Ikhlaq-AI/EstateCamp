import ChangeBadge from '@/Components/ChangeBadge';
import DataTable, { TotalsRow } from '@/Components/DataTable';
import { CASH_CATEGORIES, METHOD_ICONS } from '@/Components/FinanceBadges';
import { usePeriodLabel } from '@/Components/PeriodFilter';
import { MonthlyAreaChart } from '@/Components/ReportCharts';
import ReportLayout, { Amount, Figures, ReportEmpty, ReportSection, ShareBar, useAmountFormat } from '@/Components/ReportLayout';
import StatCard from '@/Components/StatCard';
import { useCalendarFormat } from '@/Components/StaffBadges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownLeftIcon, ArrowUpRightIcon, ReceiptTextIcon, ScaleIcon } from 'lucide-react';

const IN = ['client_payment', 'rental_payment', 'extra_income'];
const OUT = ['landlord_rent', 'maintenance', 'salary', 'maintenance_contract', 'deposit_refund', 'other_payment'];
const METHODS = ['cash', 'bank_transfer', 'cheque', 'card'];

const sum = (totals, categories) => categories.reduce((total, category) => total + (totals?.[category]?.amount ?? 0), 0);

/**
 * The statement: income and expenditure by kind for the period and the one
 * before it, with each part's total and the net cash flow.
 */
function Statement({ rows, hasPrevious, currency, previousLabel }) {
    const { t, formatMoney } = useTranslation();
    const money = (value) => formatMoney(value, currency);

    return (
        <Table>
            <TableHeader className="bg-[color-mix(in_oklab,var(--color-brand-cyan)_5%,var(--card))]">
                <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-4 sm:ps-5 lg:ps-6">{t('reports.income.statement.columns.item')}</TableHead>
                    <TableHead className="text-end">{t('reports.income.statement.columns.current')}</TableHead>
                    {hasPrevious && <TableHead className="text-end">{t('reports.income.statement.columns.previous')}</TableHead>}
                    {hasPrevious && <TableHead className="pe-4 text-end sm:pe-5 lg:pe-6">{t('reports.income.statement.columns.change')}</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) =>
                    row.type === 'heading' ? (
                        <TableRow key={row.key} className="hover:bg-transparent">
                            <TableCell colSpan={hasPrevious ? 4 : 2} className="ps-4 pt-5 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:ps-5 lg:ps-6">
                                {row.label}
                            </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow key={row.key} className={cn(row.type !== 'line' && 'bg-muted/40 font-semibold hover:bg-muted/40', row.type === 'net' && 'border-t-2 text-base')}>
                            <TableCell className={cn('py-3 ps-4 sm:ps-5 lg:ps-6', row.type === 'line' && 'ps-8 sm:ps-9 lg:ps-10')}>
                                <span className="flex items-center gap-2.5">
                                    {row.color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] print:[print-color-adjust:exact]" style={{ backgroundColor: row.color }} />}
                                    {row.label}
                                </span>
                            </TableCell>
                            <TableCell className={cn('py-3 text-end tabular-nums', row.type === 'net' && row.current < 0 && 'text-destructive')}>{money(row.current)}</TableCell>
                            {hasPrevious && <TableCell className="py-3 text-end text-muted-foreground tabular-nums">{money(row.previous)}</TableCell>}
                            {hasPrevious && (
                                <TableCell className="py-3 pe-4 text-end sm:pe-5 lg:pe-6">
                                    <ChangeBadge current={row.current} previous={row.previous} isGoodWhenUp={row.isGoodWhenUp} previousLabel={previousLabel} compact />
                                </TableCell>
                            )}
                        </TableRow>
                    ),
                )}
            </TableBody>
        </Table>
    );
}

/**
 * Who paid the company the most, or was paid the most, in the period.
 */
function Parties({ title, description, parties, currency, color, emptyLabel }) {
    const { t, formatMoney, formatNumber } = useTranslation();
    const top = parties[0]?.amount ?? 0;
    const columns = [
        {
            id: 'party',
            header: t('reports.income.parties.columns.party'),
            cell: (row) => (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <span dir="auto" className="truncate font-medium">
                        {row.party}
                    </span>
                    <ShareBar value={row.amount} max={top} color={color} className="max-w-48" />
                </div>
            ),
        },
        { id: 'count', header: t('reports.income.parties.columns.payments'), align: 'end', cell: (row) => <span className="tabular-nums">{formatNumber(row.count)}</span> },
        { id: 'amount', header: t('reports.income.parties.columns.amount'), align: 'end', cell: (row) => <span className="font-semibold tabular-nums">{formatMoney(row.amount, currency)}</span> },
    ];

    return (
        <ReportSection title={title} description={description} flush={parties.length > 0}>
            {parties.length > 0 ? <DataTable columns={columns} rows={parties} rowKey="party" /> : <ReportEmpty>{emptyLabel}</ReportEmpty>}
        </ReportSection>
    );
}

/**
 * The income and expenditure report: a cash statement for the period
 * against the one before, a year month by month, how money moved, who paid
 * and was paid the most, and what was invoiced.
 */
export default function Income({ company, prepared, period, previousPeriod, canSeeSalaries, statement, previousStatement, months, methods, payers, payees, invoiced }) {
    const { t, formatCurrency, formatMoney, formatNumber, formatPercent } = useTranslation();
    const { range } = usePeriodLabel();
    const { formatMonth } = useCalendarFormat();
    const amount = useAmountFormat();
    const title = t('reports.income.title');

    if (company === null) {
        return <ReportLayout title={title} description={t('reports.income.description')} icon={ScaleIcon} company={null} />;
    }

    const currency = company.currency;
    const money = (value) => formatMoney(value, currency);
    const outCategories = OUT.filter((category) => canSeeSalaries || category !== 'salary');
    const categories = [...IN, ...outCategories];
    const previousLabel = previousPeriod ? range(previousPeriod) : null;
    const hasPrevious = previousStatement !== null;
    const moneyIn = sum(statement, IN);
    const moneyOut = sum(statement, outCategories);
    const previousIn = hasPrevious ? sum(previousStatement, IN) : null;
    const previousOut = hasPrevious ? sum(previousStatement, outCategories) : null;

    const line = (category, isGoodWhenUp) => ({
        key: category,
        type: 'line',
        label: t(`finance.categories.${category}`),
        color: CASH_CATEGORIES[category].color,
        current: statement[category].amount,
        previous: previousStatement?.[category].amount ?? null,
        isGoodWhenUp,
    });
    const statementRows = [
        { key: 'income', type: 'heading', label: t('reports.income.statement.income') },
        ...IN.map((category) => line(category, true)),
        { key: 'totalIn', type: 'total', label: t('reports.income.statement.totalIncome'), current: moneyIn, previous: previousIn, isGoodWhenUp: true },
        { key: 'expenditure', type: 'heading', label: t('reports.income.statement.expenditure') },
        ...outCategories.map((category) => line(category, false)),
        { key: 'totalOut', type: 'total', label: t('reports.income.statement.totalExpenditure'), current: moneyOut, previous: previousOut, isGoodWhenUp: false },
        {
            key: 'net',
            type: 'net',
            label: t('reports.income.statement.net'),
            current: moneyIn - moneyOut,
            previous: hasPrevious ? previousIn - previousOut : null,
            isGoodWhenUp: true,
        },
    ];

    const monthRows = months.map((month) => ({ ...month, net: month.in - month.out }));
    const monthTotal = (key) => monthRows.reduce((total, month) => total + key(month), 0);
    const monthColumns = [
        { id: 'month', header: t('reports.common.columns.month'), cell: (row) => <span className="font-medium whitespace-nowrap">{formatMonth(row.month)}</span> },
        ...categories.map((category) => ({
            id: category,
            header: t(`finance.categories.${category}`),
            align: 'end',
            className: 'whitespace-normal',
            cell: (row) => <Amount value={row.categories[category]} />,
        })),
        { id: 'in', header: t('reports.income.months.totalIn'), align: 'end', className: 'whitespace-normal', cell: (row) => <Amount value={row.in} className="font-semibold" /> },
        { id: 'out', header: t('reports.income.months.totalOut'), align: 'end', className: 'whitespace-normal', cell: (row) => <Amount value={row.out} className="font-semibold" /> },
        { id: 'net', header: t('reports.income.months.net'), align: 'end', className: 'whitespace-normal', cell: (row) => <Amount value={row.net} className={cn('font-semibold', row.net < 0 && 'text-destructive')} /> },
    ];

    const methodRows = METHODS.map((method) => ({ method, in: methods.in[method] ?? 0, out: methods.out[method] ?? 0 }));
    const methodColumns = [
        {
            id: 'method',
            header: t('reports.income.methods.columns.method'),
            cell: (row) => {
                const Icon = METHOD_ICONS[row.method];

                return (
                    <span className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        {t(`leasing.methods.${row.method}`)}
                    </span>
                );
            },
        },
        ...[
            { id: 'in', total: moneyIn },
            { id: 'out', total: moneyOut },
        ].map(({ id, total }) => ({
            id,
            header: t(`reports.income.methods.columns.${id}`),
            align: 'end',
            cell: (row) => (
                <div className="flex flex-col items-end">
                    <span className="tabular-nums">{money(row[id])}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{total > 0 ? formatPercent((row[id] / total) * 100) : '—'}</span>
                </div>
            ),
        })),
    ];

    const exports = [
        {
            key: 'statement',
            label: t('reports.income.exports.statement'),
            name: 'income-and-expenditure',
            header: [t('reports.income.statement.columns.item'), t('reports.income.statement.columns.current'), ...(hasPrevious ? [t('reports.income.statement.columns.previous')] : [])],
            rows: () => statementRows.filter((row) => row.type !== 'heading').map((row) => [row.label, row.current, ...(hasPrevious ? [row.previous] : [])]),
        },
        {
            key: 'months',
            label: t('reports.income.exports.months'),
            name: 'cash-flow-by-month',
            header: monthColumns.map((column) => column.header),
            rows: () => monthRows.map((row) => [row.month, ...categories.map((category) => row.categories[category]), row.in, row.out, row.net]),
        },
        {
            key: 'payers',
            label: t('reports.income.exports.payers'),
            name: 'top-payers',
            header: [t('reports.income.parties.columns.party'), t('reports.income.parties.columns.payments'), t('reports.income.parties.columns.amount')],
            rows: () => payers.map((row) => [row.party, row.count, row.amount]),
        },
        {
            key: 'payees',
            label: t('reports.income.exports.payees'),
            name: 'top-payees',
            header: [t('reports.income.parties.columns.party'), t('reports.income.parties.columns.payments'), t('reports.income.parties.columns.amount')],
            rows: () => payees.map((row) => [row.party, row.count, row.amount]),
        },
    ];

    return (
        <ReportLayout
            title={title}
            description={t('reports.income.description')}
            icon={ScaleIcon}
            routeName="reports.income"
            company={company}
            prepared={prepared}
            period={period}
            comparedWith={previousLabel}
            exports={exports}
        >
            <section aria-label={t('reports.summary.headline')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4">
                <StatCard
                    icon={ArrowDownLeftIcon}
                    label={t('reports.income.stats.income')}
                    value={formatCurrency(moneyIn, currency)}
                    detail={t('reports.common.payments', { count: IN.reduce((total, category) => total + statement[category].count, 0) })}
                    badge={<ChangeBadge current={moneyIn} previous={previousIn} previousLabel={previousLabel} />}
                />
                <StatCard
                    icon={ArrowUpRightIcon}
                    tone="gold"
                    label={t('reports.income.stats.expenditure')}
                    value={formatCurrency(moneyOut, currency)}
                    detail={t('reports.common.payments', { count: outCategories.reduce((total, category) => total + statement[category].count, 0) })}
                    badge={<ChangeBadge current={moneyOut} previous={previousOut} isGoodWhenUp={false} previousLabel={previousLabel} />}
                />
                <StatCard
                    icon={ScaleIcon}
                    tone={moneyIn - moneyOut < 0 ? 'warning' : 'success'}
                    label={t('reports.income.stats.net')}
                    value={formatCurrency(moneyIn - moneyOut, currency)}
                    detail={
                        moneyIn - moneyOut < 0
                            ? t('reports.income.stats.deficit')
                            : moneyIn > 0
                              ? t('reports.income.stats.margin', { rate: formatPercent(((moneyIn - moneyOut) / moneyIn) * 100) })
                              : t('reports.income.stats.noIncome')
                    }
                />
                <StatCard
                    icon={ReceiptTextIcon}
                    label={t('reports.income.stats.invoiced')}
                    value={formatCurrency(invoiced.total, currency)}
                    detail={t('reports.income.stats.invoicedDetail', { count: invoiced.count, vat: formatCurrency(invoiced.vat, currency) })}
                />
            </section>

            <ReportSection title={t('reports.income.statement.title')} description={t('reports.income.statement.description')} flush>
                <Statement rows={statementRows} hasPrevious={hasPrevious} currency={currency} previousLabel={previousLabel} />
            </ReportSection>

            <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                <ReportSection title={t('reports.income.methods.title')} description={t('reports.income.methods.description')} flush>
                    <DataTable columns={methodColumns} rows={methodRows} rowKey="method" />
                </ReportSection>
                <ReportSection title={t('reports.income.invoicing.title')} description={t('reports.income.invoicing.description')}>
                    <Figures
                        columns={2}
                        items={[
                            { label: t('reports.income.invoicing.invoices'), value: formatNumber(invoiced.count) },
                            { label: t('reports.income.invoicing.subtotal'), value: money(invoiced.subtotal) },
                            { label: t('reports.income.invoicing.vat'), value: money(invoiced.vat) },
                            { label: t('reports.income.invoicing.total'), value: money(invoiced.total) },
                        ]}
                    />
                </ReportSection>
            </div>

            <ReportSection
                title={t('reports.income.months.title')}
                description={t('reports.income.months.description', { from: formatMonth(months[0].month), to: formatMonth(months[months.length - 1].month) })}
            >
                <MonthlyAreaChart
                    data={months}
                    valueFormatter={money}
                    series={[
                        { key: 'in', label: t('finance.directions.in'), color: 'var(--cash-in)', total: formatCurrency(monthTotal((row) => row.in), currency) },
                        { key: 'out', label: t('finance.directions.out'), color: 'var(--cash-out)', total: formatCurrency(monthTotal((row) => row.out), currency) },
                    ]}
                />
            </ReportSection>

            <ReportSection title={t('reports.income.months.tableTitle')} description={t('reports.income.months.tableDescription', { currency })} flush>
                <DataTable
                    columns={monthColumns}
                    rows={monthRows}
                    rowKey="month"
                    footer={
                        <TotalsRow
                            columns={monthColumns}
                            values={{
                                month: t('reports.common.total'),
                                ...Object.fromEntries(categories.map((category) => [category, amount(monthTotal((row) => row.categories[category]))])),
                                in: amount(monthTotal((row) => row.in)),
                                out: amount(monthTotal((row) => row.out)),
                                net: amount(monthTotal((row) => row.net)),
                            }}
                        />
                    }
                />
            </ReportSection>

            <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                <Parties
                    title={t('reports.income.parties.payersTitle')}
                    description={t('reports.income.parties.payersDescription')}
                    parties={payers}
                    currency={currency}
                    color="var(--cash-in)"
                    emptyLabel={t('reports.income.parties.emptyIn')}
                />
                <Parties
                    title={t('reports.income.parties.payeesTitle')}
                    description={t('reports.income.parties.payeesDescription')}
                    parties={payees}
                    currency={currency}
                    color="var(--cash-out)"
                    emptyLabel={t('reports.income.parties.emptyOut')}
                />
            </div>
        </ReportLayout>
    );
}
