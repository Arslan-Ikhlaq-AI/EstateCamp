import { Building2Icon, RocketIcon, SparklesIcon, UsersRoundIcon } from 'lucide-react';

/**
 * The sign-up steps in order. `fields` are the server fields each step is
 * validated on (through Precognition) before the next one opens.
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
        description: 'Start with the super admin, then add the people who will work alongside you. Everyone gets their own sign-in by email.',
        fields: ['admin_name', 'admin_email', 'admin_phone', 'team', 'team.*.name', 'team.*.email', 'team.*.role'],
    },
    {
        key: 'review',
        label: 'Launch',
        icon: RocketIcon,
        summary: 'Check everything and go live',
        title: 'Ready for',
        highlight: 'launch.',
        description: 'Check the details below. Once you launch, your workspace is created and everyone receives their sign-in.',
        fields: ['terms'],
    },
];

/**
 * Countries offered at sign-up, each with the currency and time zone it
 * suggests. Names come from the browser, so they never need translating.
 */
export const COUNTRIES = [
    { code: 'AE', currency: 'AED', timezone: 'Asia/Dubai' },
    { code: 'SA', currency: 'SAR', timezone: 'Asia/Riyadh' },
    { code: 'QA', currency: 'QAR', timezone: 'Asia/Qatar' },
    { code: 'OM', currency: 'OMR', timezone: 'Asia/Muscat' },
    { code: 'BH', currency: 'BHD', timezone: 'Asia/Bahrain' },
    { code: 'KW', currency: 'KWD', timezone: 'Asia/Kuwait' },
    { code: 'PK', currency: 'PKR', timezone: 'Asia/Karachi' },
    { code: 'IN', currency: 'INR', timezone: 'Asia/Kolkata' },
    { code: 'GB', currency: 'GBP', timezone: 'Europe/London' },
];

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const countryName = (code) => (code ? regionNames.of(code) : '');

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export const currencyName = (code) => (code ? currencyNames.of(code) : '');

export const timezoneLabel = (zone) => zone.replaceAll('_', ' ');

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
    const index = STEPS.findIndex((step) => step.fields.some((field) => roots.includes(field)));

    return index === -1 ? STEPS.length - 1 : index;
}
