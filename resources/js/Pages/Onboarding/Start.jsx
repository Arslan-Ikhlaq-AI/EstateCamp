import BrandLogo from '@/Components/BrandLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { browserTimeZone, fieldId, focusFirstError, readLogo, slugify, stepWithError, STEPS, suggestSlug } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon, RocketIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import CompanyStep from './Partials/CompanyStep';
import OnboardingAside from './Partials/OnboardingAside';
import OnboardingComplete from './Partials/OnboardingComplete';
import ReviewStep from './Partials/ReviewStep';
import TeamStep from './Partials/TeamStep';
import WorkspaceStep from './Partials/WorkspaceStep';

const INITIAL_DATA = {
    name: '',
    logo: null,
    legal_name: '',
    trade_license_number: '',
    expiry_date: '',
    tax_registration_number: '',
    email: '',
    phone: '',
    website: '',
    country_code: '',
    city: '',
    address_line_1: '',
    business_type: '',
    slug: '',
    default_currency: '',
    timezone: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_password: '',
    admin_password_confirmation: '',
    team: [],
    terms: false,
    fax: '',
};

const LOGO_REQUIRED = 'Upload your company logo.';

// Changing these by hand stops the country from overriding them.
const REGION_FIELDS = ['default_currency', 'timezone'];

const readPath = (data, name) => name.split('.').reduce((value, key) => value?.[key], data);

/**
 * The steps' place in the sign-up, for narrow screens where the side panel is hidden.
 */
function MobileProgress({ step }) {
    return (
        <div className="flex flex-col gap-2.5 lg:hidden">
            <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-brand-ink">
                    Step {step + 1} of {STEPS.length}
                </span>
                <span className="text-muted-foreground">{STEPS[step].label}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                {STEPS.map(({ key }, index) => (
                    <span key={key} className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full bg-brand-gradient transition-[width] duration-500', index <= step ? 'w-full' : 'w-0')} />
                    </span>
                ))}
            </div>
        </div>
    );
}

/**
 * Signing a company up, from the marketing site: its details, its
 * workspace, its team, then a review before it goes live. Each step is
 * checked against the server's rules before the next one opens.
 */
