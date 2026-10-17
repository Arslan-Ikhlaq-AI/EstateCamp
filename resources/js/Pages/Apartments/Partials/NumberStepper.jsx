import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { useTranslation } from '@/hooks/use-translation';
import { MinusIcon, PlusIcon } from 'lucide-react';

// Hides the browser's own number spinners; the steppers replace them.
const NUMBER_INPUT = 'text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * A whole-number input with − and + buttons.
 */
export default function NumberStepper({ id, label, value, onChange, min, max, error, description }) {
    const { t } = useTranslation();
    const number = Number(value) || 0;

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
                <InputGroupAddon>
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={t('apartmentForm.decrease', { field: label })}
                        disabled={number <= min}
                        onClick={() => onChange(Math.max(min, number - 1))}
                    >
                        <MinusIcon />
                    </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={Boolean(error)}
                    className={NUMBER_INPUT}
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        size="icon-xs"
                        aria-label={t('apartmentForm.increase', { field: label })}
                        disabled={number >= max}
                        onClick={() => onChange(Math.min(max, number + 1))}
                    >
                        <PlusIcon />
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
            {description && !error && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}
