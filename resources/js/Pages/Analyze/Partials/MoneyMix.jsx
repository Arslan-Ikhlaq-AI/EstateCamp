import DonutChart, { DonutLegend } from '@/Components/DonutChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LOCALES, useTranslation } from '@/hooks/use-translation';

/**
 * A whole split into its parts, as a donut with the total in its hole and a
 * legend naming each part with its amount and share. `segments` are
 * `{ key, label, value, color, icon }`; `empty` shows instead when there is
 * nothing to split.
 */
export default function MoneyMix({ title, description, totalLabel, segments, currency, empty }) {
    const { locale, formatCurrency, formatMoney, formatPercent } = useTranslation();
    const compact = new Intl.NumberFormat(LOCALES[locale].intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row xl:flex-col">
                {total > 0 ? (
                    <>
                        <DonutChart segments={segments} label={title} size={176} valueFormatter={(value) => formatMoney(value, currency)}>
                            <span className="text-xs text-muted-foreground">{totalLabel}</span>
                            <span className="font-heading text-xl font-bold tracking-tight">{compact.format(total)}</span>
                        </DonutChart>
                        <DonutLegend segments={segments} total={total} valueFormatter={(value) => formatCurrency(value, currency)} formatShare={formatPercent} />
                    </>
                ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
                )}
            </CardContent>
        </Card>
    );
}
