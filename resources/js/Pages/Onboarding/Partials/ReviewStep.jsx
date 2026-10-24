import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { countryName, STEPS, timezoneLabel } from '@/lib/onboarding';
import { formatTermsDate } from '@/lib/terms';
import { cn } from '@/lib/utils';
import { BookOpenIcon, CrownIcon, KeyRoundIcon, MailCheckIcon, PencilIcon, ScaleIcon, ShieldCheckIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { PersonAvatar, ROLE_ICONS } from './TeamStep';
import TermsDialog from './TermsDialog';

/**
 * One step's answers, with a button back to that step.
 */
function SummaryCard({ step, onEdit, children }) {
    const { icon: Icon, label } = STEPS[step];

    return (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-xs">
            <header className="flex items-center gap-3 border-b bg-linear-to-r from-brand-cyan/[0.06] to-transparent px-5 py-3.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-sm">
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <h2 className="flex-1 text-[0.95rem] font-bold tracking-tight">{label}</h2>
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(step)} aria-label={`Edit ${label.toLowerCase()} details`}>
                    <PencilIcon data-icon="inline-start" /> Edit
                </Button>
            </header>
            <div className="px-5 py-4">{children}</div>
        </section>
    );
}

/**
 * Label and value pairs, skipping those left empty.
 */
function Details({ items }) {
    return (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {items
                .filter(([, value]) => value)
                .map(([label, value, wide]) => (
                    <div key={label} className={cn('flex min-w-0 flex-col gap-0.5', wide && 'sm:col-span-2')}>
                        <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
                        <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
                    </div>
                ))}
        </dl>
    );
}

const NEXT_STEPS = [
    { icon: SparklesIcon, title: 'Your workspace is created', description: 'With your company profile, regional settings and roles.' },
    { icon: KeyRoundIcon, title: 'Everyone gets their sign-in', description: 'Each person receives their own email with their workspace link and password.' },
    { icon: MailCheckIcon, title: 'A summary goes to the company', description: 'Your company email gets the workspace details for your records.' },
];

/**
 * Step 4: everything entered, what launching does, and the terms.
 */
