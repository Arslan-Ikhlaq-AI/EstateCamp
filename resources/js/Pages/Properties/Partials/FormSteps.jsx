import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Each step's accent: the icon tile, the gradient badge, and the wash
 * behind its section header.
 */
export const TONES = {
    brand: { tile: 'bg-brand-cyan/12 text-brand-ink', badge: 'from-brand-cyan to-brand-navy text-white', wash: 'from-brand-cyan/[0.08]' },
    green: { tile: 'bg-success/12 text-success', badge: 'from-success/70 to-success text-white', wash: 'from-success/[0.07]' },
    gold: { tile: 'bg-gold/20 text-gold-ink', badge: 'from-brand-sun to-gold text-brand-navy', wash: 'from-gold/[0.12]' },
    navy: { tile: 'bg-primary/10 text-primary dark:bg-primary/15', badge: 'from-chart-1 to-brand-navy text-white dark:to-[#0b4f8a]', wash: 'from-primary/[0.06] dark:from-primary/25' },
    orange: { tile: 'bg-warning/12 text-warning', badge: 'from-warning/70 to-warning text-white', wash: 'from-warning/[0.07]' },
};

/**
 * A step's marker on the navy bar: its number, a tick once done, a warning
 * when it has errors, and a glow while it is in view.
 */
function StepDot({ index, state, isCurrent }) {
    const { formatNumber } = useTranslation();

    return (
        <span
            className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-all duration-300',
                state === 'error' && 'bg-destructive text-white',
                state === 'done' && 'bg-linear-to-br from-brand-cyan to-chart-1 text-white shadow-[0_0_0_3px_rgb(28_181_224/0.25)]',
                state === 'todo' && (isCurrent ? 'bg-white text-primary shadow-[0_0_0_4px_rgb(28_181_224/0.35)]' : 'bg-white/10 text-white/75 inset-ring inset-ring-white/20'),
            )}
        >
            {state === 'error' ? (
                <CircleAlertIcon className="size-4" />
            ) : state === 'done' ? (
                <CheckIcon className="size-4" strokeWidth={3} />
            ) : (
                formatNumber(index + 1)
            )}
        </span>
    );
}

function StateChip({ state, isOptional }) {
    const { t } = useTranslation();

    if (state === 'error') {
        return (
            <Badge variant="destructive">
                <CircleAlertIcon data-icon="inline-start" />
                {t('propertyForm.steps.fix')}
            </Badge>
        );
    }

    if (state === 'done') {
        return (
            <Badge variant="success">
                <CheckIcon data-icon="inline-start" />
                {t('propertyForm.steps.done')}
            </Badge>
        );
    }

    return <Badge variant="secondary">{t(isOptional ? 'propertyForm.steps.optional' : 'propertyForm.steps.required')}</Badge>;
}

/**
 * One step of the form as a card: numbered badge, accent icon, title and
 * description, where it stands, and an optional action (such as "Add").
 */
