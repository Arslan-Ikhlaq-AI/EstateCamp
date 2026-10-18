import DonutChart, { DonutLegend } from '@/Components/DonutChart';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { LOCALES, useTranslation } from '@/hooks/use-translation';

/**
 * Categorical slots validated for three series (every pair, both themes);
 * a fourth method folds into a grey "Other".
 */
const SLOTS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'];

/**
 * How collections over the trend window were paid: cash, bank transfer,
 * cheque or card.
 */
export default function PaymentMethods({ methods, currency, className }) {
    const { t, locale, formatCurrency, formatPercent } = useTranslation();
    const named = methods.slice(0, SLOTS.length).map((method, index) => ({
        key: method.method,
        label: t(`leasing.methods.${method.method}`),
        value: method.amount,
        color: SLOTS[index],
    }));
    const rest = methods.slice(SLOTS.length);
    const segments = rest.length
        ? [...named, { key: 'other', label: t('dashboard.paymentMethods.other'), value: rest.reduce((sum, method) => sum + method.amount, 0), color: 'var(--chart-3)' }]
        : named;
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    const money = (value) => formatCurrency(value, currency);
    const compact = new Intl.NumberFormat(LOCALES[locale].intl, { notation: 'compact', maximumFractionDigits: 1, numberingSystem: 'latn' });

    if (total === 0) {
        return null;
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.paymentMethods.title')}</CardTitle>
                <CardDescription>{t('dashboard.paymentMethods.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-5">
                <DonutChart segments={segments} label={t('dashboard.paymentMethods.title')} valueFormatter={money}>
                    <span className="text-xs text-muted-foreground">{currency}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight">{compact.format(total)}</span>
                </DonutChart>
                <DonutLegend segments={segments} total={total} valueFormatter={money} formatShare={formatPercent} />
            </CardContent>
        </Card>
    );
}
