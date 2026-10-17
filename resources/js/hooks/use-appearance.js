import { useLayoutEffect, useSyncExternalStore } from 'react';

// Keep in sync with the inline script in resources/views/app.blade.php.
const STORAGE_KEY = 'estatecamp.appearance';
const APPEARANCES = ['light', 'dark', 'system'];

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

let currentAppearance = readStoredAppearance();

function readStoredAppearance() {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        return APPEARANCES.includes(stored) ? stored : 'system';
    } catch {
        return 'system';
    }
}

function subscribe(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/**
 * @param {'light' | 'dark' | 'system'} appearance
 */
export function setAppearance(appearance) {
    currentAppearance = appearance;

    try {
        window.localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
        // Storage can be unavailable (private mode); the choice lasts for this visit.
    }

    listeners.forEach((listener) => listener());
}

/**
 * @return {'light' | 'dark' | 'system'}
 */
export function useAppearance() {
    return useSyncExternalStore(subscribe, () => currentAppearance);
}

/**
 * Keeps the `dark` class on <html> in step with the saved appearance, and with
 * the OS setting while it is "system". The class is removed when the caller
 * unmounts, so pages outside the app shell (such as login) always render light.
 */
export function useAppearanceClass() {
    const appearance = useAppearance();

    useLayoutEffect(() => {
        const apply = () =>
            document.documentElement.classList.toggle(
                'dark',
                appearance === 'dark' ||
                    (appearance === 'system' && darkScheme.matches),
            );

        apply();
        darkScheme.addEventListener('change', apply);

        return () => {
            darkScheme.removeEventListener('change', apply);
            document.documentElement.classList.remove('dark');
        };
    }, [appearance]);
}
