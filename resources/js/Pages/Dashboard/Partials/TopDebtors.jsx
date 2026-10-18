import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, CircleCheckIcon } from 'lucide-react';

/**
 * The clients with the largest unpaid balances, largest first, each with a
 * meter against the biggest balance and how much of it is overdue.
 */
export default function TopDebtors({ debtors, currency, className }) {
    const { t, formatMoney, formatNumber } = useTranslation();
    const largest = Math.max(...debtors.map((debtor) => debtor.balance), 1);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.debtors.title')}</CardTitle>
                <CardDescription>{t('dashboard.debtors.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="icon-sm" nativeButton={false} aria-label={t('dashboard.debtors.all')} render={<Link href={route('invoices.index')} />}>
                        <ArrowRightIcon className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent>
                {debtors.length === 0 ? (
                    <Empty className="p-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <CircleCheckIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.debtors.empty')}</EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ol className="-mx-1.5 flex flex-col gap-1">
                        {debtors.map((debtor, index) => (
                            <li key={debtor.id}>
                                <Link
                                    href={route('clients.show', debtor.id)}
                                    className="group/debtor flex items-center gap-3 rounded-xl p-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums',
                                            index === 0 ? 'bg-linear-to-br from-brand-sun to-gold text-brand-navy' : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {formatNumber(index + 1)}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <span className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-sm font-medium group-hover/debtor:text-brand-ink" dir="auto">{debtor.name}</span>
                                            <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(debtor.balance, currency)}</span>
                                        </span>
                                        <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                                            <span
                                                className="block h-full rounded-full bg-linear-to-r from-brand-cyan to-chart-1 transition-[width] duration-700 rtl:bg-linear-to-l"
                                                style={{ width: `${(debtor.balance / largest) * 100}%` }}
                                            />
                                        </span>
                                        <span className={cn('text-xs', debtor.overdue > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                                            {debtor.overdue > 0
                                                ? t('dashboard.debtors.overdue', { amount: formatMoney(debtor.overdue, currency) })
                                                : t('dashboard.debtors.notDue')}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