export default function ReviewStep({ form, host, businessTypes, roles, logoPreview, termsVersion, onEdit }) {
    const { data } = form;
    const [isReadingTerms, setIsReadingTerms] = useState(false);

    const acceptTerms = (isAccepted) => {
        form.setData('terms', isAccepted);
        form.clearErrors('terms');
    };
    const businessType = businessTypes.find((type) => type.value === data.business_type)?.label;
    const roleName = (value) => roles.find((role) => role.value === value)?.name;
    const people = [{ name: data.admin_name, email: data.admin_email, role: 'super_admin', password: data.admin_password }, ...data.team];

    return (
        <div className="flex flex-col gap-5">
            <SummaryCard step={0} onEdit={onEdit}>
                <div className="mb-4 flex items-center gap-4 border-b pb-4">
                    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[conic-gradient(#eef1f6_25%,#fff_0_50%,#eef1f6_0_75%,#fff_0)] bg-size-[14px_14px] ring-1 ring-border">
                        {logoPreview && <img src={logoPreview} alt={`${data.name} logo`} className="size-full object-contain p-2" />}
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-bold tracking-tight">{data.name}</span>
                        {businessType && <span className="truncate text-[0.8125rem] text-muted-foreground">{businessType}</span>}
                    </div>
                </div>
                <Details
                    items={[
                        ['Legal name', data.legal_name],
                        ['Registration', [data.trade_license_number, data.expiry_date && `expires ${new Date(`${data.expiry_date}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`].filter(Boolean).join(', ')],
                        ['Tax number', data.tax_registration_number],
                        ['Email', data.email],
                        ['Phone', data.phone],
                        ['Website', data.website],
                        ['Location', [data.address_line_1, data.city, countryName(data.country_code)].filter(Boolean).join(', '), true],
                    ]}
                />
            </SummaryCard>

            <SummaryCard step={1} onEdit={onEdit}>
                <Details
                    items={[
                        ['Workspace address', `${host}/${data.slug}`, true],
                        ['Business', businessType],
                        ['Currency', data.default_currency],
                        ['Time zone', timezoneLabel(data.timezone)],
                    ]}
                />
            </SummaryCard>

            <SummaryCard step={2} onEdit={onEdit}>
                <ul className="flex flex-col divide-y">
                    {people.map((person, index) => {
                        const Icon = ROLE_ICONS[person.role] ?? ShieldCheckIcon;

                        return (
                            <li key={person.key ?? 'owner'} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                                <PersonAvatar name={person.name} isOwner={index === 0} className="size-9 text-xs" />
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-bold">{person.name}</span>
                                    <span className="truncate text-[0.8125rem] text-muted-foreground">
                                        {person.email} · {person.password ? 'password set' : 'password created at launch'}
                                    </span>
                                </div>
                                <span
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1',
                                        person.role === 'super_admin' ? 'bg-gold/15 text-gold-ink ring-gold/30' : 'bg-brand-cyan/10 text-brand-ink ring-brand-cyan/25',
                                    )}
                                >
                                    {index === 0 ? <CrownIcon className="size-3.5" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
                                    {roleName(person.role)}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </SummaryCard>

            <section aria-labelledby="next-heading" className="relative isolate mt-2 overflow-hidden rounded-2xl bg-brand-navy p-5 text-white shadow-lg shadow-brand-navy/20 sm:p-6">
                <div aria-hidden="true" className="absolute -end-20 -top-24 -z-10 size-64 rounded-full bg-radial from-brand-cyan/45 to-transparent to-70%" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-grain opacity-[0.08] mix-blend-overlay" />
                <h2 id="next-heading" className="text-base font-bold tracking-tight">
                    When you launch
                </h2>
                <ol className="mt-4 flex flex-col gap-4">
                    {NEXT_STEPS.map(({ icon: Icon, title, description }, index) => (
                        <li key={title} className="flex gap-3.5">
                            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-cyan ring-1 ring-white/15">
                                <Icon className="size-4" aria-hidden="true" />
                                <span className="absolute -end-1.5 -top-1.5 flex size-4.5 items-center justify-center rounded-full bg-brand-sun text-[0.65rem] font-extrabold text-brand-navy">{index + 1}</span>
                            </span>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">{title}</span>
                                <span className="text-[0.8125rem] text-white/65">
                                    {index === 2 && data.email ? `Sent to ${data.email}.` : description}
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section aria-labelledby="terms-heading" className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-start gap-3.5">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-cyan/10 text-brand-ink ring-1 ring-brand-cyan/20">
                            <ScaleIcon className="size-4.5" aria-hidden="true" />
                        </span>
                        <div className="flex flex-col gap-0.5">
                            <h2 id="terms-heading" className="text-[0.95rem] font-bold tracking-tight">
                                Terms of Service
                            </h2>
                            <p className="text-[0.8125rem] leading-snug text-muted-foreground">
                                Version {termsVersion}, effective {formatTermsDate(termsVersion)}. Covers your workspace and accounts, your data, and how the personal data of tenants and staff is handled.
                            </p>
                        </div>
                    </div>
                    <Button id="terms_version" type="button" variant="outline" className="shrink-0" onClick={() => setIsReadingTerms(true)}>
                        <BookOpenIcon data-icon="inline-start" /> Read terms
                    </Button>
                </div>

                <Field
                    orientation="horizontal"
                    data-invalid={form.errors.terms || form.errors.terms_version ? true : undefined}
                    className={cn('items-start rounded-xl p-3.5 transition-colors', data.terms ? 'bg-success/[0.06] ring-1 ring-success/20' : 'bg-muted/60')}
                >
                    <Checkbox
                        id="terms"
                        checked={data.terms}
                        onCheckedChange={acceptTerms}
                        aria-required="true"
                        aria-invalid={Boolean(form.errors.terms)}
                        aria-describedby={form.errors.terms ? 'terms-error' : undefined}
                        className="mt-0.5 size-5"
                    />
                    <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="terms" className="block text-sm leading-relaxed font-medium">
                            I am authorised to register {data.name.trim() || 'this company'} and accept the EstateCamp{' '}
                            <button
                                type="button"
                                onClick={() => setIsReadingTerms(true)}
                                className="rounded-sm font-semibold text-brand-ink underline decoration-brand-cyan/40 underline-offset-4 outline-none hover:decoration-brand-cyan focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                Terms of Service
                            </button>
                            , including how personal data is handled.
                        </FieldLabel>
                        {form.errors.terms && <FieldError id="terms-error">{form.errors.terms}</FieldError>}
                        {form.errors.terms_version && <FieldError>{form.errors.terms_version}</FieldError>}
                    </div>
                </Field>
            </section>

            <TermsDialog
                open={isReadingTerms}
                onOpenChange={setIsReadingTerms}
                version={termsVersion}
                onAccept={() => {
                    acceptTerms(true);
                    setIsReadingTerms(false);
                }}
            />
        </div>
    );
}
