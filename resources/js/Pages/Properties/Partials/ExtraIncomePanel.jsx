import { ExtraIncomeStatusBadge } from '@/Components/FinanceBadges';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { BadgePercentIcon } from 'lucide-react';
import ExtraIncomeActions from '../../ExtraIncome/Partials/ExtraIncomeActions';
import { SectionEmpty } from './PaymentSection';

/**
 * The extra income the property received in the period, such as an
 * internet or washing machine provider's share: who paid, what for, the
 * day and how, each shown as received. Its menu corrects or cancels one,
 * returning here. `empty` is what to say when there is none.
 */
export default function ExtraIncomePanel({ incomes, currency, empty }) {
    const { t, formatCurrency, formatDate } = useTranslation();

    if (incomes.length === 0) {
        return <SectionEmpty>{empty}</SectionEmpty>;
    }

    return (
        <ul className="flex flex-col divide-y border-t">
            {incomes.map((income) => {
                const isCancelled = income.status === 'cancelled';
                const detail = [
                    income.receivedFrom,
                    t('finance.extraIncome.receivedOn', { date: formatDate(income.date) }),
                    t(`leasing.methods.${income.method}`),
                    income.invoiceNumber && t('finance.extraIncome.invoice', { number: income.invoiceNumber }),
                ]
                    .filter(Boolean)
                    .join(' · ');

                return (
                    <li key={income.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-4">
                        <div className={cn('flex min-w-0 flex-1 items-center gap-3', isCancelled && 'opacity-60')}>
                            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', isCancelled ? 'bg-muted text-muted-foreground' : 'bg-success/12 text-success')}>
                                <BadgePercentIcon aria-hidden="true" className="size-5" />
                            </span>
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                    <span dir="auto" className="min-w-0 truncate font-heading text-base font-bold">
                                        {income.title}
                                    </span>
                                    <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                        {income.number}
                                    </span>
                                    <ExtraIncomeStatusBadge status={income.status} />
                                </span>
                                <span dir="auto" className="line-clamp-2 text-xs text-muted-foreground sm:truncate">
                                    {detail}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 md:shrink-0 md:justify-end">
                            <span className={cn('font-heading text-[0.9375rem] font-bold tabular-nums', isCancelled ? 'text-muted-foreground line-through' : 'text-success')}>
                                {formatCurrency(income.amount, currency)}
                            </span>
                            <ExtraIncomeActions income={income} fromPayments />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
