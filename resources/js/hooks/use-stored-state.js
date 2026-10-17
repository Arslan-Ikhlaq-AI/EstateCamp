import { useEffect, useState } from 'react';

function readStored(key, initialValue, isValid) {
    try {
        const stored = window.localStorage.getItem(key);

        if (stored !== null) {
            const parsed = JSON.parse(stored);

            if (isValid(parsed)) {
                return parsed;
            }
        }
    } catch {
        // Storage can be unavailable (private mode) or hold stale data.
    }

    return typeof initialValue === 'function' ? initialValue() : initialValue;
}

/**
 * State that this browser remembers between visits, such as a preferred
 * layout. Falls back to `initialValue` (or its result, when a function) when
 * storage is unavailable or holds a value that `isValid` rejects.
 */
export function useStoredState(key, initialValue, isValid = () => true) {
    const [value, setValue] = useState(() => readStored(key, initialValue, isValid));

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // The choice still lasts for this visit.
        }
    }, [key, value]);

    return [value, setValue];
}
