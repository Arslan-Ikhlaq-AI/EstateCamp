import AuthShowcase from '@/Components/AuthShowcase';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

export default function AuthLayout({ children }) {
    return (
        <div className="auth-theme grid min-h-svh bg-background font-display text-foreground lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <AuthShowcase />

            <main className="relative isolate flex flex-col gap-10 overflow-hidden px-6 py-8 sm:px-10 lg:px-14">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-[21rem] -right-[21rem] -z-10 size-[42rem] rounded-full bg-radial from-brand-cyan/20 to-transparent to-70%"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-[21rem] -left-[21rem] -z-10 size-[42rem] rounded-full bg-radial from-brand-sun/50 to-transparent to-70%"
                />

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm 2xl:max-w-md">
                        {children}
                    </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} {appName}. All rights
                    reserved.
                </p>
            </main>
        </div>
    );
}
