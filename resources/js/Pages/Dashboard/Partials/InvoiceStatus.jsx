import DonutChart, { DonutLegend } from '@/Components/DonutChart';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, CircleAlertIcon, CircleCheckIcon, CircleDotDashedIcon, Clock3Icon } from 'lucide-react';

/**
 * Status colours with an icon each, so state never rests on colour alone.
 */
const STATUSES = [
    { key: 'paid', color: 'var(--success)', icon: CircleCheckIcon },
    { key: 'awaiting', color: 'var(--chart-1)', icon: Clock3Icon },
    { key: 'partial', color: 'var(--warning)', icon: CircleDotDashedIcon },
    { key: 'overdue', color: 'var(--destructive)', icon: CircleAlertIcon },
];

/**
 * Every invoice that is not void, by where it stands.
 */
export default function InvoiceStatus({ status, className }) {
    const { t, formatNumber, formatPercent } = useTranslation();
    const segments = STATUSES.map((item) => ({ ...item, label: t(`dashboard.invoiceStatus.${item.key}`), value: status[item.key] }));
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.invoiceStatus.title')}</CardTitle>
                <CardDescription>{t('dashboard.invoiceStatus.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="icon-sm" nativeButton={false} aria-label={t('nav.invoices')} render={<Link href={route('invoices.index')} />}>
                        <ArrowRightIcon className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center gap-5">
                <DonutChart segments={segments} label={t('dashboard.invoiceStatus.title')} valueFormatter={formatNumber}>
                    <span className="font-heading text-2xl font-bold tracking-tight">{formatNumber(total)}</span>
                    <span className="text-xs text-muted-foreground">{t('dashboard.invoiceStatus.invoices')}</span>
                </DonutChart>
                <DonutLegend segments={segments} total={total} valueFormatter={formatNumber} formatShare={formatPercent} />
            </CardContent>
        </Card>
    );
}
