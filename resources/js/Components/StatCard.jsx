import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowUpRightIcon } from 'lucide-react';

const TONES = {
    primary: 'from-brand-cyan to-brand-navy text-white shadow-brand-cyan/30 dark:to-[#0b4f8a]',
    gold: 'from-brand-sun to-gold text-brand-navy shadow-gold/35',
    warning: 'from-warning/75 to-warning text-white shadow-warning/25',
    success: 'from-success/70 to-success text-white shadow-success/25',
};

/**
 * A headline figure with an icon, an optional meter, a line of detail and
 * an optional badge (such as a count that needs attention). With `href` the
 * whole tile links to the page behind the figure. The value keeps
 * proportional figures, which read tighter at display size.
 */
export default function StatCard({ icon: Icon, label, value, detail, meter, badge, href, tone = 'primary' }) {
    const card = (
        <Card
            className={cn(
                'h-full gap-3',
                href && 'transition-[box-shadow,translate] duration-200 group-hover/stat:-translate-y-0.5 group-hover/stat:shadow-(--overlay-shadow) motion-reduce:group-hover/stat:translate-y-0',
            )}
        >
            <CardHeader>
                <CardDescription className="flex items-center gap-1.5 text-[0.875rem] font-medium">
                    {label}
                    {href && (
                        <ArrowUpRightIcon className="size-4 text-brand-ink opacity-0 transition-opacity group-hover/stat:opacity-100 group-focus-visible/stat:opacity-100 rtl:-scale-x-100" />
                    )}
                </CardDescription>
                <CardAction className="hidden sm:block">
                    <span className={cn('flex size-10 items-center justify-center rounded-xl bg-linear-to-br shadow-md inset-ring inset-ring-white/25', TONES[tone])}>
                        <Icon className="size-5" />
                    </span>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
                <p className="truncate font-heading text-2xl font-bold tracking-tight sm:text-[1.875rem] sm:leading-9">{value}</p>
                <div className="mt-auto flex flex-col gap-2.5">
                    {meter !== undefined && <Progress value={meter} aria-label={label} />}
                    {(detail || badge) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {detail && <p className="text-[0.875rem] text-pretty text-muted-foreground">{detail}</p>}
                            {badge}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    if (!href) {
        return card;
    }

    return (
        <Link href={href} className="group/stat block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {card}
        </Link>
    );
}
