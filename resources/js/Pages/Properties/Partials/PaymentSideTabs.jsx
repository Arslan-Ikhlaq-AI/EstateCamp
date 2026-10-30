import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ArrowDownLeftIcon, ArrowUpRightIcon } from 'lucide-react';

/**
 * Each side's colours: money in on the brand cyan, money out on the gold.
 * The side in view is filled with its colour; the other keeps a coloured
 * icon so both read as buttons.
 */
const SIDES = {
    in: {
        icon: ArrowDownLeftIcon,
        ink: 'text-brand-ink',
        active: 'data-active:from-brand-cyan data-active:to-brand-navy data-active:text-white dark:data-active:to-[#0b4f8a] dark:data-active:text-white',
    },
    out: {
        icon: ArrowUpRightIcon,
        ink: 'text-gold-ink',
        active: 'data-active:from-brand-sun data-active:to-gold data-active:text-brand-navy dark:data-active:text-brand-navy',
    },
};

/**
 * The switch between payments in and payments out: two large buttons side
 * by side, each with its icon and how many items it lists.
 */
export default function PaymentSideTabs({ counts }) {
    const { t, formatNumber } = useTranslation();

    return (
        <TabsList
            aria-label={t('propertyPayments.tabs.label')}
            className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl bg-muted p-1.5 ring-1 ring-foreground/[0.06] ring-inset group-data-horizontal/tabs:h-auto sm:inline-grid sm:w-fit sm:grid-cols-[repeat(2,minmax(12.5rem,auto))]"
        >
            {Object.entries(SIDES).map(([side, { icon: Icon, ink, active }]) => (
                <TabsTrigger
                    key={side}
                    value={side}
                    className={cn(
                        'group/side h-12 gap-2.5 rounded-xl px-4 text-[0.9375rem] font-semibold text-foreground/75 hover:bg-background/70 hover:text-foreground sm:px-5 dark:text-muted-foreground',
                        'data-active:bg-linear-to-br data-active:shadow-md group-data-[variant=default]/tabs-list:data-active:shadow-(--raised-shadow) dark:data-active:border-transparent rtl:data-active:bg-linear-to-bl',
                        active,
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg bg-current/10 group-data-active/side:bg-white/25 group-data-active/side:text-current', ink)}
                    >
                        <Icon className="size-4" strokeWidth={2.5} />
                    </span>
                    {t(`propertyPayments.tabs.${side}`)}
                    <span className="rounded-full bg-foreground/[0.07] px-2 text-xs leading-5 font-semibold tabular-nums group-data-active/side:bg-white/25">
                        {formatNumber(counts[side])}
                    </span>
                </TabsTrigger>
            ))}
        </TabsList>
    );
}
