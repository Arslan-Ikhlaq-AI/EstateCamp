import { ChequeList } from '@/Components/ChequeSchedule';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, ArrowUpRightIcon, HandCoinsIcon, LandmarkIcon, Undo2Icon } from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

/**
 * Each month's total is drawn as a flat step: cheques land on set dates, so a
 * smooth curve would suggest money between them that is not there.
 *
 * Money in (client cheques) in the brand blue, money out (landlord cheques)
 * in gold: different hues and lightness, so they stay apart for colour-blind
 * readers, and each is named in the legend and totals.
 */
const SERIES = {
    incoming: 'var(--chart-1)',
    outgoing: 'var(--gold)',
};

function Figure({ icon: Icon, label, value, detail, tone, href }) {
    return (
        <Link
            href={href}
            className={cn(
                'group/figure flex min-w-0 flex-col gap-1 rounded-xl px-3.5 py-3 ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                tone === 'warning' && 'bg-warning/[0.07] ring-warning/25 hover:bg-warning/[0.12]',
                tone === 'danger' && 'bg-destructive/[0.06] ring-destructive/25 hover:bg-destructive/[0.1]',
                tone === 'gold' && 'bg-gold/[0.08] ring-gold/30 hover:bg-gold/[0.14]',
                tone === 'muted' && 'bg-muted/50 ring-foreground/[0.06] hover:bg-muted',
            )}
        >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                <span className="truncate">{label}</span>
            </span>
            <span className="font-heading text-lg font-bold tracking-tight tabular-nums">{value}</span>
            <span className="text-xs text-pretty text-muted-foreground">{detail}</span>
        </Link>
    );
}

/**
 * Cheques at a glance: what to bank now, what is in hand, what goes to
 * landlords in the next month and what bounced; a 12-month forecast of
 * money in and out by cheque date; and the cheques coming up.
 */