export default function Start({ completed, businessTypes, roles, countries, currencies, timezones, maxTeam, workspaceBase, termsVersion }) {
    const host = workspaceBase.replace(/^https?:\/\//, '');
    // The terms version shown here goes back with the sign-up, so the server records what was actually read.
    // Nothing is assumed about where the company is, except the time zone the visitor's own browser is in.
    const form = useForm('post', route('onboarding.store'), () => ({
        ...INITIAL_DATA,
        timezone: timezones.includes(browserTimeZone()) ? browserTimeZone() : '',
        terms_version: termsVersion,
    }));
    const { data } = form;

    const [step, setStep] = useState(0);
    const [furthest, setFurthest] = useState(0);
    const [direction, setDirection] = useState('forward');
    const [isChecking, setIsChecking] = useState(false);
    const [hasConnectionError, setHasConnectionError] = useState(false);
    const [logoInfo, setLogoInfo] = useState(null);

    const logoPreview = useMemo(() => (data.logo ? URL.createObjectURL(data.logo) : null), [data.logo]);

    useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

    const slugEdited = useRef(false);
    const regionEdited = useRef({});
    const nextMemberKey = useRef(1);
    const headingRef = useRef(null);
    const hasMounted = useRef(false);

    useEffect(() => {
        form.setValidationTimeout(400);
        // Row keys only order the list on screen; the server never sees them.
        form.transform((values) => ({ ...values, team: values.team.map(({ key, ...member }) => member) }));
    }, []);

    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true;

            return;
        }

        window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        headingRef.current?.focus({ preventScroll: true });
    }, [step]);

    const bind = (name) => ({
        id: fieldId(name),
        value: readPath(data, name),
        onChange: (value) => {
            if (REGION_FIELDS.includes(name)) {
                regionEdited.current[name] = true;
            }

            if (name === 'name' && !slugEdited.current) {
                form.setData((values) => ({ ...values, name: value, slug: suggestSlug(value) }));
            } else {
                form.setData(name, value);
            }

            // A field showing an error is re-checked as it changes, so the message clears as soon as it is fixed.
            if (form.errors[name]) {
                form.validate(name);
            }

            // So is the confirmation once the password it has to match changes.
            if (name === 'admin_password' && data.admin_password_confirmation !== '') {
                form.validate('admin_password_confirmation');
            }
        },
        onBlur: () => {
            if (readPath(data, name) !== '' || form.invalid(name)) {
                form.validate(name);
            }
        },
        error: form.errors[name],
        valid: form.valid(name) && readPath(data, name) !== '',
    });

    // A country suggests its currency and a time zone: the visitor's own when it is in that country, else the country's main one.
    const changeCountry = (code) => {
        const country = countries.find((option) => option.code === code);
        const ownZone = browserTimeZone();

        form.setData((values) => ({
            ...values,
            country_code: code,
            ...(country?.currency && !regionEdited.current.default_currency ? { default_currency: country.currency } : {}),
            ...(country && !regionEdited.current.timezone ? { timezone: country.timezones.includes(ownZone) ? ownZone : (country.timezones[0] ?? values.timezone) } : {}),
        }));
        form.clearErrors('country_code');
    };

    const chooseLogo = async (file) => {
        if (!file) {
            return;
        }

        const { error, width, height } = await readLogo(file);

        // A wrong file keeps the logo already chosen, if there is one.
        if (error) {
            form.setError('logo', error);

            return;
        }

        form.setData('logo', file);
        form.clearErrors('logo');
        setLogoInfo({ name: file.name, size: file.size, width, height });
    };

    const removeLogo = () => {
        form.setData('logo', null);
        setLogoInfo(null);
    };

    const changeSlug = (value) => {
        slugEdited.current = true;
        form.setData('slug', slugify(value, { trim: false }));

        // Checked once the address reads as finished, not halfway through a hyphen.
        if (value && !value.endsWith('-')) {
            form.validate('slug');
        }
    };

    const clearTeamErrors = () => {
        const teamErrors = Object.keys(form.errors).filter((name) => name.startsWith('team'));

        if (teamErrors.length > 0) {
            form.clearErrors(...teamErrors);
        }
    };

    const changeTeamCount = (count) => {
        const size = Math.max(0, Math.min(maxTeam, count));
        const added = Array.from({ length: Math.max(0, size - data.team.length) }, () => ({ key: nextMemberKey.current++, name: '', email: '', role: 'manager', password: '' }));

        form.setData('team', size > data.team.length ? [...data.team, ...added] : data.team.slice(0, size));
        clearTeamErrors();

        if (size > data.team.length) {
            requestAnimationFrame(() => document.getElementById(fieldId(`team.${size - 1}.name`))?.focus());
        }
    };

    const removeMember = (index) => {
        form.setData('team', data.team.filter((_, position) => position !== index));
        clearTeamErrors();
    };

    const goTo = (index) => {
        setDirection(index > step ? 'forward' : 'back');
        setStep(index);
        setFurthest((current) => Math.max(current, index));
        setHasConnectionError(false);

        // The address is checked whenever it is shown, including one suggested from the company name.
        if (index === 1 && data.slug) {
            form.validate({ only: ['slug'] });
        }
    };

    const launch = () => {
        form.post(route('onboarding.store'), {
            preserveScroll: true,
            onError: (errors) => {
                const target = stepWithError(errors);

                if (target !== step) {
                    goTo(target);
                }

                requestAnimationFrame(() => focusFirstError(errors));
            },
        });
    };

    const submit = (event) => {
        event.preventDefault();

        if (isChecking || form.processing) {
            return;
        }

        const isLastStep = step === STEPS.length - 1;
        // The logo is checked here rather than through Precognition, which would upload it with every check.
        const isLogoMissing = (step === 0 || isLastStep) && !data.logo;
        let isAnswered = false;

        setIsChecking(true);
        setHasConnectionError(false);

        if (isLogoMissing) {
            form.setError('logo', LOGO_REQUIRED);
        }

        // The last step checks every field, so launching only sends a sign-up that will succeed.
        form.validate({
            only: isLastStep ? STEPS.flatMap((item) => item.fields) : STEPS[step].fields,
            onSuccess: () => {
                isAnswered = true;

                if (isLogoMissing) {
                    if (step !== 0) {
                        goTo(0);
                    }

                    requestAnimationFrame(() => focusFirstError({ logo: LOGO_REQUIRED }));

                    return;
                }

                isLastStep ? launch() : goTo(step + 1);
            },
            onValidationError: (response) => {
                const errors = isLogoMissing ? { logo: LOGO_REQUIRED, ...response.data.errors } : (response.data.errors ?? {});
                const target = stepWithError(errors);

                isAnswered = true;

                if (target !== step) {
                    goTo(target);
                }

                requestAnimationFrame(() => focusFirstError(errors));
            },
            onFinish: () => {
                setIsChecking(false);
                setHasConnectionError(!isAnswered);
            },
        });
    };

    const businessType = businessTypes.find((type) => type.value === data.business_type)?.label;
    const current = STEPS[step];
    const isLastStep = step === STEPS.length - 1;
    const isBusy = isChecking || form.processing;

    return (
        <div className="auth-theme grid min-h-svh bg-background font-display text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Head title={completed ? 'Workspace ready' : 'Set up your company'} />

            <OnboardingAside
                step={step}
                furthest={furthest}
                isComplete={Boolean(completed)}
                onStepClick={goTo}
                data={data}
                host={host}
                businessType={businessType}
                logoPreview={logoPreview ?? completed?.logoUrl}
            />

            <main className="relative isolate flex min-w-0 flex-col overflow-hidden px-5 pt-6 pb-10 sm:px-10 lg:px-14 lg:pt-10 xl:px-20">
                <div aria-hidden="true" className="pointer-events-none absolute -top-[22rem] -right-[22rem] -z-10 size-[44rem] rounded-full bg-radial from-brand-cyan/15 to-transparent to-70%" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-[24rem] -left-[24rem] -z-10 size-[46rem] rounded-full bg-radial from-brand-sun/45 to-transparent to-70%" />

                <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8">
                    <div className="flex items-center justify-between gap-4">
                        <BrandLogo className="lg:hidden" />
                        <p className="ms-auto text-sm text-muted-foreground">
                            <span className="hidden sm:inline">Already on EstateCamp? </span>
                            <Link href={route('login')} className="rounded-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {completed ? (
                        <OnboardingComplete completed={completed} />
                    ) : (
                        <form onSubmit={submit} noValidate aria-busy={isBusy} className="flex flex-1 flex-col gap-8">
                            <MobileProgress step={step} />

                            <header className="flex flex-col gap-3">
                                <p className="hidden text-xs font-bold tracking-[0.16em] text-brand-ink uppercase lg:block">
                                    Step {step + 1} of {STEPS.length} · {current.label}
                                </p>
                                <h1 ref={headingRef} tabIndex={-1} className="text-[1.9rem] leading-tight font-semibold tracking-tight outline-none sm:text-[2.35rem]">
                                    {current.title}{' '}
                                    <span className="relative isolate inline-block font-serif text-[1.12em] font-normal tracking-normal italic">
                                        <span aria-hidden="true" className="absolute inset-x-[-0.12em] bottom-[0.12em] -z-10 h-[0.36em] rounded-full bg-brand-sun" />
                                        {current.highlight}
                                    </span>
                                </h1>
                                <p className="max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">{current.description}</p>
                            </header>

                            <div
                                key={current.key}
                                className={cn(
                                    'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
                                    direction === 'forward' ? 'motion-safe:slide-in-from-right-6 rtl:motion-safe:slide-in-from-left-6' : 'motion-safe:slide-in-from-left-6 rtl:motion-safe:slide-in-from-right-6',
                                )}
                            >
                                {step === 0 && (
                                    <CompanyStep
                                        bind={bind}
                                        countries={countries}
                                        onCountryChange={changeCountry}
                                        logo={{ preview: logoPreview, info: logoInfo, error: form.errors.logo, onChoose: chooseLogo, onRemove: removeLogo }}
                                    />
                                )}
                                {step === 1 && (
                                    <WorkspaceStep
                                        form={form}
                                        bind={bind}
                                        businessTypes={businessTypes}
                                        countries={countries}
                                        currencies={currencies}
                                        timezones={timezones}
                                        host={host}
                                        onSlugChange={changeSlug}
                                    />
                                )}
                                {step === 2 && <TeamStep form={form} bind={bind} roles={roles} maxTeam={maxTeam} onTeamCountChange={changeTeamCount} onRemoveMember={removeMember} />}
                                {step === 3 && <ReviewStep form={form} host={host} businessTypes={businessTypes} roles={roles} logoPreview={logoPreview} termsVersion={termsVersion} onEdit={goTo} />}
                            </div>

                            {/* Left empty by people; bots that fill every field are turned away. */}
                            <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
                                <label>
                                    Fax
                                    <input type="text" name="fax" tabIndex={-1} autoComplete="off" value={data.fax} onChange={(event) => form.setData('fax', event.target.value)} />
                                </label>
                            </div>

                            {hasConnectionError && (
                                <Alert variant="destructive" role="alert">
                                    <CircleAlertIcon />
                                    <AlertDescription>We could not check your details just now. Please check your connection and try again.</AlertDescription>
                                </Alert>
                            )}

                            <footer className="sticky bottom-0 z-10 -mx-5 mt-auto flex items-center gap-3 border-t bg-white px-5 py-4 sm:-mx-10 sm:px-10 lg:static lg:mx-0 lg:border-t lg:bg-transparent lg:px-0 lg:pt-6 lg:pb-0">
                                {step > 0 && (
                                    <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => goTo(step - 1)} disabled={isBusy}>
                                        <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" /> Back
                                    </Button>
                                )}
                                <Button type="submit" variant="brand" size="lg" className="ms-auto h-12 min-w-40 px-6 text-[0.95rem]" disabled={isBusy}>
                                    {isBusy && <Spinner data-icon="inline-start" />}
                                    {isLastStep ? (form.processing ? 'Launching…' : 'Launch workspace') : isChecking ? 'Checking…' : `Continue to ${STEPS[step + 1].label.toLowerCase()}`}
                                    {!isBusy && (isLastStep ? <RocketIcon data-icon="inline-end" /> : <ArrowRightIcon data-icon="inline-end" className="transition-transform group-hover/button:translate-x-0.5 rtl:rotate-180" />)}
                                </Button>
                            </footer>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
