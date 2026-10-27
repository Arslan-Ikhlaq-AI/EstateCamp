import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CheckIcon, CircleAlertIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The accents of choice cards and document slots: a soft icon tile, and
 * the gradient badge once chosen or uploaded.
 */
export const TONES = {
    brand: { tile: 'bg-brand-cyan/12 text-brand-ink', badge: 'from-brand-cyan to-brand-navy text-white' },
    green: { tile: 'bg-success/12 text-success', badge: 'from-success/70 to-success text-white' },
    gold: { tile: 'bg-gold/20 text-gold-ink', badge: 'from-brand-sun to-gold text-brand-navy' },
    navy: { tile: 'bg-primary/10 text-primary dark:bg-primary/15', badge: 'from-chart-1 to-brand-navy text-white dark:to-[#0b4f8a]' },
    orange: { tile: 'bg-warning/12 text-warning', badge: 'from-warning/70 to-warning text-white' },
};

/**
 * A step's marker: its number (filled while the step is in view, gold once
 * something is entered), a tick on brand colour once done, or a warning
 * when it has errors.
 */
function StepDot({ index, state, isCurrent }) {
    const { formatNumber } = useTranslation();

    return (
        <span
            className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums transition-colors',
                state === 'error' && 'bg-destructive/10 text-destructive',
                state === 'done' && cn('bg-linear-to-br shadow-sm', TONES.brand.badge),
                state === 'started' && cn('ring-1 ring-gold/60 ring-inset', TONES.gold.tile),
                state === 'todo' && (isCurrent ? 'bg-primary text-primary-foreground' : 'text-muted-foreground ring-1 ring-border ring-inset'),
            )}
        >
            {state === 'error' ? (
                <CircleAlertIcon className="size-3.5" />
            ) : state === 'done' ? (
                <CheckIcon className="size-3.5" strokeWidth={3} />
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
 * One step of the form as a card: its icon, title and description, which
 * step it is, where it stands, and an optional action (such as "Add").
 */
export function StepSection({ step, index, total, state, action, children }) {
    const { t, formatNumber } = useTranslation();

    return (
        <Card id={`step-${step.key}`} className="scroll-mt-24 gap-0 overflow-hidden py-0 lg:scroll-mt-40">
            <div className="flex flex-wrap items-center gap-3.5 border-b px-5 py-4 lg:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-ink">
                    <step.icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="font-heading text-base font-bold tracking-tight">
                        {t(`propertyForm.steps.${step.key}.title`)}
                        <span className="ms-2 text-xs font-medium text-muted-foreground tabular-nums">
                            {t('propertyForm.steps.stepOf', { number: formatNumber(index + 1), total: formatNumber(total) })}
                        </span>
                    </h2>
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
 * The steps as a plain bar across the top of the form: each step's number
 * and title, the one in view on a soft pill, steps with something entered
 * on a gold dot, done steps ticked in brand colour and joined by a cyan
 * line, with how many required steps are done at the end. Each step jumps
 * to its section.
 */
export function StepBar({ steps, states, current }) {
    const { t } = useTranslation();
    const required = steps.filter((step) => !step.optional);
    const done = required.filter((step) => states[step.key] === 'done').length;
    const isReady = done === required.length;

    return (
        <nav
            aria-label={t('propertyForm.steps.title')}
            className="relative z-[5] rounded-xl bg-surface shadow-(--card-shadow) ring-1 ring-foreground/[0.07] lg:sticky lg:top-[4.75rem]"
        >
            <div className="flex items-center gap-3 p-1.5">
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
                                        'flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                                        isCurrent ? 'bg-muted font-semibold text-foreground' : 'font-medium text-muted-foreground',
                                        state === 'started' && 'text-foreground',
                                        state === 'done' && 'text-brand-ink',
                                        state === 'error' && 'text-destructive',
                                    )}
                                >
                                    <StepDot index={index} state={state} isCurrent={isCurrent} />
                                    {t(`propertyForm.steps.${step.key}.title`)}
                                </a>
                                {index < steps.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className={cn('mx-1 h-0.5 min-w-3 flex-1 rounded-full transition-colors', state === 'done' ? 'bg-brand-cyan' : 'bg-border')}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ol>
                <span className="hidden shrink-0 items-center gap-1.5 pe-2.5 text-xs font-medium text-muted-foreground 2xl:flex">
                    {isReady && <CheckIcon className="size-3.5 text-success" strokeWidth={3} />}
                    {isReady ? t('propertyForm.steps.ready') : t('propertyForm.steps.progress', { done, total: required.length })}
                </span>
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
