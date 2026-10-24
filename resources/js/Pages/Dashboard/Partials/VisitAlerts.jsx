import { amcNavTitle, VisitStatusBadge } from '@/Components/AmcBadges';
import { AlertPulse, useVisitTiming, VisitStatusDialog } from '@/Components/VisitSchedule';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, CircleCheckIcon, PhoneIcon, SirenIcon } from 'lucide-react';
import { useState } from 'react';

// Visits listed before the rest are left to the visit schedule page.
const SHOWN = 6;

/**
 * The day of a visit as a small calendar leaf: month above, day below.
 */
function DateLeaf({ date, isOverdue }) {
    const { locale } = useTranslation();
    const day = new Date(`${date}T00:00:00`);

    return (
        <span
            className={cn(
                'flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-lg ring-1',
                isOverdue ? 'bg-destructive text-white ring-destructive' : 'bg-destructive/[0.07] text-destructive ring-destructive/30',
            )}
        >
            <span className={cn('w-full py-0.5 text-center text-[0.6875rem] font-semibold uppercase', isOverdue ? 'bg-black/15' : 'bg-destructive/10')}>
                {new Intl.DateTimeFormat(LOCALES[locale].intl, { month: 'short' }).format(day)}
            </span>
            <span className="py-1 font-heading text-lg leading-none font-bold tabular-nums">{new Intl.DateTimeFormat(LOCALES[locale].intl, { day: 'numeric' }).format(day)}</span>
        </span>
    );
}

function VisitRow({ visit, onDone }) {
    const { t } = useTranslation();
    const timing = useVisitTiming()(visit);
    const isOverdue = visit.alert === 'overdue';

    return (
        <li className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-destructive/20 sm:flex-nowrap">
            <DateLeaf date={visit.scheduledOn} isOverdue={isOverdue} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                    <Link href={visit.contract.url} dir="auto" className="truncate font-semibold underline-offset-4 hover:text-brand-ink hover:underline">
                        {visit.contract.property?.name ?? visit.contract.number}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">· {t(amcNavTitle(visit.contract.service))}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-destructive">
                        {timing}
                        {visit.scheduledTime && ` · ${visit.scheduledTime}`}
                    </span>
                    <span dir="auto" className="truncate">
                        {visit.contract.vendor}
                    </span>
                    {visit.contract.vendorPhone && (
                        <a href={`tel:${visit.contract.vendorPhone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 tabular-nums underline-offset-4 hover:text-brand-ink hover:underline">
                            <PhoneIcon className="size-3" />
                            {visit.contract.vendorPhone}
                        </a>
                    )}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <VisitStatusBadge status={visit.status} alert={visit.alert} />
                <Button variant="outline" size="sm" onClick={() => onDone(visit)}>
                    <CircleCheckIcon data-icon="inline-start" />
                    {t('amcs.schedule.actions.done')}
                </Button>
            </div>
        </li>
    );
}

/**
 * Contractors' visits that must be dealt with now, such as the pest control
 * treatment due in two days: each visit inside its contract's alert window,
 * or overdue. Blinks red until every one is marked done (or missed,
 * cancelled or moved), so no one forgets to have the site ready. Hidden
 * when no visit is close.
 */
export default function VisitAlerts({ visits }) {
    const { t, formatNumber } = useTranslation();
    const [marking, setMarking] = useState(null);
    const overdue = visits.filter((visit) => visit.alert === 'overdue').length;

    if (visits.length === 0) {
        return null;
    }

    return (
        <Card role="alert" className="gap-4 bg-destructive/[0.04] ring-destructive/40 motion-safe:animate-alert-blink">
            <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-destructive">
                    <span className="relative flex size-8 items-center justify-center rounded-lg bg-destructive text-white">
                        <SirenIcon className="size-4" />
                        <AlertPulse className="absolute -end-1 -top-1" />
                    </span>
                    {t('amcs.alerts.title')}
                </CardTitle>
                <CardDescription>
                    {overdue > 0 ? t('amcs.alerts.overdue', { count: overdue }) : null} {t('amcs.alerts.description')}
                </CardDescription>
                <CardAction>
                    <Badge variant="destructive" className="h-6 px-2.5 tabular-nums">
                        {formatNumber(visits.length)}
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                    {visits.slice(0, SHOWN).map((visit) => (
                        <VisitRow key={visit.id} visit={visit} onDone={setMarking} />
                    ))}
                </ul>
                <Button variant="ghost" size="sm" className="self-end" nativeButton={false} render={<Link href={route('amc-visits.index', { due: ['overdue', 'alert'] })} />}>
                    {visits.length > SHOWN ? t('amcs.alerts.more', { count: visits.length - SHOWN }) : t('amcs.alerts.viewAll')}
                    <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                </Button>
            </CardContent>

            {marking && <VisitStatusDialog key={marking.id} visit={marking} status="done" open onOpenChange={(open) => !open && setMarking(null)} />}
        </Card>
    );
}
