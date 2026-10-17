import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';

function OptionalLabel({ id, label, optional }) {
    const { t } = useTranslation();

    return (
        <FieldLabel htmlFor={id}>
            {label}
            {optional && <span className="font-normal text-muted-foreground">({t('propertyForm.optional')})</span>}
        </FieldLabel>
    );
}

/**
 * A labelled dropdown. `items` are `{ value, label }` pairs.
 */
export function SelectField({ id, label, value, onChange, items, placeholder, error, description, optional, disabled, className }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <OptionalLabel id={id} label={label} optional={optional} />
            <Select items={items} value={value ?? null} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * An amount with the currency in front and an optional unit after, such as "per month".
 */
export function MoneyField({ id, label, value, onChange, currency, suffix, placeholder, error, description, optional, className }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <OptionalLabel id={id} label={label} optional={optional} />
            <InputGroup>
                <InputGroupAddon>
                    <InputGroupText>{currency}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    placeholder={placeholder}
                    className="tabular-nums"
                />
                {suffix && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupText>{suffix}</InputGroupText>
                    </InputGroupAddon>
                )}
            </InputGroup>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * A labelled multi-line text box.
 */
export function TextareaField({ id, label, value, onChange, error, description, optional, rows = 3, className }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <OptionalLabel id={id} label={label} optional={optional} />
            <Textarea id={id} rows={rows} value={value ?? ''} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * One choice from a short list, shown as a row of buttons. `options` are
 * `{ value, label, icon? }`.
 */
export function ChoiceField({ id, label, value, onChange, options, error, description, className }) {
    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <FieldLabel id={`${id}-label`}>{label}</FieldLabel>
            <ToggleGroup
                aria-labelledby={`${id}-label`}
                variant="outline"
                value={value === null || value === undefined ? [] : [String(value)]}
                onValueChange={([next]) => next !== undefined && onChange(next)}
                className="w-full flex-wrap"
            >
                {options.map((option) => (
                    <ToggleGroupItem
                        key={option.value}
                        value={String(option.value)}
                        className="aria-pressed:border-primary aria-pressed:bg-primary/5 aria-pressed:text-primary"
                    >
                        {option.icon && <option.icon data-icon="inline-start" />}
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * A labelled input bound to one form field, with its validation message.
 */
export function TextField({ id, label, value, onChange, error, description, optional, className, inputClassName, ...props }) {
    const { t } = useTranslation();

    return (
        <Field data-invalid={error ? true : undefined} className={className}>
            <FieldLabel htmlFor={id}>
                {label}
                {optional && (
                    <span className="font-normal text-muted-foreground">({t('propertyForm.optional')})</span>
                )}
            </FieldLabel>
            <Input
                id={id}
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={Boolean(error)}
                className={inputClassName}
                {...props}
            />
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * A titled card holding one group of form fields.
 */
export function FormSection({ title, description, action, children }) {
    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
                {action && <CardAction>{action}</CardAction>}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}
