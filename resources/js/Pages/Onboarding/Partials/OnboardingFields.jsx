import InputIcon from '@/Components/InputIcon';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, useComboboxAnchor } from '@/components/ui/combobox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { passwordStrength } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { CircleCheckIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, WandSparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

/**
 * A field's label, with "Optional" set quietly beside it.
 */
function Label({ id, label, optional }) {
    return (
        <FieldLabel htmlFor={id} className="text-[0.9rem] font-semibold">
            {label}
            {optional && <span className="text-xs font-medium text-muted-foreground">Optional</span>}
        </FieldLabel>
    );
}

/**
 * The hint under a field, replaced by its error once it has one.
 */
function Hint({ id, description, error }) {
    if (error) {
        return <FieldError id={`${id}-error`}>{error}</FieldError>;
    }

    return description ? <FieldDescription id={`${id}-hint`}>{description}</FieldDescription> : null;
}

const describedBy = (id, { description, error }) => (error ? `${id}-error` : description ? `${id}-hint` : undefined);

/**
 * A text input with a leading icon. Once the server has accepted its value,
 * `valid` shows a green tick at its end; `trailing` replaces the tick.
 */
export function IconField({ id, label, icon, value, onChange, error, description, optional, valid, trailing, className, groupClassName, ...props }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <Label id={id} label={label} optional={optional} />
            <InputGroup className={cn('h-11 bg-white', groupClassName)}>
                <InputGroupInput
                    id={id}
                    name={id}
                    className="placeholder:text-muted-foreground/55"
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy(id, { description, error })}
                    {...props}
                />
                {icon && <InputIcon icon={icon} />}
                {trailing ??
                    (valid && !error && (
                        <InputGroupAddon align="inline-end" className="pe-3">
                            <CircleCheckIcon className="text-success motion-safe:animate-in motion-safe:zoom-in-50" aria-hidden="true" />
                        </InputGroupAddon>
                    ))}
            </InputGroup>
            <Hint id={id} description={description} error={error} />
        </Field>
    );
}

const STRENGTHS = [
    { label: 'At least 8 characters', bar: 'bg-muted' },
    { label: 'Weak', bar: 'bg-destructive' },
    { label: 'Fair', bar: 'bg-warning' },
    { label: 'Good', bar: 'bg-brand-cyan' },
    { label: 'Strong', bar: 'bg-success' },
];

/**
 * Four bars and a word for how strong the password looks.
 */
function StrengthMeter({ value }) {
    const score = passwordStrength(value);
    const { label, bar } = STRENGTHS[score];

    return (
        <div className="flex items-center gap-3" aria-live="polite">
            <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((level) => (
                    <span key={level} className={cn('h-1.5 rounded-full transition-colors duration-300', level <= score ? bar : 'bg-muted')} />
                ))}
            </div>
            <span className={cn('min-w-24 text-end text-xs font-semibold', score === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                <span className="sr-only">Password strength: </span>
                {label}
            </span>
        </div>
    );
}

/**
 * A password input with show and hide, and a button that fills in a
 * generated password (and shows it, so it can be read or copied).
 */
export function PasswordField({ id, label, value, onChange, onBlur, error, description, optional, valid, placeholder, onGenerate, showStrength = false, autoComplete = 'new-password', className }) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <Label id={id} label={label} optional={optional} />
            <InputGroup className="h-11 bg-white">
                <InputGroupInput
                    id={id}
                    name={id}
                    type={isVisible ? 'text' : 'password'}
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    autoComplete={autoComplete}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy(id, { description, error })}
                    className={cn('placeholder:text-muted-foreground/55', isVisible && value && 'font-mono tracking-wide')}
                />
                <InputIcon icon={LockKeyholeIcon} />
                <InputGroupAddon align="inline-end" className="gap-1 pe-1.5">
                    {valid && !error && <CircleCheckIcon className="me-1 text-success motion-safe:animate-in motion-safe:zoom-in-50" aria-hidden="true" />}
                    {onGenerate && (
                        <InputGroupButton
                            size="xs"
                            className="font-semibold text-brand-ink"
                            onClick={() => {
                                onGenerate();
                                setIsVisible(true);
                            }}
                        >
                            <WandSparklesIcon /> Generate
                        </InputGroupButton>
                    )}
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={isVisible ? 'Hide password' : 'Show password'}
                        aria-pressed={isVisible}
                        aria-controls={id}
                        onClick={() => setIsVisible((visible) => !visible)}
                    >
                        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {showStrength && value && <StrengthMeter value={value} />}
            <Hint id={id} description={description} error={error} />
        </Field>
    );
}

