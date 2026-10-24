import { NightScene } from '@/Components/AuthScenes';
import BrandLogo from '@/Components/BrandLogo';
import { getInitials } from '@/lib/format';
import { countryName, STEPS, timezoneLabel } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { CheckIcon, Clock3Icon, CoinsIcon, GlobeIcon, LanguagesIcon, LockKeyholeIcon, MapPinIcon, UsersRoundIcon } from 'lucide-react';

/**
 * The steps down the side: done ones can be reopened, the current one is
 * solid white, later ones wait in outline.
 */
function Stepper({ step, furthest, isComplete, onStepClick }) {
    return (
        <ol className="flex flex-col">
            {STEPS.map(({ key, label, summary, icon: Icon }, index) => {
                const isDone = isComplete || index < step;
                const isCurrent = !isComplete && index === step;
                const canOpen = !isComplete && index <= furthest && index !== step;

                return (
                    <li key={key} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < STEPS.length - 1 && (
                            <span aria-hidden="true" className="absolute start-5 top-11 bottom-0 w-px -translate-x-1/2 bg-white/15 rtl:translate-x-1/2">
                                <span className={cn('absolute inset-x-0 top-0 bg-brand-cyan transition-[height] duration-700 ease-out', isDone ? 'h-full' : 'h-0')} />
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => onStepClick(index)}
                            disabled={!canOpen}
                            aria-current={isCurrent ? 'step' : undefined}
                            className="group/step flex items-start gap-4 rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
                        >
                            <span
                                className={cn(
                                    'flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-500',
                                    isDone && 'bg-brand-cyan text-brand-navy',
                                    isCurrent && 'bg-white text-brand-navy shadow-lg shadow-black/20',
                                    !isDone && !isCurrent && 'text-white/55 ring-1 ring-white/25',
                                    canOpen && 'group-hover/step:scale-105',
                                )}
                            >
                                {isDone ? <CheckIcon className="size-4.5 stroke-3" aria-hidden="true" /> : <Icon className="size-4.5" aria-hidden="true" />}
                            </span>
                            <span className="flex flex-col gap-0.5 pt-0.5">
                                <span className="text-[0.7rem] font-bold tracking-[0.14em] text-white/45 uppercase">Step {index + 1}</span>
                                <span className={cn('font-bold transition-colors', isCurrent || isDone ? 'text-white' : 'text-white/60', canOpen && 'group-hover/step:text-brand-cyan')}>
                                    {label}
                                    {isDone && <span className="sr-only"> (done)</span>}
                                </span>
                                <span className="text-[0.8125rem] text-white/55">{summary}</span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

/**
 * The workspace as it is being set up, updating with every answer.
 */
function WorkspacePreview({ data, host, businessType }) {
    const name = data.name.trim();
    const people = [data.admin_name, ...data.team.map((member) => member.name)];
    const chips = [
        { icon: CoinsIcon, label: data.default_currency },
        { icon: Clock3Icon, label: timezoneLabel(data.timezone).split('/').pop() },
        { icon: MapPinIcon, label: [data.city.trim(), countryName(data.country_code)].filter(Boolean).join(', ') },
    ].filter((chip) => chip.label);

    return (
        <figure aria-label="Workspace preview" className="flex flex-col gap-5 rounded-3xl bg-white/[0.07] p-5 shadow-2xl shadow-black/30 ring-1 ring-white/12 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-white/20" />
                    <span className="size-2.5 rounded-full bg-white/20" />
                    <span className="size-2.5 rounded-full bg-white/20" />
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10">
                    <LockKeyholeIcon className="size-3 shrink-0 text-brand-cyan" aria-hidden="true" />
                    <span className="truncate">
                        {host}/<span className="font-semibold text-white">{data.slug || 'your-company'}</span>
                    </span>
                </span>
            </div>

            <div className="flex items-center gap-3.5">
                <span className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-cyan to-[#0b2a8a] text-lg font-bold text-white shadow-lg shadow-brand-cyan/20 ring-1 ring-white/25">
                    {name ? getInitials(name) : <GlobeIcon className="size-5" aria-hidden="true" />}
                </span>
                <div className="flex min-w-0 flex-col">
                    <span className={cn('truncate text-lg font-bold tracking-tight', !name && 'text-white/45')}>{name || 'Your company'}</span>
                    <span className="truncate text-[0.8125rem] text-white/60">{businessType ?? 'Property & accommodation'}</span>
                </div>
            </div>

            {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {chips.map(({ icon: Icon, label }) => (
                        <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/10">
                            <Icon className="size-3.5 text-brand-sun" aria-hidden="true" /> {label}
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <div className="flex -space-x-1.5 rtl:space-x-reverse">
                    {people.slice(0, 5).map((person, index) => (
                        <span
                            key={index}
                            className={cn(
                                'flex size-8 items-center justify-center rounded-full bg-linear-to-br text-[0.7rem] font-bold text-white ring-2 ring-brand-navy',
                                index === 0 ? 'from-gold to-[#d68a00]' : 'from-brand-cyan to-[#0b2a8a]',
                            )}
                        >
                            {person.trim() ? getInitials(person) : <UsersRoundIcon className="size-3.5" aria-hidden="true" />}
                        </span>
                    ))}
                    {people.length > 5 && (
                        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-[0.7rem] font-bold ring-2 ring-brand-navy">+{people.length - 5}</span>
                    )}
                </div>
                <span className="text-xs font-semibold text-white/70">
                    {people.length} {people.length === 1 ? 'user' : 'users'}
                </span>
            </div>
        </figure>
    );
}

const FACTS = [
    { icon: LanguagesIcon, label: 'English & Arabic' },
    { icon: CoinsIcon, label: 'Your currency & time zone' },
    { icon: LockKeyholeIcon, label: 'Your own sign-in link' },
];

/**
 * The navy panel beside the form on wide screens: what is being set up,
 * the steps, and a live preview of the workspace.
 */
export default function OnboardingAside({ step, furthest, isComplete, onStepClick, data, host, businessType }) {
    return (
        <aside className="dark relative isolate hidden flex-col overflow-hidden bg-brand-navy text-white lg:sticky lg:top-0 lg:flex lg:h-svh">
            <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ '--mx': 0, '--my': 0 }}>
                <NightScene withMarker={false} />
                <div className="absolute inset-0 bg-linear-to-b from-brand-navy/95 via-brand-navy/75 to-brand-navy/35" />
                <div className="absolute inset-0 bg-grain opacity-[0.09] mix-blend-overlay" />
            </div>

            <header className="flex items-center px-8 pt-8 xl:px-12 xl:pt-10">
                <BrandLogo />
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-8 pt-8 pb-8 xl:px-12 xl:pb-10 [@media(min-height:62rem)]:pt-12">
                <div className="flex flex-col gap-3">
                    <h2 className="font-display text-[2.1rem] leading-[1.08] font-semibold tracking-tight text-balance xl:text-[2.5rem]">
                        Your company,{' '}
                        <span className="font-serif font-normal tracking-normal text-brand-sun italic">{isComplete ? 'up and running.' : 'live in minutes.'}</span>
                    </h2>
                    <p className="max-w-sm text-[0.9375rem] leading-relaxed text-white/65 [@media(max-height:58rem)]:hidden">
                        Properties, rooms, tenants, cheques, maintenance and staff, in one workspace built around how you operate.
                    </p>
                </div>

                <Stepper step={step} furthest={furthest} isComplete={isComplete} onStepClick={onStepClick} />

                <div className="mt-auto flex flex-col gap-5">
                    <WorkspacePreview data={data} host={host} businessType={businessType} />
                    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/60">
                        {FACTS.map(({ icon: Icon, label }) => (
                            <li key={label} className="flex items-center gap-1.5">
                                <Icon className="size-3.5 text-brand-cyan" aria-hidden="true" /> {label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </aside>
    );
}