export default function ChequesOverview({ cheques, currency }) {
    const { t, locale, dir, isRtl, formatCurrency, formatMoney } = useTranslation();
    const { summary, upcoming, forecast } = cheques;
    const intl = LOCALES[locale].intl;
    const isAnimated = useMemo(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

    const monthFormat = new Intl.DateTimeFormat(intl, { month: 'short' });
    const fullMonthFormat = new Intl.DateTimeFormat(intl, { month: 'long', year: 'numeric' });
    const compact = new Intl.NumberFormat(intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });
    const toDate = (month) => new Date(`${month}-01T00:00:00`);

    const data = forecast.map((point) => ({ ...point, label: monthFormat.format(toDate(point.month)) }));
    const incoming = forecast.reduce((sum, point) => sum + point.incoming, 0);
    const outgoing = forecast.reduce((sum, point) => sum + point.outgoing, 0);
    const config = {
        incoming: { label: t('leasing.cheques.forecast.incoming'), color: SERIES.incoming },
        outgoing: { label: t('leasing.cheques.forecast.outgoing'), color: SERIES.outgoing },
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('leasing.cheques.title')}</CardTitle>
                <CardDescription>{t('leasing.cheques.forecast.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('cheques.index')} />}>
                        {t('leasing.cheques.upcoming.viewAll')}
                        <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-2.5 2xl:grid-cols-4">
                    <Figure
                        icon={LandmarkIcon}
                        label={t('leasing.cheques.stats.toDeposit')}
                        value={formatCurrency(summary.toDeposit.amount, currency)}
                        detail={t('leasing.cheques.stats.toDepositDetail', { count: summary.toDeposit.count })}
                        tone={summary.toDeposit.count > 0 ? 'warning' : 'muted'}
                        href={route('cheques.index', { direction: ['received'], stage: ['received'], due: ['overdue'] })}
                    />
                    <Figure
                        icon={HandCoinsIcon}
                        label={t('leasing.cheques.stats.inHand')}
                        value={formatCurrency(summary.inHand.amount, currency)}
                        detail={t('leasing.cheques.stats.inHandDetail', { count: summary.inHand.count })}
                        tone="muted"
                        href={route('cheques.index', { direction: ['received'], stage: ['received'] })}
                    />
                    <Figure
                        icon={ArrowUpRightIcon}
                        label={t('leasing.cheques.stats.dueToPay')}
                        value={formatCurrency(summary.dueToPay.amount, currency)}
                        detail={t('leasing.cheques.stats.dueToPayDetail', { count: summary.dueToPay.count, written: summary.dueToPay.count - summary.toWrite.count })}
                        tone="gold"
                        href={route('cheques.index', { direction: ['issued'], due: ['next_30_days'] })}
                    />
                    <Figure
                        icon={Undo2Icon}
                        label={t('leasing.cheques.stats.bounced')}
                        value={formatCurrency(summary.bounced.amount, currency)}
                        detail={summary.bounced.count > 0 ? t('leasing.cheques.stats.bouncedDetail', { count: summary.bounced.count }) : t('leasing.cheques.stats.bouncedNone')}
                        tone={summary.bounced.count > 0 ? 'danger' : 'muted'}
                        href={route('cheques.index', { stage: ['bounced'] })}
                    />
                </div>

                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="flex min-w-0 flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                            <div className="flex flex-col gap-0.5">
                                <h3 className="text-sm font-bold">{t('leasing.cheques.forecast.title')}</h3>
                                <p className="text-xs text-muted-foreground">{t('leasing.cheques.forecast.description')}</p>
                            </div>
                            <dl className="flex flex-wrap gap-x-6 gap-y-2">
                                {[
                                    { key: 'incoming', value: incoming },
                                    { key: 'outgoing', value: outgoing },
                                ].map((series) => (
                                    <div key={series.key} className="flex flex-col gap-0.5">
                                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: SERIES[series.key] }} />
                                            {config[series.key].label}
                                        </dt>
                                        <dd className="text-base font-bold tracking-tight tabular-nums">{formatCurrency(series.value, currency)}</dd>
                                    </div>
                                ))}
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-muted-foreground">{t('leasing.cheques.forecast.net')}</dt>
                                    <dd className={cn('text-base font-bold tracking-tight tabular-nums', incoming - outgoing < 0 && 'text-destructive')}>
                                        {formatCurrency(incoming - outgoing, currency)}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                        <ChartContainer config={config} dir="ltr" className="aspect-auto h-60 w-full" initialDimension={{ width: 640, height: 240 }}>
                            <AreaChart accessibilityLayer data={data} margin={{ top: 8, left: 4, right: 4, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="cheques-incoming" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-incoming)" stopOpacity={0.28} />
                                        <stop offset="100%" stopColor="var(--color-incoming)" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="cheques-outgoing" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-outgoing)" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="var(--color-outgoing)" stopOpacity={0.02} />
                                    </linearGradient>
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
                                <Area
                                    dataKey="outgoing"
                                    type="step"
                                    stroke="var(--color-outgoing)"
                                    strokeWidth={2}
                                    fill="url(#cheques-outgoing)"
                                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                                    isAnimationActive={isAnimated}
                                />
                                <Area
                                    dataKey="incoming"
                                    type="step"
                                    stroke="var(--color-incoming)"
                                    strokeWidth={2.5}
                                    fill="url(#cheques-incoming)"
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                                    isAnimationActive={isAnimated}
                                />
                            </AreaChart>
                        </ChartContainer>
                    </div>

                    <div className="flex min-w-0 flex-col gap-3 border-t pt-5 2xl:border-t-0 2xl:border-s 2xl:pt-0 2xl:ps-6">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-sm font-bold">{t('leasing.cheques.upcoming.title')}</h3>
                            <p className="text-xs text-muted-foreground">{t('leasing.cheques.upcoming.description')}</p>
                        </div>
                        <ChequeList cheques={upcoming} currency={currency} showParty empty={t('leasing.cheques.upcoming.none')} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
