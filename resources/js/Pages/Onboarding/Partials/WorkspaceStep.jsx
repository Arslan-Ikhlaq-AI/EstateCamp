import InputIcon from '@/Components/InputIcon';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { countryName, currencyName, timezoneLabel, zoneDetails } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import {
    Building2Icon,
    CircleCheckIcon,
    CircleXIcon,
    Clock3Icon,
    CoinsIcon,
    KeyRoundIcon,
    LandmarkIcon,
    LayersIcon,
    LinkIcon,
    SlidersHorizontalIcon,
    TentIcon,
    WrenchIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { FieldSection, IconCombobox } from './OnboardingFields';

const BUSINESS_DETAILS = {
    staff_accommodation: { icon: TentIcon, description: 'Labour camps, staff housing and bed spaces.' },
    property_management: { icon: Building2Icon, description: 'Residential and commercial buildings for owners.' },
    facilities_management: { icon: WrenchIcon, description: 'Maintenance, AMCs and building services.' },
    real_estate: { icon: KeyRoundIcon, description: 'Leasing, brokerage and tenant contracts.' },
    owner_landlord: { icon: LandmarkIcon, description: 'Your own portfolio of buildings and units.' },
};

/**
 * What the company does, as one card per kind of business.
 */
function BusinessTypePicker({ types, value, onChange, error }) {
    return (
        <Field data-invalid={error ? true : undefined}>
            <div role="radiogroup" aria-labelledby="business_type-label" aria-describedby={error ? 'business_type-error' : undefined} className="grid gap-3 sm:grid-cols-2">
                <span id="business_type-label" className="sr-only">
                    What does your company do?
                </span>
                {types.map((type, index) => {
                    const { icon: Icon, description } = BUSINESS_DETAILS[type.value] ?? { icon: LayersIcon };
                    const isChecked = value === type.value;

                    return (
                        <label
                            key={type.value}
                            className={cn(
                                'group/type relative flex cursor-pointer items-start gap-3.5 rounded-2xl border bg-white p-4 shadow-xs transition-[border-color,background-color,box-shadow,translate] duration-200',
                                'hover:-translate-y-px hover:border-brand-cyan/50 hover:shadow-(--card-shadow)',
                                'has-checked:border-brand-cyan has-checked:bg-brand-cyan/[0.045] has-checked:ring-3 has-checked:ring-brand-cyan/15',
                                'has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                                error && 'border-destructive/50',
                                index === types.length - 1 && types.length % 2 === 1 && 'sm:col-span-2',
                            )}
                        >
                            <input
                                type="radio"
                                id={index === 0 ? 'business_type' : undefined}
                                name="business_type"
                                value={type.value}
                                checked={isChecked}
                                onChange={() => onChange(type.value)}
                                className="sr-only"
                            />
                            <span
                                className={cn(
                                    'flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-brand-ink ring-1 ring-border transition-all duration-300',
                                    'group-has-checked/type:bg-linear-to-br group-has-checked/type:from-brand-cyan group-has-checked/type:to-brand-navy group-has-checked/type:text-white group-has-checked/type:shadow-md group-has-checked/type:shadow-brand-cyan/25 group-has-checked/type:ring-transparent',
                                )}
                            >
                                <Icon className="size-5" aria-hidden="true" />
                            </span>
                            <span className="flex flex-col gap-0.5 pe-6">
                                <span className="text-[0.95rem] font-bold tracking-tight text-foreground">{type.label}</span>
                                <span className="text-[0.8125rem] leading-snug text-muted-foreground">{description}</span>
                            </span>
                            <CircleCheckIcon
                                aria-hidden="true"
                                className="absolute end-3.5 top-3.5 size-5 scale-50 fill-brand-cyan text-white opacity-0 transition-all duration-300 group-has-checked/type:scale-100 group-has-checked/type:opacity-100"
                            />
                        </label>
                    );
                })}
            </div>
            {error && <FieldError id="business_type-error">{error}</FieldError>}
        </Field>
    );
}

/**
 * The workspace address, checked with the server as it is typed.
 */
function WorkspaceAddress({ host, slug, onChange, error, isChecking, isAvailable }) {
    const status = !slug ? null : isChecking ? 'checking' : error ? 'taken' : isAvailable ? 'available' : null;

    return (
        <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="slug" className="text-[0.9rem] font-semibold">
                Workspace address
            </FieldLabel>
            <InputGroup className="h-12 bg-white">
                <InputGroupInput
                    id="slug"
                    name="slug"
                    value={slug}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={40}
                    placeholder="your-company"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'slug-error' : 'slug-hint'}
                    className="ps-0 font-semibold text-brand-navy"
                />
                <InputIcon icon={LinkIcon} />
                <InputGroupAddon className="gap-0 ps-1.5">
                    <InputGroupText className="hidden max-w-[14rem] truncate font-medium text-muted-foreground sm:block">{host}/</InputGroupText>
                </InputGroupAddon>
                <InputGroupAddon align="inline-end" className="pe-3" aria-live="polite">
                    {status === 'checking' && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Spinner className="size-3.5" /> Checking
                        </span>
                    )}
                    {status === 'available' && (
                        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95">
                            <CircleCheckIcon className="size-3.5" /> Available
                        </span>
                    )}
                    {status === 'taken' && (
                        <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
                            <CircleXIcon className="size-3.5" /> Unavailable
                        </span>
                    )}
                </InputGroupAddon>
            </InputGroup>
            {error ? (
                <FieldError id="slug-error">{error}</FieldError>
            ) : (
                <FieldDescription id="slug-hint">
                    Your team signs in at <span className="font-semibold text-foreground">{host}/{slug || 'your-company'}</span>. Letters, numbers and hyphens.
                </FieldDescription>
            )}
        </Field>
    );
}

