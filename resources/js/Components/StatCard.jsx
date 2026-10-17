import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const TONES = {
    primary: 'bg-primary/[0.07] text-primary inset-ring-primary/15',
    warning: 'bg-warning/10 text-warning inset-ring-warning/20',
    success: 'bg-success/10 text-success inset-ring-success/20',
};

/**
 * A headline figure with an icon, an optional meter, a line of detail and
 * an optional badge (such as a count that needs attention).
 * The value keeps proportional figures, which read tighter at display size.
 */
export default function StatCard({ icon: Icon, label, value, detail, meter, badge, tone = 'primary' }) {
    return (
        <Card className="gap-3">
            <CardHeader>
                <CardDescription className="text-[0.8125rem] font-medium">{label}</CardDescription>
                <CardAction className="hidden sm:block">
                    <span className={cn('flex size-8 items-center justify-center rounded-lg inset-ring', TONES[tone])}>
                        <Icon className="size-4" />
                    </span>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
                <p className="truncate font-heading text-xl font-semibold tracking-tight sm:text-[1.625rem] sm:leading-8">{value}</p>
                <div className="mt-auto flex flex-col gap-2.5">
                    {meter !== undefined && <Progress value={meter} aria-label={label} />}
                    {(detail || badge) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {detail && <p className="text-xs text-pretty text-muted-foreground">{detail}</p>}
                            {badge}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
