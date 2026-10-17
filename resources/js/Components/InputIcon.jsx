import { InputGroupAddon } from '@/components/ui/input-group';

/**
 * A leading icon for an `InputGroup` that takes the brand colour while the
 * field has focus.
 */
export default function InputIcon({ icon: Icon }) {
    return (
        <InputGroupAddon className="pl-3.5 transition-colors group-focus-within/input-group:text-brand-cyan">
            <Icon />
        </InputGroupAddon>
    );
}
