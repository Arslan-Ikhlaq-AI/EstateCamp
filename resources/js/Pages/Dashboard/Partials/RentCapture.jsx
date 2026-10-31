import RadialGauge from '@/Components/RadialGauge';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { CircleCheckIcon } from 'lucide-react';

/**
 * The monthly rent roll as a share of what every room in service could
 * earn, with the rent still waiting in vacant rooms.
 */
export default function RentCapture({ summary, currency, className }) {
    const { t, formatCurrency, formatPercent } = useTranslation();
    const money = (value) => formatCurrency(value, currency);
    const share = summary.potentialRent > 0 ? (summary.rentRoll / summary.potentialRent) * 100 : null;
    const vacancy = Math.max(summary.potentialRent - summary.rentRoll, 0);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.capture.title')}</CardTitle>
                <CardDescription>{t('dashboard.capture.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-5">
                <RadialGauge
                    arc="half"
                    size={232}
                    thickness={18}
                    value={share}
                    label={`${t('dashboard.capture.title')}: ${share === null ? '—' : formatPercent(share)}`}
                >
                    <span className="font-heading text-[2.25rem] leading-none font-bold tracking-tight">
                        {share === null ? '—' : formatPercent(share)}
                    </span>
                    <span className="mt-1 text-[0.875rem] text-muted-foreground">{t('dashboard.capture.captured')}</span>
                </RadialGauge>

                <dl className="grid w-full grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3.5 py-3">
                        <dt className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                            <span aria-hidden="true" className="size-2.5 rounded-full bg-linear-to-br from-brand-cyan to-chart-1" />
                            {t('dashboard.capture.rentRoll')}
                        </dt>
                        <dd className="text-base font-bold">{money(summary.rentRoll)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3.5 py-3">
                        <dt className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
                            <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-1/15 inset-ring inset-ring-chart-1/30" />
                            {t('dashboard.capture.potential')}
                        </dt>
                        <dd className="text-base font-bold">{money(summary.potentialRent)}</dd>
                    </div>
                </dl>

                {vacancy > 0 ? (
                    <p className="text-center text-[0.875rem] text-muted-foreground">
                        {t('dashboard.performance.vacancyLoss', { amount: money(vacancy) })}
                    </p>
                ) : (
                    summary.potentialRent > 0 && (
                        <Badge variant="success">
                            <CircleCheckIcon data-icon="inline-start" />
                            {t('dashboard.performance.fullyLet')}
                        </Badge>
                    )
                )}
            </CardContent>
        </Card>
    );
}
