import BrandLogo from '@/Components/BrandLogo';
import TermsContent, { TermsOutline } from '@/Components/TermsContent';
import { Button } from '@/components/ui/button';
import { formatTermsDate } from '@/lib/terms';
import { Head, Link } from '@inertiajs/react';
import { ArrowRightIcon, PrinterIcon, ScaleIcon } from 'lucide-react';

/**
 * The public Terms of Service page, linked from sign-up, the marketing
 * site and the welcome emails.
 */
export default function Terms({ version }) {
    return (
        <div className="auth-theme min-h-svh bg-background font-display text-foreground">
            <Head title="Terms of Service" />

            <header className="sticky top-0 z-20 border-b bg-white print:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
                    <BrandLogo />
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" render={<Link href={route('login')} />} nativeButton={false}>
                            Sign in
                        </Button>
                        <Button variant="brand" size="sm" render={<Link href={route('onboarding.create')} />} nativeButton={false}>
                            Set up your company
                            <ArrowRightIcon data-icon="inline-end" />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="relative isolate overflow-hidden border-b bg-linear-to-b from-brand-cyan/[0.06] to-white">
                <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 -z-10 size-[30rem] rounded-full bg-radial from-brand-cyan/15 to-transparent to-70%" />
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-12 sm:px-8 sm:py-16">
                    <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-brand-ink uppercase">
                        <ScaleIcon className="size-4" aria-hidden="true" /> Legal
                    </p>
                    <h1 className="text-[2.2rem] leading-tight font-semibold tracking-tight sm:text-[2.8rem]">
                        Terms of{' '}
                        <span className="relative isolate inline-block font-serif text-[1.12em] font-normal tracking-normal italic">
                            <span aria-hidden="true" className="absolute inset-x-[-0.12em] bottom-[0.12em] -z-10 h-[0.36em] rounded-full bg-brand-sun" />
                            Service
                        </span>
                    </h1>
                    <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-muted-foreground">
                        These terms apply to every company that runs its properties, tenants and staff on EstateCamp. Each company accepts them when it signs up, and its acceptance is recorded with the version below.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-xs ring-1 ring-border">Version {version}</span>
                        <span className="text-muted-foreground">Effective {formatTermsDate(version)}</span>
                        <Button variant="ghost" size="sm" className="print:hidden" onClick={() => window.print()}>
                            <PrinterIcon data-icon="inline-start" /> Print
                        </Button>
                    </div>
                </div>
            </div>

            <main className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
                <aside className="hidden lg:block print:hidden">
                    <div className="sticky top-24 flex flex-col gap-3">
                        <p className="px-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">On this page</p>
                        <TermsOutline />
                    </div>
                </aside>
                <TermsContent className="max-w-3xl" />
            </main>

            <footer className="border-t py-8 text-center text-xs text-muted-foreground">&copy; {new Date().getFullYear()} EstateCamp. All rights reserved.</footer>
        </div>
    );
}