/**
 * A dropdown with a leading icon. `items` are `{ value, label, hint? }`;
 * a hint is shown beside its label in the list.
 */
export function IconSelect({ id, label, icon: Icon, value, onChange, items, error, description, optional, placeholder, className }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <Label id={id} label={label} optional={optional} />
            <Select items={items} value={value || null} onValueChange={onChange}>
                <SelectTrigger
                    id={id}
                    className="h-11 w-full bg-white ps-3.5 data-[size=default]:h-11 group-focus-within/field:[&>svg:first-child]:text-brand-cyan"
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy(id, { description, error })}
                >
                    {Icon && <Icon className="text-muted-foreground transition-colors" aria-hidden="true" />}
                    <SelectValue placeholder={placeholder} className="ps-1" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                <span className="flex w-full items-baseline justify-between gap-4">
                                    <span>{item.label}</span>
                                    {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Hint id={id} description={description} error={error} />
        </Field>
    );
}

// Matches what was typed against an item's label, value, hint and other names, ignoring case.
const matchesQuery = (item, query) => [item.label, item.value, item.hint, item.keywords].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());

/**
 * A searchable list with a leading icon, for choices too long to scroll:
 * countries, currencies, time zones. `items` are `{ value, label, hint?,
 * keywords? }`; typing matches any of them.
 */
export function IconCombobox({ id, label, icon, value, onChange, items, error, description, optional, placeholder, emptyText = 'Nothing matches that search.', className }) {
    const selected = useMemo(() => items.find((item) => item.value === value) ?? null, [items, value]);
    // The list opens under the whole field, not under its chevron button.
    const anchor = useComboboxAnchor();

    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <Label id={id} label={label} optional={optional} />
            <Combobox
                items={items}
                value={selected}
                onValueChange={(item) => onChange(item?.value ?? '')}
                itemToStringLabel={(item) => item.label}
                isItemEqualToValue={(item, current) => item.value === current.value}
                filter={matchesQuery}
                autoHighlight
            >
                <div ref={anchor}>
                    <ComboboxInput
                        id={id}
                        placeholder={placeholder}
                        className="h-11 w-full bg-white"
                        inputClassName="placeholder:text-muted-foreground/55"
                        aria-invalid={Boolean(error)}
                        aria-describedby={describedBy(id, { description, error })}
                    >
                        {icon && <InputIcon icon={icon} />}
                    </ComboboxInput>
                </div>
                <ComboboxContent anchor={anchor}>
                    <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                    <ComboboxList>
                        {(item) => (
                            <ComboboxItem key={item.value} value={item}>
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {item.hint && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.hint}</span>}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            <Hint id={id} description={description} error={error} />
        </Field>
    );
}

/**
 * A titled group of fields within a step.
 */
export function FieldSection({ icon: Icon, title, description, children, className }) {
    return (
        <section className={cn('flex flex-col gap-5', className)}>
            <header className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-cyan/15 to-brand-navy/10 text-brand-ink ring-1 ring-brand-cyan/20">
                    <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <div className="flex flex-col">
                    <h2 className="text-[0.95rem] font-bold tracking-tight text-foreground">{title}</h2>
                    {description && <p className="text-[0.8125rem] text-muted-foreground">{description}</p>}
                </div>
            </header>
            {children}
        </section>
    );
}
