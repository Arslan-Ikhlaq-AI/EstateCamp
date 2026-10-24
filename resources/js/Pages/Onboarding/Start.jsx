import BrandLogo from '@/Components/BrandLogo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { COUNTRIES, fieldId, focusFirstError, slugify, stepWithError, STEPS, suggestSlug } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon, CornerDownLeftIcon, RocketIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CompanyStep from './Partials/CompanyStep';
import OnboardingAside from './Partials/OnboardingAside';
import OnboardingComplete from './Partials/OnboardingComplete';
import ReviewStep from './Partials/ReviewStep';
import TeamStep from './Partials/TeamStep';
import WorkspaceStep from './Partials/WorkspaceStep';

const INITIAL_DATA = {
    name: '',
    legal_name: '',
    trade_license_number: '',
    expiry_date: '',
    tax_registration_number: '',
    email: '',
    phone: '',
    website: '',
    country_code: 'AE',
    city: '',
    address_line_1: '',
    business_type: '',
    slug: '',
    default_currency: 'AED',
    timezone: 'Asia/Dubai',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    team: [],
    terms: false,
    fax: '',
};

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
export default function Start({ completed, businessTypes, roles, currencies, timezones, maxTeam, workspaceBase }) {
    const host = workspaceBase.replace(/^https?:\/\//, '');
    const form = useForm('post', route('onboarding.store'), INITIAL_DATA);
    const { data } = form;

    const [step, setStep] = useState(0);
    const [furthest, setFurthest] = useState(0);
    const [direction, setDirection] = useState('forward');
    const [isChecking, setIsChecking] = useState(false);
    const [hasConnectionError, setHasConnectionError] = useState(false);

    const slugEdited = useRef(false);
    const regionEdited = useRef(false);
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
                regionEdited.current = true;
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
        },
        onBlur: () => {
            if (readPath(data, name) !== '' || form.invalid(name)) {
                form.validate(name);
            }
        },
        error: form.errors[name],
        valid: form.valid(name) && readPath(data, name) !== '',
    });

    const changeCountry = (code) => {
        const country = COUNTRIES.find((option) => option.code === code);

        form.setData((values) => ({
            ...values,
            country_code: code,
            ...(country && !regionEdited.current ? { default_currency: country.currency, timezone: country.timezone } : {}),
        }));
        form.clearErrors('country_code');
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
        const added = Array.from({ length: Math.max(0, size - data.team.length) }, () => ({ key: nextMemberKey.current++, name: '', email: '', role: 'manager' }));

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
        let isAnswered = false;

        setIsChecking(true);
        setHasConnectionError(false);

        // The last step checks every field, so launching only sends a sign-up that will succeed.
        form.validate({
            only: isLastStep ? STEPS.flatMap((item) => item.fields) : STEPS[step].fields,
            onSuccess: () => {
                isAnswered = true;
                isLastStep ? launch() : goTo(step + 1);
            },
            onValidationError: (response) => {
                const errors = response.data.errors ?? {};
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

            <OnboardingAside step={step} furthest={furthest} isComplete={Boolean(completed)} onStepClick={goTo} data={data} host={host} businessType={businessType} />

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
                                {step === 0 && <CompanyStep bind={bind} onCountryChange={changeCountry} />}
                                {step === 1 && (
                                    <WorkspaceStep form={form} bind={bind} businessTypes={businessTypes} currencies={currencies} timezones={timezones} host={host} onSlugChange={changeSlug} />
                                )}
                                {step === 2 && <TeamStep form={form} bind={bind} roles={roles} maxTeam={maxTeam} onTeamCountChange={changeTeamCount} onRemoveMember={removeMember} />}
                                {step === 3 && <ReviewStep form={form} host={host} businessTypes={businessTypes} roles={roles} onEdit={goTo} />}
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
                                <span className="ms-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                                    Press <kbd className="inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 font-sans font-semibold text-foreground shadow-xs">Enter <CornerDownLeftIcon className="size-3" /></kbd>
                                </span>
                                <Button type="submit" variant="brand" size="lg" className="ms-auto h-12 min-w-40 px-6 text-[0.95rem] sm:ms-0" disabled={isBusy}>
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
