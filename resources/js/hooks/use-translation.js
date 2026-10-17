import { translations } from '@/lib/translations';
import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';

// Keep in sync with the inline script in resources/views/app.blade.php.
const STORAGE_KEY = 'estatecamp.locale';

export const LOCALES = {
    en: { name: 'English', dir: 'ltr', intl: 'en-AE' },
    ar: { name: 'العربية', dir: 'rtl', intl: 'ar-AE' },
};

const listeners = new Set();

let currentLocale = readStoredLocale();

function readStoredLocale() {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);

        return stored in LOCALES ? stored : 'en';
    } catch {
        return 'en';
    }
}

function subscribe(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/**
 * @param {keyof LOCALES} locale
 */
export function setLocale(locale) {
    currentLocale = locale;

    try {
        window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // Storage can be unavailable (private mode); the choice lasts for this visit.
    }

    listeners.forEach((listener) => listener());
}

// A key is a dotted string, or an array of parts when a part itself contains
// dots (such as a route name).
const lookup = (dictionary, key) =>
    (Array.isArray(key) ? key : key.split('.')).reduce(
        (node, part) => node?.[part],
        dictionary,
    );

// Day strings (`2026-11-16`) arrive without a time zone, so they are read as
// local midnight to avoid shifting to the previous day.
const parseDay = (day) => new Date(`${day}T00:00:00`);

function createTranslator(locale) {
    const { dir, intl } = LOCALES[locale];
    const pluralRules = new Intl.PluralRules(intl);
    const numberFormat = new Intl.NumberFormat(intl, { numberingSystem: 'latn' });
    const percentFormat = new Intl.NumberFormat(intl, {
        style: 'percent',
        maximumFractionDigits: 1,
        numberingSystem: 'latn',
    });
    const dateFormat = new Intl.DateTimeFormat(intl, {
        dateStyle: 'medium',
        numberingSystem: 'latn',
    });
    const longDateFormat = new Intl.DateTimeFormat(intl, {
        dateStyle: 'full',
        numberingSystem: 'latn',
    });

    /**
     * Translates a dotted key. `{name}` placeholders are filled from `params`
     * (numbers are formatted for the locale); an entry that is an object of
     * plural forms is chosen by `params.count`.
     */
    const t = (key, params = {}) => {
        let entry =
            lookup(translations[locale], key) ??
            lookup(translations.en, key) ??
            [key].flat().join('.');

        if (typeof entry === 'object') {
            entry = entry[pluralRules.select(params.count ?? 0)] ?? entry.other;
        }

        return entry.replace(/\{(\w+)\}/g, (placeholder, name) => {
            if (!(name in params)) {
                return placeholder;
            }

            return typeof params[name] === 'number'
                ? numberFormat.format(params[name])
                : params[name];
        });
    };

    return {
        locale,
        dir,
        isRtl: dir === 'rtl',
        t,
        /** Falls back to the stored name when a value has no translation. */
        tOr: (key, fallback) => lookup(translations[locale], key) ?? fallback,
        formatNumber: (value) => numberFormat.format(value),
        formatPercent: (value) => percentFormat.format(value / 100),
        formatCurrency: (value, currency) =>
            new Intl.NumberFormat(intl, {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
                numberingSystem: 'latn',
            }).format(value),
        /** Currency with fils, for invoices, payments and balances that must add up exactly. */
        formatMoney: (value, currency) =>
            new Intl.NumberFormat(intl, {
                style: 'currency',
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                numberingSystem: 'latn',
            }).format(value),
        formatDate: (day) => dateFormat.format(parseDay(day)),
        formatLongDate: (date) => longDateFormat.format(date),
    };
}

export function useTranslation() {
    const locale = useSyncExternalStore(subscribe, () => currentLocale);

    return useMemo(() => createTranslator(locale), [locale]);
}

/**
 * Sets `lang` and `dir` on <html> for the chosen language, and restores the
 * English defaults when the caller unmounts, so pages outside the app shell
 * are unaffected.
 */
export function useLocaleAttributes() {
    const { locale, dir } = useTranslation();

    useLayoutEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = dir;

        return () => {
            document.documentElement.lang = 'en';
            document.documentElement.dir = 'ltr';
        };
    }, [locale, dir]);
}