export function StepSection({ step, index, total, state, action, children }) {
    const { t, formatNumber } = useTranslation();
    const tone = TONES[step.tone];

    return (
        <Card id={`step-${step.key}`} className="scroll-mt-24 gap-0 overflow-hidden py-0 lg:scroll-mt-40">
            <div className={cn('relative flex flex-wrap items-center gap-4 border-b bg-linear-to-r to-transparent px-5 py-4 rtl:bg-linear-to-l lg:px-6', tone.wash)}>
                <span aria-hidden="true" className={cn('absolute inset-y-0 start-0 w-1 bg-linear-to-b', tone.badge)} />
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-md shadow-black/10', tone.badge)}>
                    <step.icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
                        {t('propertyForm.steps.stepOf', { number: formatNumber(index + 1), total: formatNumber(total) })}
                    </span>
                    <h2 className="font-heading text-base font-bold tracking-tight">{t(`propertyForm.steps.${step.key}.title`)}</h2>
                    <p className="text-[0.8125rem] text-muted-foreground">{t(`propertyForm.steps.${step.key}.description`)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <StateChip state={state} isOptional={step.optional} />
                    {action}
                </div>
            </div>
            <CardContent className="py-5 lg:py-6">{children}</CardContent>
        </Card>
    );
}

/**
 * The step that is in view, so the navigator can mark it.
 */
export function useCurrentStep(keys) {
    const [current, setCurrent] = useState(keys[0]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

                if (visible[0]) {
                    setCurrent(visible[0].target.id.replace('step-', ''));
                }
            },
            { rootMargin: '-160px 0px -50% 0px' },
        );

        keys.forEach((key) => {
            const element = document.getElementById(`step-${key}`);

            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [keys.join()]);

    return current;
}

const jumpTo = (key) => (event) => {
    event.preventDefault();
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
};

/**
 * The steps as a navy bar across the top of the form: each step with where
 * it stands, the one in view lit, joined by lines that fill as steps are
 * done, with the share of required steps complete along the bottom edge.
 * Each step jumps to its section.
 */
export function StepBar({ steps, states, current }) {
    const { t, formatNumber } = useTranslation();
    const required = steps.filter((step) => !step.optional);
    const done = required.filter((step) => states[step.key] === 'done').length;
    const percent = required.length > 0 ? Math.round((done / required.length) * 100) : 100;
    const isReady = done === required.length;

    return (
        <nav
            aria-label={t('propertyForm.steps.title')}
            className="relative z-[5] overflow-hidden rounded-2xl bg-primary bg-(image:--sidebar-image) text-white shadow-(--overlay-shadow) ring-1 ring-white/10 lg:sticky lg:top-[4.75rem]"
        >
            <span aria-hidden="true" className="pointer-events-none absolute -end-10 -top-24 size-56 rounded-full bg-gold/15 blur-3xl" />
            <div className="relative flex items-center gap-3 px-2 py-2.5 lg:px-3">
                <ol className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none]">
                    {steps.map((step, index) => {
                        const state = states[step.key];
                        const isCurrent = current === step.key;

                        return (
                            <li key={step.key} className="flex flex-1 items-center last:flex-none">
                                <a
                                    href={`#step-${step.key}`}
                                    onClick={jumpTo(step.key)}
                                    aria-current={isCurrent ? 'step' : undefined}
                                    className={cn(
                                        'flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-1.5 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-brand-cyan',
                                        isCurrent && 'bg-white/[0.12] inset-ring inset-ring-white/15',
                                    )}
                                >
                                    <StepDot index={index} state={state} isCurrent={isCurrent} />
                                    <span className="flex flex-col leading-tight">
                                        <span className={cn('text-[0.8125rem] whitespace-nowrap', isCurrent ? 'font-bold text-white' : 'font-medium text-white/85')}>
                                            {t(`propertyForm.steps.${step.key}.title`)}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[0.6875rem] whitespace-nowrap',
                                                state === 'error' ? 'text-red-300' : state === 'done' ? 'text-brand-cyan' : 'text-white/55',
                                            )}
                                        >
                                            {state === 'error'
                                                ? t('propertyForm.steps.fix')
                                                : state === 'done'
                                                  ? t('propertyForm.steps.done')
                                                  : t(step.optional ? 'propertyForm.steps.optional' : 'propertyForm.steps.required')}
                                        </span>
                                    </span>
                                </a>
                                {index < steps.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'mx-1.5 h-0.5 min-w-4 flex-1 rounded-full transition-colors',
                                            state === 'done' ? 'bg-linear-to-r from-brand-cyan to-gold rtl:bg-linear-to-l' : 'bg-white/15',
                                        )}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>
                <span
                    className={cn(
                        'hidden shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold 2xl:flex',
                        isReady ? 'bg-gold text-brand-navy' : 'bg-white/10 text-white inset-ring inset-ring-white/15',
                    )}
                >
                    {isReady ? <CheckIcon className="size-3.5" strokeWidth={3} /> : <span className="tabular-nums">{formatNumber(percent)}%</span>}
                    {isReady ? t('propertyForm.steps.ready') : t('propertyForm.steps.progress', { done, total: required.length })}
                </span>
            </div>
            <div
                role="progressbar"
                aria-label={t('propertyForm.steps.progress', { done, total: required.length })}
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1 bg-white/10"
            >
                <div className="h-full bg-linear-to-r from-brand-cyan via-chart-5 to-gold transition-[width] duration-500 rtl:bg-linear-to-l" style={{ width: `${percent}%` }} />
            </div>
        </nav>
    );
}

/**
 * One choice from a few, as cards with an icon, a title and a line of
 * description. Built on radio inputs, so arrow keys move the choice.
 * `options` are `{ value, title, description?, icon, tone? }`.
 */
export function ChoiceCards({ name, label, value, onChange, options, error, columns = 2, compact = false }) {
    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel id={`${name}-label`}>{label}</FieldLabel>
            <div
                role="radiogroup"
                aria-labelledby={`${name}-label`}
                className={cn('grid gap-3', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}
            >
                {options.map((option) => {
                    const isSelected = String(value) === String(option.value);
                    const tone = TONES[option.tone ?? 'brand'];

                    return (
                        <label
                            key={option.value}
                            className={cn(
                                'group/choice relative flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-foreground/10 transition-[box-shadow,background-color,translate] duration-150 hover:-translate-y-px hover:shadow-(--raised-shadow) motion-reduce:hover:translate-y-0',
                                'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                                isSelected && 'bg-accent ring-2 ring-brand-cyan shadow-(--raised-shadow)',
                                compact && 'items-center p-3',
                            )}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={isSelected}
                                onChange={() => onChange(option.value)}
                                className="sr-only"
                            />
                            <span className={cn('flex shrink-0 items-center justify-center rounded-lg transition-colors', compact ? 'size-8' : 'size-10', isSelected ? cn('bg-linear-to-br', tone.badge) : tone.tile)}>
                                <option.icon className={compact ? 'size-4' : 'size-5'} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-sm font-semibold">{option.title}</span>
                                {option.description && <span className="text-xs leading-snug text-muted-foreground">{option.description}</span>}
                            </span>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'absolute end-2.5 top-2.5 flex size-5 items-center justify-center rounded-full transition-all',
                                    isSelected ? 'scale-100 bg-brand-cyan text-white' : 'scale-0',
                                )}
                            >
                                <CheckIcon className="size-3" strokeWidth={3} />
                            </span>
                        </label>
                    );
                })}
            </div>
            <FieldError>{error}</FieldError>
        </Field>
    );
}
