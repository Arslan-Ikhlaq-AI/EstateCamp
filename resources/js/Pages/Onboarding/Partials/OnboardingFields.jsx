import InputIcon from '@/Components/InputIcon';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CircleCheckIcon } from 'lucide-react';

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
