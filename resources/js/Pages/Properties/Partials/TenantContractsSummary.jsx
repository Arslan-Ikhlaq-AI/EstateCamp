import DonutChart from '@/Components/DonutChart';
import { CHEQUE_STAGE_ICONS } from '@/Components/LeasingBadges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CircleAlertIcon } from 'lucide-react';

/**
 * Where a client's cheque can stand, in order, each with its colour: gold
 * while still to collect, blues in hand and at the bank, green once
 * cleared, red when bounced, and greys when handed back or cancelled.
 */
export const CHEQUE_STAGES = [
    { key: 'pending', color: 'var(--gold)' },
    { key: 'received', color: 'var(--chart-1)' },
    { key: 'deposited', color: 'var(--chart-4)' },
    { key: 'cleared', color: 'var(--success)' },
    { key: 'bounced', color: 'var(--destructive)' },
    { key: 'returned', color: 'var(--chart-3)' },
    { key: 'cancelled', color: 'var(--input)' },
];

/**
 * A stage's name as the cheque pages word it for cheques from clients.
 */
export function stageLabel(t, stage) {
    return t(`leasing.cheques.status.${stage === 'pending' ? 'pending_received' : stage}`);
}

const CONTRACT_SWATCHES = { active: 'bg-success', draft: 'bg-muted-foreground/40', ended: 'bg-chart-1', terminated: 'bg-destructive' };

/**
 * Every cheque under the property's contracts as a donut of amounts by
 * stage, with a legend giving each stage's count and amount, and those
 * past their date called out.
 */
