import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { Building2Icon, ChevronDownIcon, CircleCheckIcon, KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { CollectForm, useUnitsSummary } from './BillingPanel';

/**
 * Each short-term rental here that still owes, with a box to record what
 * it paid today and how: cash stays with the camp boss, while a bank
 * transfer or a cheque goes to the bank. Whatever is paid comes off its
 * bill, and more than it owes is paid ahead. Rentals paid up are listed
 * on request, to take money ahead.
 */
export default function ShortTermCollect({ rentals, currency, propertyId, period, periodLabel, methods, banks }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const unitsSummary = useUnitsSummary();
    const [showsPaidUp, setShowsPaidUp] = useState(false);
    const owing = rentals.filter((rental) => rental.statement.toPay > 0);
    const paidUp = rentals.filter((rental) => rental.statement.toPay <= 0);

    if (rentals.length === 0) {
        return (
            <Empty className="py-8 md:py-10">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <KeyRoundIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('propertyPayments.collect.empty.title', { period: periodLabel })}</EmptyTitle>
                    <EmptyDescription>{t('propertyPayments.collect.empty.description')}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col border-t">
            {owing.length === 0 && (
                <p className="flex items-center justify-center gap-1.5 px-4 py-6 text-sm font-medium text-success">
                    <CircleCheckIcon aria-hidden="true" className="size-4" />
                    {t('propertyPayments.collect.allPaid', { period: periodLabel })}
                </p>
            )}
            <ul className="flex flex-col divide-y">
                {[...owing, ...(showsPaidUp ? paidUp : [])].map((rental) => {
                    const { toPay, charged } = rental.statement;
                    const detail = [
                        unitsSummary(rental.units) || t('propertyAllocation.billing.nothingHere'),
                        `${formatDate(rental.startsOn)} – ${rental.endsOn ? formatDate(rental.endsOn) : t('propertyAllocation.openEnded')}`,
                        t('propertyPayments.collect.monthly', { amount: formatCurrency(rental.monthly, currency) }),
                    ].join(' · ');

                    return (
                        <li key={rental.key} className="flex flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:gap-5">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-300">
                                    <Building2Icon aria-hidden="true" className="size-5" />
                                </span>
                                <div className="flex min-w-0 flex-col gap-1">
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                        <Link
                                            href={route('rentals.show', rental.id)}
                                            dir="auto"
                                            className="min-w-0 truncate font-heading text-base font-bold underline-offset-4 hover:text-brand-ink hover:underline"
                                        >
                                            {rental.client.name}
                                        </Link>
                                        <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                            {rental.number}
                                        </span>
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">{detail}</span>
                                </div>
                            </div>

                            <div className="flex items-baseline justify-between gap-3 md:w-40 md:flex-col md:items-end md:gap-0.5">
                                <span className="text-xs text-muted-foreground">{t('propertyPayments.collect.dueInPeriod', { amount: formatCurrency(charged, currency) })}</span>
                                {toPay > 0 ? (
                                    <span className="font-heading text-[0.9375rem] font-bold whitespace-nowrap text-gold-ink tabular-nums">
                                        {t('propertyPayments.collect.leftToPay', { amount: formatCurrency(toPay, currency) })}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold whitespace-nowrap text-success">
                                        <CircleCheckIcon aria-hidden="true" className="size-3.5" />
                                        {t('propertyAllocation.billing.collect.paidUp')}
                                    </span>
                                )}
                            </div>

                            <div className="md:shrink-0">
                                <CollectForm account={rental} currency={currency} propertyId={propertyId} through={period.to} methods={methods} banks={banks} />
                            </div>
                        </li>
                    );
                })}
            </ul>
            {paidUp.length > 0 && (
                <div className="border-t px-4 py-2.5 sm:px-6">
                    <Button variant="ghost" size="sm" onClick={() => setShowsPaidUp(!showsPaidUp)} aria-expanded={showsPaidUp} className="text-muted-foreground">
                        <ChevronDownIcon data-icon="inline-start" className={showsPaidUp ? 'rotate-180' : undefined} />
                        {t(`propertyPayments.collect.${showsPaidUp ? 'hidePaidUp' : 'showPaidUp'}`, { count: paidUp.length })}
                    </Button>
                </div>
            )}
        </div>
    );
}
