import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { UserRoundIcon } from 'lucide-react';
import { useId } from 'react';

/**
 * The icon tile of each kind of section, on the same gradients as the
 * headline figures elsewhere.
 */
export const SECTION_TONES = {
    brand: 'from-brand-cyan to-brand-navy text-white shadow-brand-cyan/30 dark:to-[#0b4f8a]',
    violet: 'from-violet-400 to-violet-600 text-white shadow-violet-500/30',
    emerald: 'from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30',
    gold: 'from-brand-sun to-gold text-brand-navy shadow-gold/35',
    orange: 'from-orange-400 to-orange-600 text-white shadow-orange-500/30',
    slate: 'from-slate-400 to-slate-600 text-white shadow-slate-500/30',
};

/**
 * A summary figure by meaning: money in hand in green, waiting in gold,
 * gone wrong or still owed in red, totals on the brand cyan. A figure at
 * nothing reads muted, whatever it means.
 */
const FIGURE_TONES = {
    brand: { tile: 'bg-brand-cyan/[0.06] ring-brand-cyan/20', value: 'text-foreground', icon: 'text-brand-ink' },
    success: { tile: 'bg-success/[0.06] ring-success/20', value: 'text-success', icon: 'text-success' },
    gold: { tile: 'bg-gold/10 ring-gold/30', value: 'text-gold-ink', icon: 'text-gold-ink' },
    danger: { tile: 'bg-destructive/[0.05] ring-destructive/20', value: 'text-destructive', icon: 'text-destructive' },
    muted: { tile: 'bg-muted/60 ring-foreground/[0.06]', value: 'text-foreground', icon: 'text-muted-foreground' },
};

const GRID_COLUMNS = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'sm:grid-cols-3 xl:grid-cols-5' };

/**
 * One summary figure: an amount of money, or a plain `number` of items.
 */
function Figure({ figure, currency }) {
    const { formatCurrency, formatNumber } = useTranslation();
    const { icon: Icon, label, amount, number, detail } = figure;
    const value = amount === undefined ? formatNumber(number) : formatCurrency(amount, currency);
    const tone = FIGURE_TONES[(amount ?? number) === 0 ? 'muted' : figure.tone];

    return (
        <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl px-3.5 py-3 ring-1 ring-inset sm:px-4', tone.tile)}>
            <dt className="flex min-w-0 items-start gap-1.5 text-xs leading-4 font-medium text-muted-foreground">
                {Icon && <Icon aria-hidden="true" className={cn('size-3.5 shrink-0 translate-y-px', tone.icon)} />}
                <span className="line-clamp-2 sm:truncate">{label}</span>
            </dt>
            <dd title={value} className={cn('truncate font-heading text-lg font-bold tracking-tight tabular-nums sm:text-xl', tone.value)}>
                {value}
            </dd>
            {detail && <dd className="text-xs text-pretty text-muted-foreground">{detail}</dd>}
        </div>
    );
}

/**
 * A numbered part of the payments page: its icon, title, who looks after
 * it and what it holds, its own summary figures and its actions, then its
 * lists.
 */
export default function PaymentSection({ number, tone, icon: Icon, title, owner, description, actions, figures, currency, children }) {
    const id = useId();

    return (
        <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-2xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.08]">
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-3.5">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-md inset-ring inset-ring-white/25 rtl:bg-linear-to-bl',
                                SECTION_TONES[tone],
                            )}
                        >
                            <Icon className="size-5" />
                            <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-card text-[0.6875rem] font-bold text-foreground shadow-sm ring-1 ring-foreground/10">
                                {number}
                            </span>
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <h2 id={`${id}-title`} className="font-heading text-lg font-bold tracking-tight sm:text-xl">
                                    {title}
                                </h2>
                                {owner && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 text-xs leading-6 font-medium text-muted-foreground">
                                        <UserRoundIcon aria-hidden="true" className="size-3.5" />
                                        {owner}
                                    </span>
                                )}
                            </div>
                            {description && <p className="max-w-3xl text-[0.875rem] text-pretty text-muted-foreground">{description}</p>}
                        </div>
                    </div>
                    {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
                </div>

                {figures && (
                    <dl className={cn('grid grid-cols-2 gap-2.5 sm:gap-3', GRID_COLUMNS[figures.length])}>
                        {figures.map((figure) => (
                            <Figure key={figure.label} figure={figure} currency={currency} />
                        ))}
                    </dl>
                )}
            </div>

            {children && <div className="flex flex-col divide-y border-t">{children}</div>}
        </section>
    );
}

/**
 * A titled list within a section, such as the cheques or the receipts,
 * with an optional count and a line about it.
 */
export function SectionPart({ title, count, hint, children }) {
    const { formatNumber } = useTranslation();

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-0.5 px-4 pt-4 pb-3 sm:px-6">
                <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    {title}
                    {count !== undefined && (
                        <span className="rounded-full bg-foreground/[0.07] px-2 text-xs leading-5 font-semibold text-muted-foreground tabular-nums">{formatNumber(count)}</span>
                    )}
                </h3>
                {hint && <p className="text-xs text-pretty text-muted-foreground">{hint}</p>}
            </div>
            {children}
        </div>
    );
}

/**
 * What a list within a section says when it has nothing to show.
 */
export function SectionEmpty({ children }) {
    return <p className="border-t px-4 py-7 text-center text-sm text-muted-foreground sm:px-6">{children}</p>;
}
