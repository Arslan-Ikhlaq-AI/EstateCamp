import { Badge } from '@/components/ui/badge';
import {
    Card,
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
import {
    CircleAlertIcon,
    CircleCheckIcon,
    Clock3Icon,
    FileTextIcon,
    InfinityIcon,
} from 'lucide-react';

/**
 * Document statuses by urgency. Status colours always come with an icon and
 * a label, never colour alone.
 */
const STATUSES = [
    { key: 'expired', variant: 'destructive', icon: CircleAlertIcon, tile: 'bg-destructive/10 text-destructive' },
    { key: 'expiring', variant: 'warning', icon: Clock3Icon, tile: 'bg-warning/10 text-warning' },
    { key: 'valid', variant: 'success', icon: CircleCheckIcon, tile: 'bg-success/10 text-success' },
    { key: 'no_expiry', variant: 'secondary', icon: InfinityIcon, tile: 'bg-muted text-muted-foreground' },
];

const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((status) => [status.key, status]));

/**
 * How long until a document expires, or since it did.
 */
function timing(document, t) {
    if (document.daysLeft === null) {
        return t('dashboard.documents.noExpiry');
    }

    if (document.daysLeft === 0) {
        return t('alerts.expiresToday');
    }

    return document.daysLeft < 0
        ? t('alerts.expiredAgo', { count: Math.abs(document.daysLeft) })
        : t('alerts.expiresIn', { count: document.daysLeft });
}

export default function DocumentsCard({ documents, className }) {
    const { t, formatDate, formatNumber } = useTranslation();
    const counts = Object.fromEntries(STATUSES.map(({ key }) => [key, documents.filter((document) => document.status === key).length]));

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.documents.title')}</CardTitle>
                <CardDescription>{t('dashboard.documents.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {documents.length === 0 ? (
                    <Empty className="p-4">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FileTextIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('dashboard.documents.empty')}</EmptyTitle>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <ul className="flex flex-wrap gap-2">
                            {STATUSES.filter(({ key }) => counts[key] > 0).map(({ key, variant, icon: Icon }) => (
                                <li key={key}>
                                    <Badge variant={variant} className="h-6 px-2.5">
                                        <Icon data-icon="inline-start" />
                                        {t(`status.${key}`)}
                                        <span className="ms-0.5 tabular-nums opacity-80">{formatNumber(counts[key])}</span>
                                    </Badge>
                                </li>
                            ))}
                        </ul>

                        <ul className="grid gap-3 md:grid-cols-2">
                            {documents.map((document) => {
                                const { icon: StatusIcon, tile } = STATUS_BY_KEY[document.status];

                                return (
                                    <li key={document.id}>
                                        <Link
                                            href={route('properties.show', document.propertyId)}
                                            className="flex items-start gap-3 rounded-lg p-3 ring-1 ring-foreground/[0.07] transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                        >
                                            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', tile)}>
                                                <StatusIcon className="size-4" />
                                            </span>
                                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="line-clamp-1 text-sm font-medium" dir="auto">{document.title}</span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    <span dir="auto">{document.property}</span> · <span dir="ltr">{document.number}</span>
                                                </span>
                                                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                                                    <span className={cn('font-medium', (document.status === 'expired' || document.status === 'expiring') && 'text-foreground')}>
                                                        {timing(document, t)}
                                                    </span>
                                                    {document.expiresOn && (
                                                        <span className="text-muted-foreground">{formatDate(document.expiresOn)}</span>
                                                    )}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
