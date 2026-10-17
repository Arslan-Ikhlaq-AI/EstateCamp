import InputIcon from '@/Components/InputIcon';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';

export default function PasswordInput({
    id,
    icon,
    toggleLabel = 'Show password',
    groupClassName,
    ...props
}) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <InputGroup className={groupClassName}>
            <InputGroupInput
                id={id}
                type={isVisible ? 'text' : 'password'}
                {...props}
            />

            {icon && <InputIcon icon={icon} />}

            <InputGroupAddon align="inline-end">
                <InputGroupButton
                    size="icon-xs"
                    aria-label={toggleLabel}
                    aria-pressed={isVisible}
                    aria-controls={id}
                    onClick={() => setIsVisible((previous) => !previous)}
                >
                    {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
            </InputGroupAddon>
        </InputGroup>
    );
}