/**
 * Step 2: the kind of business, the workspace address and the regional settings.
 */
export default function WorkspaceStep({ form, bind, businessTypes, countries, currencies, timezones, host, onSlugChange }) {
    const country = countries.find(({ code }) => code === form.data.country_code);
    const countryLabel = country ? countryName(country.code) : null;

    // The country's own currency and time zones come first; everything else follows.
    const currencyItems = useMemo(
        () =>
            [...new Set([country?.currency, ...currencies].filter(Boolean))].map((code) => ({
                value: code,
                label: code,
                hint: currencyName(code),
            })),
        [country, currencies],
    );
    const timezoneItems = useMemo(
        () => [...new Set([...(country?.timezones ?? []), ...timezones])].map((zone) => ({ value: zone, label: timezoneLabel(zone), hint: zoneDetails(zone) })),
        [country, timezones],
    );

    return (
        <div className="flex flex-col gap-10">
            <FieldSection icon={LayersIcon} title="What does your company do?" description="Saved to your company profile.">
                <BusinessTypePicker types={businessTypes} value={form.data.business_type} onChange={(value) => bind('business_type').onChange(value)} error={form.errors.business_type} />
            </FieldSection>

            <FieldSection icon={LinkIcon} title="Your workspace address" description="A link of your own for your team to sign in.">
                <WorkspaceAddress
                    host={host}
                    slug={form.data.slug}
                    onChange={onSlugChange}
                    error={form.errors.slug}
                    isChecking={form.validating && form.touched('slug')}
                    isAvailable={form.valid('slug')}
                />
            </FieldSection>

            <FieldSection icon={SlidersHorizontalIcon} title="Regional settings" description="Every amount and date in your workspace follows these.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <IconCombobox
                        {...bind('default_currency')}
                        label="Currency"
                        icon={CoinsIcon}
                        items={currencyItems}
                        placeholder="Search by code or name"
                        emptyText="No currency matches that search."
                        description={country?.currency && country.currency === form.data.default_currency ? `The currency of ${countryLabel}.` : 'Used for rents, invoices and payroll.'}
                    />
                    <IconCombobox
                        {...bind('timezone')}
                        label="Time zone"
                        icon={Clock3Icon}
                        items={timezoneItems}
                        placeholder="Search by city or region"
                        emptyText="No time zone matches that search."
                        description={country?.timezones.includes(form.data.timezone) ? `A time zone in ${countryLabel}.` : 'Sets when each working day starts.'}
                    />
                </div>
                <p className="rounded-xl bg-muted/70 px-4 py-3 text-[0.8125rem] text-muted-foreground">
                    You can change the currency and time zone later under <span className="font-semibold text-foreground">Configuration → Company</span>.
                </p>
            </FieldSection>
        </div>
    );
}
