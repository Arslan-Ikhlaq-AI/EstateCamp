import AppHeader from '@/Components/AppHeader';
import AppSidebar from '@/Components/AppSidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAppearanceClass } from '@/hooks/use-appearance';
import { useLocaleAttributes, useTranslation } from '@/hooks/use-translation';

// The sidebar component stores its open state in this cookie.
const isSidebarCollapsed = () =>
    document.cookie.split('; ').includes('sidebar_state=false');

export default function DashboardLayout({ children }) {
    useAppearanceClass();
    useLocaleAttributes();

    const { dir, isRtl } = useTranslation();

    return (
        <SidebarProvider defaultOpen={!isSidebarCollapsed()}>
            <a
                href="#main-content"
                className="sr-only rounded-md bg-popover px-3 py-2 text-sm font-medium shadow-(--overlay-shadow) focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:ring-3 focus:ring-ring/50"
            >
                Skip to main content
            </a>

            <AppSidebar side={isRtl ? 'right' : 'left'} dir={dir} />

            <SidebarInset className="min-w-0">
                <AppHeader />

                <div
                    id="main-content"
                    tabIndex={-1}
                    className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-6 px-4 py-5 outline-none motion-safe:animate-enter md:px-6 md:py-6 lg:px-8 lg:py-8"
                >
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
