import { TextField } from '@/Components/FormFields';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Building2Icon, LayersIcon } from 'lucide-react';

/**
 * How many floors and units the building has, and a meter of the units
 * planned against that number: those already saved plus those about to be
 * added (`saved` and `adding`).
 */
export default function BuildingSize({ floors, units, onChange, errors, saved, adding }) {
    const { t, formatNumber } = useTranslation();
    const total = Number(units) || 0;
    const used = saved + adding;
    const isCapped = total > 0;
    const isOver = isCapped && used > total;
    const percent = isCapped ? Math.min((used / total) * 100, 100) : 0;

    return (
        <section className="flex flex-col gap-4 rounded-xl bg-linear-to-br from-primary/[0.035] to-brand-cyan/[0.06] p-4 ring-1 ring-foreground/[0.08] dark:from-primary/20">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-ink shadow-sm ring-1 ring-foreground/[0.06]">
                    <Building2Icon className="size-4.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-bold">{t('propertyForm.size.title')}</h3>
                    <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.size.description')}</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                    id="total_floors"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    label={t('propertyForm.size.floors')}
                    value={floors}
                    onChange={(value) => onChange('total_floors', value)}
                    error={errors.total_floors}
                    inputClassName="bg-surface"
                    optional
                />
                <TextField
                    id="total_units"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    label={t('propertyForm.size.units')}
                    value={units}
                    onChange={(value) => onChange('total_units', value)}
                    error={errors.total_units}
                    inputClassName="bg-surface"
                    optional
                />
            </div>

            <div aria-live="polite" className="flex flex-col gap-2 rounded-lg bg-surface p-3 ring-1 ring-foreground/[0.06]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                        <LayersIcon className="size-4 text-brand-ink" />
                        {isCapped
                            ? t('propertyForm.size.planned', { used: formatNumber(used), total: formatNumber(total) })
                            : t('propertyForm.size.uncapped', { count: used })}
                    </span>
                    {isCapped && (
                        <span className={cn('text-xs font-semibold', isOver ? 'text-destructive' : 'text-success')}>
                            {isOver ? t('propertyForm.size.over', { count: used - total }) : t('propertyForm.size.left', { count: total - used })}
                        </span>
                    )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            'h-full rounded-full transition-[width] duration-300 rtl:bg-linear-to-l',
                            isOver ? 'bg-destructive' : 'bg-linear-to-r from-brand-cyan to-gold',
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <span className="text-xs text-muted-foreground">
                    {saved > 0 && <>{t('propertyForm.size.saved', { count: formatNumber(saved) })} · </>}
                    {t('propertyForm.size.adding', { count: formatNumber(adding) })}
                </span>
            </div>
        </section>
    );
}
