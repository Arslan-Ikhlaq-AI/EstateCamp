import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, Building2Icon, CheckIcon, CopyIcon, KeyRoundIcon, MailCheckIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Sparkles around the success badge: position, size and delay.
const SPARKLES = [
    { className: '-top-3 start-2', size: 'size-2.5', delay: '0s' },
    { className: 'top-4 -end-5', size: 'size-2', delay: '0.6s' },
    { className: '-bottom-2 -start-4', size: 'size-1.5', delay: '1.1s' },
    { className: 'bottom-6 -end-8', size: 'size-3', delay: '1.7s' },
    { className: '-top-6 end-10', size: 'size-1.5', delay: '2.3s' },
];

/**
 * The workspace address with a button that copies it.
 */
function WorkspaceLink({ url }) {
    const [isCopied, setIsCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch {
            setIsCopied(false);
        }
    };

    return (
        <div className="flex items-center gap-2 rounded-2xl border bg-white p-2 ps-4 shadow-xs">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-navy">{url.replace(/^https?:\/\//, '')}</span>
            <Button type="button" variant="outline" size="sm" onClick={copy} aria-live="polite">
                {isCopied ? <CheckIcon data-icon="inline-start" className="text-success" /> : <CopyIcon data-icon="inline-start" />}
                {isCopied ? 'Copied' : 'Copy link'}
            </Button>
        </div>
    );
}

/**
 * Shown once the company is set up: its address and who was emailed what.
 */
export default function OnboardingComplete({ completed }) {
    const headingRef = useRef(null);

    useEffect(() => headingRef.current?.focus(), []);

    const hasGeneratedPasswords = completed.users.some((user) => user.isGenerated);
    const recipients = [
        { key: 'company', name: completed.company, email: completed.companyEmail, note: 'Workspace summary', icon: Building2Icon, isCompany: true },
        ...completed.users.map((user) => ({ key: user.email, name: user.name, email: user.email, note: `${user.role} sign-in`, icon: KeyRoundIcon })),
    ];

    return (
        <div className="flex flex-col gap-9 motion-safe:animate-enter">
            <div className="flex flex-col items-start gap-7">
                <div className="relative">
                    <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand-cyan/30 motion-safe:animate-ping-soft" />
                    <span className="relative flex size-20 items-center justify-center rounded-full bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-xl shadow-brand-cyan/30 ring-8 ring-brand-cyan/10">
                        <CheckIcon className="size-9 stroke-3 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500" aria-hidden="true" />
                    </span>
                    {SPARKLES.map(({ className, size, delay }) => (
                        <span
                            key={className}
                            aria-hidden="true"
                            className={cn('absolute rotate-45 rounded-[2px] bg-gold motion-safe:animate-twinkle', className, size)}
                            style={{ animationDelay: delay }}
                        />
                    ))}
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold tracking-[0.16em] text-brand-ink uppercase">All set</p>
                    <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] leading-tight font-semibold tracking-tight outline-none sm:text-[2.5rem]">
                        {completed.company} is{' '}
                        <span className="relative isolate inline-block font-serif text-[1.12em] font-normal tracking-normal italic">
                            <span aria-hidden="true" className="absolute inset-x-[-0.12em] bottom-[0.12em] -z-10 h-[0.36em] rounded-full bg-brand-sun" />
                            live.
                        </span>
                    </h1>
                    <p className="max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground">
                        Your workspace is ready. We have emailed everyone their sign-in details; they can sign in as soon as the email arrives.
                    </p>
                </div>
            </div>

            <section aria-labelledby="link-heading" className="flex flex-col gap-2.5">
                <h2 id="link-heading" className="text-sm font-bold">
                    Your workspace address
                </h2>
                <WorkspaceLink url={completed.workspaceUrl} />
                <p className="text-[0.8125rem] text-muted-foreground">Bookmark it, or share it with your team: it opens the sign-in page under your company’s name.</p>
            </section>

            <section aria-labelledby="emails-heading" className="flex flex-col gap-3">
                <h2 id="emails-heading" className="flex items-center gap-2 text-sm font-bold">
                    <MailCheckIcon className="size-4 text-brand-ink" aria-hidden="true" /> Emails on their way
                </h2>
                <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-white shadow-xs">
                    {recipients.map(({ key, name, email, note, icon: Icon, isCompany }, index) => (
                        <li key={key} className="flex items-center gap-3 px-4 py-3 motion-safe:animate-enter" style={{ animationDelay: `${120 + index * 70}ms` }}>
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br text-xs font-bold text-white',
                                    isCompany && completed.logoUrl && 'rounded-xl bg-white bg-none ring-1 ring-border',
                                    isCompany && !completed.logoUrl && 'rounded-xl from-brand-navy to-[#0b2a8a]',
                                    !isCompany && (index === 1 ? 'from-gold to-[#d68a00]' : 'from-brand-cyan to-brand-navy'),
                                )}
                            >
                                {isCompany ? (
                                    completed.logoUrl ? <img src={completed.logoUrl} alt="" className="size-full object-contain p-1" /> : <Building2Icon className="size-4" />
                                ) : (
                                    getInitials(name)
                                )}
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-bold">{name}</span>
                                <span className="truncate text-[0.8125rem] text-muted-foreground">{email}</span>
                            </div>
                            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
                                <Icon className="size-3.5" aria-hidden="true" /> {note}
                            </span>
                        </li>
                    ))}
                </ul>
                <p className="text-[0.8125rem] text-muted-foreground">
                    Not there in a few minutes? Check the spam folder.{' '}
                    {hasGeneratedPasswords
                        ? 'Passwords created at launch are temporary, so ask those teammates to change theirs after they first sign in.'
                        : 'Everyone signs in with the password set during sign-up.'}
                </p>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="brand" size="lg" className="h-12 px-6 text-[0.95rem]" render={<a href={completed.workspaceUrl} />} nativeButton={false}>
                    Go to sign in
                    <ArrowRightIcon data-icon="inline-end" className="transition-transform group-hover/button:translate-x-0.5" />
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-6" render={<Link href={route('onboarding.create')} />} nativeButton={false}>
                    <PlusIcon data-icon="inline-start" /> Set up another company
                </Button>
            </div>
        </div>
    );
}
