import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { Building2Icon, ChevronDownIcon, CircleCheckIcon, KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { CollectForm, RentMonths, useUnitsSummary } from './BillingPanel';

/**
 * Each short-term rental here, those that owe first, with its months and a
 * box to record what it paid today and how: cash stays with the camp boss,
 * while a bank transfer or a cheque goes to the bank. Whatever is paid
 * comes off its bill, and more than it owes is credit that comes off the
 * next months, so a rental paid up stays listed to take money ahead.
 * Rentals ended and settled, with nothing more to take, are listed on
 * request.
 */
export default function ShortTermCollect({ rentals, currency, propertyId, period, periodLabel, methods, banks }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const unitsSummary = useUnitsSummary();
    const [showsPaidUp, setShowsPaidUp] = useState(false);
    const owing = rentals.filter((rental) => rental.statement.toPay > 0);
    const paidUp = rentals.filter((rental) => rental.statement.toPay <= 0);
    const isSettled = (rental) => rental.collectionLimit !== null && rental.collectionLimit <= 0;
    const payingAhead = paidUp.filter((rental) => !isSettled(rental));
    const settled = paidUp.filter(isSettled);

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
                {[...owing, ...payingAhead, ...(showsPaidUp ? settled : [])].map((rental) => {
                    const { toPay, charged, broughtForward, carriedForward } = rental.statement;
                    const creditUsed = Math.min(Math.max(-broughtForward, 0), charged);
                    const detail = [
                        unitsSummary(rental.units) || t('propertyAllocation.billing.nothingHere'),
                        `${formatDate(rental.startsOn)} – ${rental.endsOn ? formatDate(rental.endsOn) : t('propertyAllocation.openEnded')}`,
                        t('propertyPayments.collect.monthly', { amount: formatCurrency(rental.monthly, currency) }),
                    ].join(' · ');

                    return (
                        <li key={rental.key} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
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

                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 md:w-44 md:flex-col md:items-end md:gap-0.5">
                                    <span className="text-xs text-muted-foreground">{t('propertyPayments.collect.dueInPeriod', { amount: formatCurrency(charged, currency) })}</span>
                                    {creditUsed > 0 && (
                                        <span className="text-xs font-medium text-brand-ink">{t('propertyPayments.collect.fromCredit', { amount: formatCurrency(creditUsed, currency) })}</span>
                                    )}
                                    {toPay > 0 ? (
                                        <span className="font-heading text-[0.9375rem] font-bold whitespace-nowrap text-gold-ink tabular-nums">
                                            {t('propertyPayments.collect.leftToPay', { amount: formatCurrency(toPay, currency) })}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold whitespace-nowrap text-success">
                                            <CircleCheckIcon aria-hidden="true" className="size-3.5" />
                                            {carriedForward < 0
                                                ? t('propertyAllocation.billing.collect.inCredit', { amount: formatCurrency(-carriedForward, currency) })
                                                : t('propertyAllocation.billing.collect.paidUp')}
                                        </span>
                                    )}
                                </div>

                                <div className="md:shrink-0">
                                    <CollectForm account={rental} currency={currency} propertyId={propertyId} through={period.to} methods={methods} banks={banks} showsStanding={false} />
                                </div>
                            </div>
                            {rental.months.length > 0 && <RentMonths months={rental.months} currency={currency} className="md:ps-13" />}
                        </li>
                    );
                })}
            </ul>
            {settled.length > 0 && (
                <div className="border-t px-4 py-2.5 sm:px-6">
                    <Button variant="ghost" size="sm" onClick={() => setShowsPaidUp(!showsPaidUp)} aria-expanded={showsPaidUp} className="text-muted-foreground">
                        <ChevronDownIcon data-icon="inline-start" className={showsPaidUp ? 'rotate-180' : undefined} />
                        {t(`propertyPayments.collect.${showsPaidUp ? 'hidePaidUp' : 'showPaidUp'}`, { count: settled.length })}
                    </Button>
                </div>
            )}
        </div>
    );
}
