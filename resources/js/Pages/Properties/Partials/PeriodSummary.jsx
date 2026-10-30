import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownLeftIcon, ArrowUpRightIcon, HandCoinsIcon, SigmaIcon } from 'lucide-react';
import { useId } from 'react';
import { SECTION_TONES } from './PaymentSection';

/**
 * One column of the summary: its lines and the total they come to, with
 * an optional action by its title. On a `signed` statement each line
 * shows whether it adds or takes away.
 */
function Statement({ tone, icon: Icon, title, lines, total, signed = false, action, currency }) {
    const { formatCurrency } = useTranslation();
    const sign = (amount) => (!signed || amount === 0 ? '' : amount > 0 ? '+' : '−');

    return (
        <div className="flex flex-col gap-3 p-4 sm:p-6">
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2.5 font-heading text-base font-bold">
                    <span
                        aria-hidden="true"
                        className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br shadow-sm rtl:bg-linear-to-bl', SECTION_TONES[tone])}
                    >
                        <Icon className="size-4" />
                    </span>
                    {title}
                </h3>
                {action}
            </div>
            <dl className="flex flex-1 flex-col">
                {lines.map((line) => (
                    <div key={line.key} className="flex items-baseline justify-between gap-3 py-1.5">
                        <dt className="flex min-w-0 flex-col">
                            <span className="text-sm text-foreground/80">{line.label}</span>
                            {line.detail && <span className="text-xs text-muted-foreground">{line.detail}</span>}
                        </dt>
                        <dd className={cn('shrink-0 text-sm font-semibold tabular-nums', line.amount === 0 && 'text-muted-foreground')}>
                            {sign(line.amount)}
                            {formatCurrency(Math.abs(line.amount), currency)}
                        </dd>
                    </div>
                ))}
                <div className="mt-auto flex items-baseline justify-between gap-3 border-t pt-3">
                    <dt className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold">{total.label}</span>
                        {total.detail && <span className="text-xs text-muted-foreground">{total.detail}</span>}
                    </dt>
                    <dd className={cn('shrink-0 font-heading text-xl font-bold tracking-tight tabular-nums', total.className)}>
                        {formatCurrency(Math.abs(total.amount), currency)}
                    </dd>
                </div>
            </dl>
        </div>
    );
}

/**
 * Under both sides, the period in short. The camp boss's cash: what was
 * collected, less the bills paid out of it, less what was already handed
 * over, with anything from before brought forward, leaves what is to hand
 * over (or, below nothing, what the company owes back). Then the income by
 * cheque, transfer and cash with the extra income, the expenses to the landlord, the contractors
 * and on bills, and the profit or loss they leave.
 */
export default function PeriodSummary({ summary, periodLabel, currency, handover }) {
    const { t, formatCurrency } = useTranslation();
    const id = useId();
    const { campBoss, income, expenses, profit } = summary;
    const words = (key, values) => t(`propertyPayments.summary.${key}`, values);
    const isOwed = campBoss.toHandOver < 0;

    return (
        <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-2xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.08]">
            <div className="flex items-start gap-3.5 p-4 sm:px-6 sm:pt-6 sm:pb-5">
                <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-navy to-[#0b4f8a] text-white shadow-md inset-ring inset-ring-white/20 rtl:bg-linear-to-bl dark:from-brand-cyan/80"
                >
                    <SigmaIcon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 id={`${id}-title`} className="font-heading text-lg font-bold tracking-tight sm:text-xl">
                        {words('title', { period: periodLabel })}
                    </h2>
                    <p className="text-[0.875rem] text-pretty text-muted-foreground">{words('description', { period: periodLabel })}</p>
                </div>
            </div>

            <div className="grid divide-y border-t lg:grid-cols-3 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
                <Statement
                    tone="emerald"
                    icon={HandCoinsIcon}
                    title={words('campBoss.title')}
                    currency={currency}
                    signed
                    lines={[
                        { key: 'collected', label: words('campBoss.collected'), detail: words('campBoss.collectedDetail'), amount: campBoss.received },
                        { key: 'spent', label: words('campBoss.spent'), detail: words('campBoss.spentDetail'), amount: -campBoss.spent },
                        campBoss.broughtForward !== 0 && {
                            key: 'broughtForward',
                            label: words('campBoss.broughtForward'),
                            detail: words('campBoss.broughtForwardDetail', { period: periodLabel }),
                            amount: campBoss.broughtForward,
                        },
                        campBoss.settled !== 0 && { key: 'settled', label: words('campBoss.settled'), amount: -campBoss.settled },
                    ].filter(Boolean)}
                    total={{
                        label: words(`campBoss.${isOwed ? 'owed' : 'toHandOver'}`),
                        detail: campBoss.toHandOver === 0 && campBoss.received + campBoss.broughtForward > 0 ? words('campBoss.allHandedOver') : null,
                        amount: campBoss.toHandOver,
                        className: isOwed ? 'text-destructive' : campBoss.toHandOver > 0 ? 'text-gold-ink' : 'text-success',
                    }}
                    action={handover}
                />
                <Statement
                    tone="brand"
                    icon={ArrowDownLeftIcon}
                    title={words('income.title')}
                    currency={currency}
                    lines={[
                        { key: 'cheques', label: words('income.cheques'), detail: words('income.chequesDetail'), amount: income.cheques },
                        { key: 'transfers', label: words('income.transfers'), amount: income.transfers },
                        { key: 'cash', label: words('income.cash'), amount: income.cash },
                        { key: 'extra', label: words('income.extra'), detail: words('income.extraDetail'), amount: income.extra },
                    ]}
                    total={{ label: words('income.total'), amount: income.total, className: 'text-success' }}
                />
                <Statement
                    tone="gold"
                    icon={ArrowUpRightIcon}
                    title={words('expenses.title')}
                    currency={currency}
                    lines={[
                        { key: 'landlord', label: words('expenses.landlord'), amount: expenses.landlord },
                        { key: 'contracts', label: words('expenses.contracts'), detail: words('expenses.contractsDetail'), amount: expenses.contracts },
                        { key: 'bills', label: words('expenses.bills'), amount: expenses.bills },
                        { key: 'others', label: words('expenses.others'), amount: expenses.others },
                    ]}
                    total={{ label: words('expenses.total'), amount: expenses.total, className: 'text-gold-ink' }}
                />
            </div>

            <div className="flex flex-col gap-2 bg-brand-navy px-4 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:bg-brand-cyan/[0.08]">
                <div className="flex flex-col gap-0.5">
                    <span className="font-heading text-base font-bold">{words(profit < 0 ? 'loss' : 'profit', { period: periodLabel })}</span>
                    <span className="text-sm text-white/70 tabular-nums">
                        {words('formula', { income: formatCurrency(income.total, currency), expenses: formatCurrency(expenses.total, currency) })}
                    </span>
                </div>
                <span className={cn('font-heading text-3xl font-bold tracking-tight tabular-nums', profit < 0 ? 'text-red-300' : 'text-brand-sun')}>
                    {profit < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(profit), currency)}
                </span>
            </div>
        </section>
    );
}
