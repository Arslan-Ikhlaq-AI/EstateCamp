import { Building2Icon, RocketIcon, SparklesIcon, UsersRoundIcon } from 'lucide-react';

/**
 * The sign-up steps in order. `fields` are the server fields each step is
 * validated on (through Precognition) before the next one opens. `files`
 * are checked in the browser instead, so a logo is not uploaded with every
 * check; the server checks them again on launch.
 */
export const STEPS = [
    {
        key: 'company',
        label: 'Company',
        icon: Building2Icon,
        summary: 'Who you are and how to reach you',
        title: 'Tell us about your',
        highlight: 'company.',
        description: 'These details appear on your invoices, receipts and contracts. You can change them any time in Configuration.',
        fields: ['name', 'legal_name', 'trade_license_number', 'expiry_date', 'tax_registration_number', 'email', 'phone', 'website', 'country_code', 'city', 'address_line_1'],
        files: ['logo'],
    },
    {
        key: 'workspace',
        label: 'Workspace',
        icon: SparklesIcon,
        summary: 'Your address, currency and time zone',
        title: 'Shape your',
        highlight: 'workspace.',
        description: 'Pick the address your team signs in at and the regional settings every amount and date will follow.',
        fields: ['business_type', 'slug', 'default_currency', 'timezone'],
    },
    {
        key: 'team',
        label: 'Team',
        icon: UsersRoundIcon,
        summary: 'Your super admin and teammates',
        title: 'Bring in your',
        highlight: 'team.',
        description: 'Start with the super admin and their password, then add the people who will work alongside you. Everyone gets their sign-in by email.',
        fields: ['admin_name', 'admin_email', 'admin_phone', 'admin_password', 'admin_password_confirmation', 'team', 'team.*.name', 'team.*.email', 'team.*.role', 'team.*.password'],
    },
    {
        key: 'review',
        label: 'Launch',
        icon: RocketIcon,
        summary: 'Check everything and go live',
        title: 'Ready for',
        highlight: 'launch.',
        description: 'Check the details below. Once you launch, your workspace is created and everyone receives their sign-in.',
        fields: ['terms', 'terms_version'],
    },
];

/**
 * Other names people search a country by, beside the one the browser gives it.
 */
export const COUNTRY_KEYWORDS = {
    AE: 'UAE Emirates',
    GB: 'UK Britain England Scotland Wales Northern Ireland',
    US: 'USA America',
    KR: 'South Korea',
    KP: 'North Korea',
    CZ: 'Czech Republic',
    NL: 'Holland',
    CI: 'Ivory Coast',
    MM: 'Burma',
    TR: 'Turkey',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const countryName = (code) => (code ? regionNames.of(code) : '');

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export const currencyName = (code) => (code ? currencyNames.of(code) : '');

export const timezoneLabel = (zone) => zone.replaceAll('_', ' ');

const zoneDetailsCache = new Map();

/**
 * A time zone's offset from GMT and its time now, such as "GMT+4 · 14:05".
 */
export function zoneDetails(zone) {
    if (!zoneDetailsCache.has(zone)) {
        try {
            const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).formatToParts(new Date());
            const part = (type) => parts.find((item) => item.type === type)?.value ?? '';

            zoneDetailsCache.set(zone, `${part('timeZoneName')} · ${part('hour')}:${part('minute')}`);
        } catch {
            zoneDetailsCache.set(zone, '');
        }
    }

    return zoneDetailsCache.get(zone);
}

/**
 * The visitor's own time zone, as their browser reports it.
 */
export function browserTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
        return '';
    }
}

// Legal endings that make a workspace address long without telling teams apart.
const LEGAL_SUFFIXES = /\b(l\.?\s?l\.?\s?c|llc|fze|fzco|fz-llc|ltd|limited|inc|est|establishment|co|company|group|holding|holdings)\b\.?/gi;

/**
 * A workspace address made of lower-case letters, digits and single hyphens.
 */
export function slugify(value, { trim = true } = {}) {
    const slug = value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 40);

    return trim ? slug.replace(/-+$/, '') : slug;
}

/**
 * The workspace address suggested for a company name, without its legal ending.
 */
export const suggestSlug = (name) => slugify(name.replace(LEGAL_SUFFIXES, ' ')) || slugify(name);

// The logo the server accepts (see CompanyOnboardingRequest); SVG is left out on purpose.
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 2048 * 1024;
const LOGO_MIN_PIXELS = 64;

/**
 * Checks a chosen logo against the server's rules and reads its size, so a
 * wrong file is turned away the moment it is picked.
 *
 * @return {Promise<{error?: string, width?: number, height?: number}>}
 */
export async function readLogo(file) {
    if (!LOGO_TYPES.includes(file.type)) {
        return { error: 'Upload the logo as a PNG, JPG or WEBP image.' };
    }

    if (file.size > LOGO_MAX_BYTES) {
        return { error: 'The logo must be 2 MB or smaller.' };
    }

    try {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        bitmap.close();

        return width < LOGO_MIN_PIXELS || height < LOGO_MIN_PIXELS ? { error: 'The logo must be at least 64 × 64 pixels.' } : { width, height };
    } catch {
        return { error: 'This image could not be read. Try another file.' };
    }
}

export const formatFileSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

// Letters and digits that cannot be mistaken for one another when read from an email.
const PASSWORD_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * A random password from the browser's secure random source.
 */
export function generatePassword(length = 14) {
    return Array.from(crypto.getRandomValues(new Uint32Array(length)), (value) => PASSWORD_CHARACTERS[value % PASSWORD_CHARACTERS.length]).join('');
}

/**
 * How strong a password looks, from 0 (shorter than the 8 characters the
 * server requires) to 4. Only a hint: the server decides what is accepted.
 */
export function passwordStrength(value) {
    if (value.length < 8) {
        return 0;
    }

    const extras = [value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z\d]/.test(value)].filter(Boolean).length;

    return Math.min(4, 1 + extras);
}

/**
 * The form field's element id: dots in nested names become hyphens.
 */
export const fieldId = (name) => name.replaceAll('.', '-');

/**
 * Focuses the first invalid control among `errors`, in the order the fields
 * are shown, and brings its field to the middle of the screen. Some controls
 * (checkboxes, selects) keep their id on a hidden input, so focusing alone
 * would not scroll to them.
 */
export function focusFirstError(errors) {
    const [first] = Object.keys(errors);
    const control = first && document.getElementById(fieldId(first));

    if (!control) {
        return;
    }

    control.focus({ preventScroll: true });
    (control.closest('[data-slot=field]') ?? control).scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
}

/**
 * The first step with an error, so a failed launch opens where it needs fixing.
 */
export function stepWithError(errors) {
    // `team.2.email` belongs to the step that has `team`.
    const roots = Object.keys(errors).map((name) => name.split('.')[0]);
    const index = STEPS.findIndex((step) => [...step.fields, ...(step.files ?? [])].some((field) => roots.includes(field)));

    return index === -1 ? STEPS.length - 1 : index;
}
