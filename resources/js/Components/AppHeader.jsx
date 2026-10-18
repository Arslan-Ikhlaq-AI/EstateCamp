import CommandMenu from '@/Components/CommandMenu';
import HeaderBreadcrumbs from '@/Components/HeaderBreadcrumbs';
import LanguageMenu from '@/Components/LanguageMenu';
import NotificationsMenu from '@/Components/NotificationsMenu';
import QuickCreateMenu from '@/Components/QuickCreateMenu';
import ThemeMenu from '@/Components/ThemeMenu';
import UserMenu from '@/Components/UserMenu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';

/**
 * The bar above every app page: the sidebar toggle and where you are on the
 * left; search, the Create menu, language, theme, notifications and the
 * account on the right.
 */
export default function AppHeader() {
    const { t } = useTranslation();

    return (
        <header className="sticky top-0 z-20 flex h-[4.25rem] shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6 xl:px-10">
            <SidebarTrigger
                className="-ms-1.5 size-9 text-muted-foreground hover:text-foreground rtl:rotate-180"
                aria-label={t('header.toggleSidebar')}
            />
            <Separator orientation="vertical" className="hidden data-vertical:h-6 data-vertical:self-auto md:block" />

            <HeaderBreadcrumbs className="hidden min-w-0 flex-1 md:block" />

            <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                <CommandMenu />
                <QuickCreateMenu />
                <Separator orientation="vertical" className="mx-1 hidden data-vertical:h-6 data-vertical:self-auto sm:block" />
                <div className="flex items-center gap-0.5">
                    <LanguageMenu />
                    <ThemeMenu />
                    <NotificationsMenu />
                </div>
                <Separator orientation="vertical" className="mx-1 hidden data-vertical:h-6 data-vertical:self-auto sm:block" />
                <UserMenu />
            </div>
        </header>
    );
}