function ChequeOverview({ cheques, currency }) {
    const { t, formatNumber, formatCurrency } = useTranslation();
    const money = (value) => formatCurrency(value, currency);
    const segments = CHEQUE_STAGES.map((stage) => ({
        ...stage,
        label: stageLabel(t, stage.key),
        value: cheques.stages[stage.key].amount,
        count: cheques.stages[stage.key].count,
    }));
    const count = segments.reduce((sum, segment) => sum + segment.count, 0);
    const amount = segments.reduce((sum, segment) => sum + segment.value, 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('propertyTenantContracts.cheques.title')}</CardTitle>
                <CardDescription>{t('propertyTenantContracts.cheques.description')}</CardDescription>
            </CardHeader>
            <CardContent className="@container">
                {count === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('propertyTenantContracts.cheques.none')}</p>
                ) : (
                    <div className="flex flex-col items-center gap-6 @lg:flex-row @lg:items-start">
                        <DonutChart
                            segments={segments}
                            label={`${t('propertyTenantContracts.cheques.title')}: ${segments
                                .filter((segment) => segment.count > 0)
                                .map((segment) => `${segment.label} ${money(segment.value)}`)
                                .join(', ')}`}
                            size={168}
                            valueFormatter={money}
                        >
                            <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatNumber(count)}</span>
                            <span className="text-xs text-muted-foreground">{t('propertyTenantContracts.cheques.chequesLabel', { count })}</span>
                        </DonutChart>

                        <div className="flex w-full min-w-0 flex-col gap-3">
                            <dl className="flex flex-col">
                                {segments.map((segment) => {
                                    const Icon = CHEQUE_STAGE_ICONS[segment.key];

                                    return (
                                        <div
                                            key={segment.key}
                                            className={cn('flex items-center gap-2.5 border-b border-foreground/[0.07] py-1.5 text-[0.875rem]', segment.count === 0 && 'text-muted-foreground')}
                                        >
                                            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: segment.color }} />
                                            <dt className="flex min-w-0 flex-1 items-center gap-1.5">
                                                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{segment.label}</span>
                                            </dt>
                                            <dd className="flex shrink-0 items-baseline gap-3 tabular-nums">
                                                <span className="text-xs text-muted-foreground">{formatNumber(segment.count)}</span>
                                                <span className={cn('min-w-24 text-end', segment.count > 0 && 'font-semibold')}>{money(segment.value)}</span>
                                            </dd>
                                        </div>
                                    );
                                })}
                                <div className="flex items-center justify-between gap-2.5 pt-2 text-[0.875rem] font-bold">
                                    <dt>{t('propertyTenantContracts.cheques.total')}</dt>
                                    <dd className="tabular-nums">{money(amount)}</dd>
                                </div>
                            </dl>

                            {cheques.overdue.count > 0 && (
                                <p className="flex items-center gap-2 rounded-lg bg-destructive/[0.06] px-3 py-2 text-[0.8125rem] font-medium text-destructive ring-1 ring-destructive/20">
                                    <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
                                    <span className="min-w-0 flex-1">{t('propertyTenantContracts.cheques.overdue', { count: cheques.overdue.count })}</span>
                                    <span className="tabular-nums">{money(cheques.overdue.amount)}</span>
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * One line of the statement; a total is ruled off above and set in bold.
 */
function StatementLine({ label, value, swatch, isTotal = false, tone }) {
    return (
        <div
            className={cn(
                'flex items-baseline justify-between gap-6 border-b border-foreground/[0.07] py-2.5 last:border-b-0',
                isTotal && 'border-t-2 border-t-foreground/15 font-bold',
            )}
        >
            <dt className="flex min-w-0 items-center gap-2 text-[0.875rem]">
                {swatch && <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', swatch)} />}
                {label}
            </dt>
            <dd className={cn('shrink-0 text-[0.9375rem] tabular-nums', isTotal ? 'text-base' : 'font-semibold', tone === 'warning' && 'text-warning')}>{value}</dd>
        </div>
    );
}

/**
 * The property's contracts as a statement: how many are in each status,
 * then the rent and deposits of running and draft contracts and what has
 * been invoiced, paid and is still owed across all of them.
 */
function ContractStatement({ summary, currency }) {
    const { t, formatNumber, formatCurrency } = useTranslation();
    const money = (value) => formatCurrency(value, currency);
    const total = Object.values(summary.contracts).reduce((sum, count) => sum + count, 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('propertyTenantContracts.summary.title')}</CardTitle>
                <CardDescription>{t('propertyTenantContracts.summary.description')}</CardDescription>
            </CardHeader>
            <CardContent className="@container">
                <div className="grid gap-x-10 gap-y-6 @lg:grid-cols-2">
                    <section aria-labelledby="tenant-contracts-statement-contracts" className="flex flex-col gap-1">
                        <h3 id="tenant-contracts-statement-contracts" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('propertyTenantContracts.summary.groups.contracts')}
                        </h3>
                        <dl className="flex flex-col">
                            {Object.entries(CONTRACT_SWATCHES).map(([status, swatch]) => (
                                <StatementLine key={status} label={t(`leasing.status.contract.${status}`)} value={formatNumber(summary.contracts[status])} swatch={swatch} />
                            ))}
                            <StatementLine label={t('propertyTenantContracts.summary.totalContracts')} value={formatNumber(total)} isTotal />
                        </dl>
                    </section>
                    <section aria-labelledby="tenant-contracts-statement-money" className="flex flex-col gap-1">
                        <h3 id="tenant-contracts-statement-money" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {t('propertyTenantContracts.summary.groups.money')}
                        </h3>
                        <dl className="flex flex-col">
                            <StatementLine label={t('propertyTenantContracts.summary.monthly')} value={money(summary.monthly)} />
                            <StatementLine label={t('propertyTenantContracts.summary.yearly')} value={money(summary.monthly * 12)} />
                            <StatementLine label={t('propertyTenantContracts.summary.deposits')} value={money(summary.deposits)} />
                            <StatementLine label={t('propertyTenantContracts.summary.invoiced')} value={money(summary.invoiced)} />
                            <StatementLine label={t('propertyTenantContracts.summary.paid')} value={money(summary.invoiced - summary.balance)} />
                            <StatementLine
                                label={t('propertyTenantContracts.summary.balance')}
                                value={money(summary.balance)}
                                tone={summary.balance > 0 ? 'warning' : undefined}
                                isTotal
                            />
                        </dl>
                    </section>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * The figures above the clients: every cheque by where it stands, beside
 * a statement of the contracts and their money.
 */
export default function TenantContractsSummary({ summary, currency }) {
    return (
        <div className="grid gap-6 xl:grid-cols-2">
            <ChequeOverview cheques={summary.cheques} currency={currency} />
            <ContractStatement summary={summary} currency={currency} />
        </div>
    );
}
