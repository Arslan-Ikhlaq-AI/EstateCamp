import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { FileSignatureIcon, HandCoinsIcon, LogInIcon, LogOutIcon, ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';

const FILTERS = {
    all: () => true,
    money: (event) => event.type === 'payment' || event.type === 'invoice',
    stays: (event) => event.type === 'check_in' || event.type === 'check_out',
    contracts: (event) => event.type === 'contract',
};

const TONES = {
    success: 'bg-success/12 text-success',
    gold: 'bg-gold/20 text-gold-ink',
    danger: 'bg-destructive/12 text-destructive',
    brand: 'bg-brand-cyan/12 text-brand-ink',
    navy: 'bg-primary/10 text-primary dark:bg-primary/15',
    muted: 'bg-muted text-muted-foreground',
};

/**
 * Words, icon and colour for one event from the server.
 */
function describe(event, t) {
    switch (event.type) {
        case 'payment':
            if (event.status === 'bounced') {
                return { icon: HandCoinsIcon, tone: 'danger', title: t('dashboard.activity.paymentBounced', { subject: event.subject }) };
            }

            return event.status === 'pending'
                ? { icon: HandCoinsIcon, tone: 'gold', title: t('dashboard.activity.paymentPending', { subject: event.subject }) }
                : { icon: HandCoinsIcon, tone: 'success', title: t('dashboard.activity.payment', { subject: event.subject }) };
        case 'invoice':
            return { icon: ReceiptTextIcon, tone: 'brand', title: t('dashboard.activity.invoice', { subject: event.subject }) };
        case 'check_in':
            return { icon: LogInIcon, tone: 'gold', title: t('dashboard.activity.checkIn', { subject: event.subject }) };
        case 'check_out':
            return { icon: LogOutIcon, tone: 'muted', title: t('dashboard.activity.checkOut', { subject: event.subject }) };
        default:
            return { icon: FileSignatureIcon, tone: 'navy', title: t('dashboard.activity.contract', { subject: event.subject }) };
    }
}

/**
 * The latest payments, invoices, check-ins, check-outs and contracts as a
 * timeline, narrowed with the filter above it. Each event opens its record.
 */
export default function RecentActivity({ activity, currency, className }) {
    const { t, locale, formatMoney, formatDate } = useTranslation();
    const [filter, setFilter] = useState('all');
    const relative = new Intl.RelativeTimeFormat(LOCALES[locale].intl, { numeric: 'auto' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const when = (day) => {
        const days = Math.round((new Date(`${day}T00:00:00`) - today) / 86_400_000);

        return days > -7 ? relative.format(days, 'day') : formatDate(day);
    };

    const events = activity.filter(FILTERS[filter]);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{t('dashboard.activity.title')}</CardTitle>
                <CardDescription>{t('dashboard.activity.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ToggleGroup
                    aria-label={t('dashboard.activity.filterLabel')}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    value={[filter]}
                    onValueChange={([value]) => value && setFilter(value)}
                    className="w-full"
                >
                    {Object.keys(FILTERS).map((key) => (
                        <ToggleGroupItem
                            key={key}
                            value={key}
                            className="flex-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                        >
                            {t(`dashboard.activity.filters.${key}`)}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                {events.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.activity.empty')}</p>
                ) : (
                    <ol className="relative flex flex-col">
                        {events.map((event, index) => {
                            const { icon: Icon, tone, title } = describe(event, t);
                            const detail = event.room
                                ? t('leasing.lines.roomName', { room: event.room })
                                : event.reference;

                            return (
                                <li key={event.id} className="relative motion-safe:animate-enter" style={{ animationDelay: `${index * 40}ms` }}>
                                    {index < events.length - 1 && (
                                        <span aria-hidden="true" className="absolute start-[1.1875rem] top-11 bottom-0 w-px bg-border" />
                                    )}
                                    <Link
                                        href={event.url}
                                        className="group/event flex gap-3 rounded-xl p-1.5 pb-4 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                                    >
                                        <span className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card', TONES[tone])}>
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                                            <span className="text-sm leading-snug font-medium group-hover/event:text-brand-ink" dir="auto">{title}</span>
                                            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    {detail && <span dir="auto" className="truncate">{detail}</span>}
                                                    {detail && <span aria-hidden="true">·</span>}
                                                    <span className="shrink-0">{when(event.date)}</span>
                                                </span>
                                                {event.amount !== null && (
                                                    <span className="shrink-0 text-[0.8125rem] font-bold text-foreground tabular-nums">{formatMoney(event.amount, currency)}</span>
                                                )}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </CardContent>
        </Card>
    );
}
